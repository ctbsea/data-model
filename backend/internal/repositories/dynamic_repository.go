package repositories

import (
	"fmt"

	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type DynamicRepository interface {
	Create(tableName string, data map[string]interface{}) (string, error)
	GetByID(tableName, id string) (map[string]interface{}, error)
	GetByIDs(tableName string, ids []string) ([]map[string]interface{}, error)
	List(tableName string, query *QueryOptions) ([]map[string]interface{}, int64, error)
	Update(tableName, id string, data map[string]interface{}) error
	Delete(tableName, id string) error
	BatchCreate(tableName string, dataList []map[string]interface{}) ([]string, error)
	BatchUpdate(tableName string, updates []BatchUpdateItem) error
	BatchDelete(tableName string, ids []string) error
}

type QueryOptions struct {
	Fields   []string
	Filter   map[string]interface{}
	Sort     []SortField
	Page     int
	PageSize int
	Include  []string
}

type SortField struct {
	Field string
	Order string // ASC or DESC
}

type BatchUpdateItem struct {
	ID   string
	Data map[string]interface{}
}

type dynamicRepository struct {
	db *gorm.DB
}

func NewDynamicRepository() DynamicRepository {
	return &dynamicRepository{db: utils.DB}
}

func (r *dynamicRepository) Create(tableName string, data map[string]interface{}) (string, error) {
	// 生成ID
	id := generateUUID()
	data["id"] = id

	if err := r.db.Table(tableName).Create(&data).Error; err != nil {
		return "", fmt.Errorf("failed to create data: %w", err)
	}

	return id, nil
}

func (r *dynamicRepository) GetByID(tableName, id string) (map[string]interface{}, error) {
	var result map[string]interface{}
	if err := r.db.Table(tableName).Where("id = ?", id).First(&result).Error; err != nil {
		return nil, fmt.Errorf("failed to get data: %w", err)
	}
	return result, nil
}

func (r *dynamicRepository) GetByIDs(tableName string, ids []string) ([]map[string]interface{}, error) {
	if len(ids) == 0 {
		return []map[string]interface{}{}, nil
	}
	var results []map[string]interface{}
	if err := r.db.Table(tableName).Where("id IN ?", ids).Find(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get data by ids: %w", err)
	}
	return results, nil
}

func (r *dynamicRepository) List(tableName string, query *QueryOptions) ([]map[string]interface{}, int64, error) {
	var results []map[string]interface{}
	var total int64

	db := r.db.Table(tableName)

	// 应用过滤条件
	if query.Filter != nil {
		for field, filterValue := range query.Filter {
			// 支持复杂筛选格式 { condition, value }
			if filterMap, ok := filterValue.(map[string]interface{}); ok {
				condition, _ := filterMap["condition"].(string)
				value := filterMap["value"]
				switch condition {
				case "equals":
					db = db.Where(fmt.Sprintf("%s = ?", field), value)
				case "not_equals":
					db = db.Where(fmt.Sprintf("%s != ?", field), value)
				case "contains":
					db = db.Where(fmt.Sprintf("%s LIKE ?", field), fmt.Sprintf("%%%v%%", value))
				case "not_contains":
					db = db.Where(fmt.Sprintf("%s NOT LIKE ?", field), fmt.Sprintf("%%%v%%", value))
				case "date_range":
					// 日期范围筛选
					start, _ := filterMap["start"].(string)
					end, _ := filterMap["end"].(string)
					if start != "" && end != "" {
						db = db.Where(fmt.Sprintf("%s >= ? AND %s <= ?", field, field), start, end)
					} else if start != "" {
						db = db.Where(fmt.Sprintf("%s >= ?", field), start)
					} else if end != "" {
						db = db.Where(fmt.Sprintf("%s <= ?", field), end)
					}
				default:
					db = db.Where(fmt.Sprintf("%s = ?", field), value)
				}
			} else {
				// 简单值直接等于
				db = db.Where(fmt.Sprintf("%s = ?", field), filterValue)
			}
		}
	}

	// 获取总数
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count data: %w", err)
	}

	// 应用排序
	for _, sort := range query.Sort {
		db = db.Order(fmt.Sprintf("%s %s", sort.Field, sort.Order))
	}

	// 应用分页
	if query.Page > 0 && query.PageSize > 0 {
		offset := (query.Page - 1) * query.PageSize
		db = db.Offset(offset).Limit(query.PageSize)
	}

	// 选择字段
	if len(query.Fields) > 0 {
		db = db.Select(query.Fields)
	}

	// 查询数据
	if err := db.Find(&results).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list data: %w", err)
	}

	return results, total, nil
}

func (r *dynamicRepository) Update(tableName, id string, data map[string]interface{}) error {
	if err := r.db.Table(tableName).Where("id = ?", id).Updates(&data).Error; err != nil {
		return fmt.Errorf("failed to update data: %w", err)
	}
	return nil
}

func (r *dynamicRepository) Delete(tableName, id string) error {
	if err := r.db.Table(tableName).Where("id = ?", id).Delete(nil).Error; err != nil {
		return fmt.Errorf("failed to delete data: %w", err)
	}
	return nil
}

func (r *dynamicRepository) BatchCreate(tableName string, dataList []map[string]interface{}) ([]string, error) {
	var ids []string
	for _, data := range dataList {
		id := generateUUID()
		data["id"] = id
		ids = append(ids, id)
	}

	if err := r.db.Table(tableName).Create(&dataList).Error; err != nil {
		return nil, fmt.Errorf("failed to batch create data: %w", err)
	}

	return ids, nil
}

func (r *dynamicRepository) BatchUpdate(tableName string, updates []BatchUpdateItem) error {
	tx := r.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, update := range updates {
		if err := tx.Table(tableName).Where("id = ?", update.ID).Updates(&update.Data).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to batch update data: %w", err)
		}
	}

	return tx.Commit().Error
}

func (r *dynamicRepository) BatchDelete(tableName string, ids []string) error {
	if err := r.db.Table(tableName).Where("id IN ?", ids).Delete(nil).Error; err != nil {
		return fmt.Errorf("failed to batch delete data: %w", err)
	}
	return nil
}

func generateUUID() string {
	return fmt.Sprintf("%d", utils.DB.NowFunc().UnixNano())
}
