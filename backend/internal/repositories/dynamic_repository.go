package repositories

import (
	"fmt"
	"strings"
	"time"

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
	
	// 添加系统字段
	now := time.Now()
	if _, ok := data["created_at"]; !ok {
		data["created_at"] = now
	}
	if _, ok := data["updated_at"]; !ok {
		data["updated_at"] = now
	}

	// 构建 INSERT SQL (PostgreSQL 兼容)
	fields := make([]string, 0, len(data))
	placeholders := make([]string, 0, len(data))
	values := make([]interface{}, 0, len(data))

	i := 1
	for field, value := range data {
		fields = append(fields, field)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		values = append(values, value)
		i++
	}

	sql := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		tableName,
		joinFields(fields),
		joinPlaceholders(placeholders))

	if err := r.db.Exec(sql, values...).Error; err != nil {
		return "", fmt.Errorf("failed to create data: %w", err)
	}

	return id, nil
}

func (r *dynamicRepository) GetByID(tableName, id string) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	// 使用 Raw SQL 避免 GORM 缓存问题
	sql := fmt.Sprintf("SELECT * FROM %s WHERE id = ?", tableName)
	if err := r.db.Raw(sql, id).Scan(&result).Error; err != nil {
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

	// 使用 Raw SQL 避免 GORM 缓存问题
	sql := fmt.Sprintf("SELECT * FROM %s", tableName)
	var args []interface{}
	var conditions []string

	// 应用过滤条件
	if query.Filter != nil {
		for field, filterValue := range query.Filter {
			// 支持复杂筛选格式 { condition, value }
			if filterMap, ok := filterValue.(map[string]interface{}); ok {
				condition, _ := filterMap["condition"].(string)
				value := filterMap["value"]
				switch condition {
				case "equals":
					conditions = append(conditions, fmt.Sprintf("%s = ?", field))
					args = append(args, value)
				case "not_equals":
					conditions = append(conditions, fmt.Sprintf("%s != ?", field))
					args = append(args, value)
				case "contains":
					conditions = append(conditions, fmt.Sprintf("%s LIKE ?", field))
					args = append(args, fmt.Sprintf("%%%v%%", value))
				case "not_contains":
					conditions = append(conditions, fmt.Sprintf("%s NOT LIKE ?", field))
					args = append(args, fmt.Sprintf("%%%v%%", value))
				case "date_range":
					start, _ := filterMap["start"].(string)
					end, _ := filterMap["end"].(string)
					if start != "" && end != "" {
						conditions = append(conditions, fmt.Sprintf("%s >= ? AND %s <= ?", field, field))
						args = append(args, start, end)
					} else if start != "" {
						conditions = append(conditions, fmt.Sprintf("%s >= ?", field))
						args = append(args, start)
					} else if end != "" {
						conditions = append(conditions, fmt.Sprintf("%s <= ?", field))
						args = append(args, end)
					}
				default:
					conditions = append(conditions, fmt.Sprintf("%s = ?", field))
					args = append(args, value)
				}
			} else {
				// 简单值直接等于
				conditions = append(conditions, fmt.Sprintf("%s = ?", field))
				args = append(args, filterValue)
			}
		}
	}

	// 构建 WHERE 子句
	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}

	// 获取总数
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
	if len(conditions) > 0 {
		countSQL += " WHERE " + strings.Join(conditions, " AND ")
	}
	if err := r.db.Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count data: %w", err)
	}

	// 应用排序
	if len(query.Sort) > 0 {
		var orders []string
		for _, sort := range query.Sort {
			orders = append(orders, fmt.Sprintf("%s %s", sort.Field, sort.Order))
		}
		sql += " ORDER BY " + strings.Join(orders, ", ")
	}

	// 应用分页
	if query.Page > 0 && query.PageSize > 0 {
		offset := (query.Page - 1) * query.PageSize
		sql += fmt.Sprintf(" LIMIT %d OFFSET %d", query.PageSize, offset)
	}

	// 查询数据
	if err := r.db.Raw(sql, args...).Scan(&results).Error; err != nil {
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

func joinFields(fields []string) string {
	result := ""
	for i, field := range fields {
		if i > 0 {
			result += ", "
		}
		result += field
	}
	return result
}

func joinPlaceholders(placeholders []string) string {
	result := ""
	for i, ph := range placeholders {
		if i > 0 {
			result += ", "
		}
		result += ph
	}
	return result
}
