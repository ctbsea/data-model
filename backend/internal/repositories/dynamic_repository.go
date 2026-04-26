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
	Aggregate(tableName string, opts *AggregateOptions) ([]map[string]interface{}, error)
	Update(tableName, id string, data map[string]interface{}) error
	Delete(tableName, id string) error
	BatchCreate(tableName string, dataList []map[string]interface{}) ([]string, error)
	BatchUpdate(tableName string, updates []BatchUpdateItem) error
	BatchDelete(tableName string, ids []string) error
}

type MetricOption struct {
	Field string // "" 表示 COUNT(*)
	Func  string // "count" | "sum" | "avg"
	Alias string // 结果列别名
}

type AggregateOptions struct {
	GroupBy     string                 // 分组字段
	TimeField   string                 // 时间字段（时间分桶模式）
	Granularity string                 // "day" | "week" | "month"
	Metrics     []MetricOption
	Filter      map[string]interface{}
	Sort        []SortField
	Limit       int
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

// buildWhereClause 从 filter map 构建 WHERE 条件和参数
func buildWhereClause(filter map[string]interface{}) ([]string, []interface{}) {
	var conditions []string
	var args []interface{}
	for field, filterValue := range filter {
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
			conditions = append(conditions, fmt.Sprintf("%s = ?", field))
			args = append(args, filterValue)
		}
	}
	return conditions, args
}

// isValidIdentifier 校验字段名只含字母、数字、下划线，防止 SQL 注入
func isValidIdentifier(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return false
		}
	}
	return true
}

func (r *dynamicRepository) List(tableName string, query *QueryOptions) ([]map[string]interface{}, int64, error) {
	var results []map[string]interface{}
	var total int64

	sql := fmt.Sprintf("SELECT * FROM %s", tableName)
	var conditions []string
	var args []interface{}

	if query.Filter != nil {
		conditions, args = buildWhereClause(query.Filter)
	}

	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
	if len(conditions) > 0 {
		countSQL += " WHERE " + strings.Join(conditions, " AND ")
	}
	if err := r.db.Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count data: %w", err)
	}

	if len(query.Sort) > 0 {
		var orders []string
		for _, sort := range query.Sort {
			orders = append(orders, fmt.Sprintf("%s %s", sort.Field, sort.Order))
		}
		sql += " ORDER BY " + strings.Join(orders, ", ")
	}

	if query.Page > 0 && query.PageSize > 0 {
		offset := (query.Page - 1) * query.PageSize
		sql += fmt.Sprintf(" LIMIT %d OFFSET %d", query.PageSize, offset)
	}

	if err := r.db.Raw(sql, args...).Scan(&results).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list data: %w", err)
	}

	return results, total, nil
}

func (r *dynamicRepository) Aggregate(tableName string, opts *AggregateOptions) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	isTimeBucket := opts.TimeField != "" && opts.Granularity != ""

	// 校验字段名合法性
	if isTimeBucket && !isValidIdentifier(opts.TimeField) {
		return nil, fmt.Errorf("invalid time_field name")
	}
	if !isTimeBucket && opts.GroupBy != "" && !isValidIdentifier(opts.GroupBy) {
		return nil, fmt.Errorf("invalid group_by field name")
	}

	// 构建 SELECT
	var selectParts []string
	var groupByExpr string

	if isTimeBucket {
		truncUnit := "day"
		switch opts.Granularity {
		case "week":
			truncUnit = "week"
		case "month":
			truncUnit = "month"
		}
		groupByExpr = fmt.Sprintf("DATE_TRUNC('%s', %s)", truncUnit, opts.TimeField)
		selectParts = append(selectParts, groupByExpr+" AS name")
	} else if opts.GroupBy != "" {
		groupByExpr = opts.GroupBy
		selectParts = append(selectParts, opts.GroupBy+" AS name")
	}

	for _, m := range opts.Metrics {
		alias := m.Alias
		if alias == "" {
			alias = "value"
		}
		switch strings.ToLower(m.Func) {
		case "sum":
			if !isValidIdentifier(m.Field) {
				return nil, fmt.Errorf("invalid metric field name: %s", m.Field)
			}
			selectParts = append(selectParts, fmt.Sprintf("SUM(%s) AS %s", m.Field, alias))
		case "avg":
			if !isValidIdentifier(m.Field) {
				return nil, fmt.Errorf("invalid metric field name: %s", m.Field)
			}
			selectParts = append(selectParts, fmt.Sprintf("AVG(%s) AS %s", m.Field, alias))
		case "min":
			if !isValidIdentifier(m.Field) {
				return nil, fmt.Errorf("invalid metric field name: %s", m.Field)
			}
			selectParts = append(selectParts, fmt.Sprintf("MIN(%s) AS %s", m.Field, alias))
		case "max":
			if !isValidIdentifier(m.Field) {
				return nil, fmt.Errorf("invalid metric field name: %s", m.Field)
			}
			selectParts = append(selectParts, fmt.Sprintf("MAX(%s) AS %s", m.Field, alias))
		case "distinct":
			if !isValidIdentifier(m.Field) {
				return nil, fmt.Errorf("invalid metric field name: %s", m.Field)
			}
			selectParts = append(selectParts, fmt.Sprintf("COUNT(DISTINCT %s) AS %s", m.Field, alias))
		default: // count
			if m.Field != "" && isValidIdentifier(m.Field) {
				selectParts = append(selectParts, fmt.Sprintf("COUNT(%s) AS %s", m.Field, alias))
			} else {
				selectParts = append(selectParts, fmt.Sprintf("COUNT(*) AS %s", alias))
			}
		}
	}

	if len(selectParts) == 0 {
		selectParts = append(selectParts, "COUNT(*) AS value")
	}

	sql := fmt.Sprintf("SELECT %s FROM %s", strings.Join(selectParts, ", "), tableName)

	// WHERE
	var args []interface{}
	if opts.Filter != nil {
		conditions, filterArgs := buildWhereClause(opts.Filter)
		if len(conditions) > 0 {
			sql += " WHERE " + strings.Join(conditions, " AND ")
			args = append(args, filterArgs...)
		}
	}

	// GROUP BY
	if groupByExpr != "" {
		sql += " GROUP BY " + groupByExpr
	}

	// ORDER BY
	if len(opts.Sort) > 0 {
		var orders []string
		for _, s := range opts.Sort {
			orders = append(orders, fmt.Sprintf("%s %s", s.Field, s.Order))
		}
		sql += " ORDER BY " + strings.Join(orders, ", ")
	} else if isTimeBucket {
		sql += " ORDER BY name ASC"
	} else {
		sql += " ORDER BY value DESC"
	}

	// LIMIT
	limit := opts.Limit
	if limit <= 0 {
		limit = 500
	}
	sql += fmt.Sprintf(" LIMIT %d", limit)

	if err := r.db.Raw(sql, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to aggregate data: %w", err)
	}

	return results, nil
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
