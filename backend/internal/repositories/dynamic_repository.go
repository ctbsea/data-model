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
	Field string
	Func  string
	Alias string
}

type AggregateOptions struct {
	GroupBy     string
	TimeField   string
	Granularity string
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
	Order string
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
	quotedTable, err := utils.QuoteSQLIdentifier(tableName)
	if err != nil {
		return "", err
	}

	id := generateUUID()
	data["id"] = id

	now := time.Now()
	if _, ok := data["created_at"]; !ok {
		data["created_at"] = now
	}
	if _, ok := data["updated_at"]; !ok {
		data["updated_at"] = now
	}

	fields := make([]string, 0, len(data))
	placeholders := make([]string, 0, len(data))
	values := make([]interface{}, 0, len(data))

	for field, value := range data {
		quotedField, err := utils.QuoteSQLIdentifier(field)
		if err != nil {
			return "", err
		}
		fields = append(fields, quotedField)
		placeholders = append(placeholders, "?")
		values = append(values, value)
	}

	sql := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", quotedTable, strings.Join(fields, ", "), strings.Join(placeholders, ", "))
	if err := r.db.Exec(sql, values...).Error; err != nil {
		return "", fmt.Errorf("failed to create data: %w", err)
	}

	return id, nil
}

func (r *dynamicRepository) GetByID(tableName, id string) (map[string]interface{}, error) {
	quotedTable, err := utils.QuoteSQLIdentifier(tableName)
	if err != nil {
		return nil, err
	}

	result := make(map[string]interface{})
	sql := fmt.Sprintf("SELECT * FROM %s WHERE %s = ?", quotedTable, mustQuoteIdentifier("id"))
	if err := r.db.Raw(sql, id).Scan(&result).Error; err != nil {
		return nil, fmt.Errorf("failed to get data: %w", err)
	}
	return result, nil
}

func (r *dynamicRepository) GetByIDs(tableName string, ids []string) ([]map[string]interface{}, error) {
	if len(ids) == 0 {
		return []map[string]interface{}{}, nil
	}
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := r.db.Table(tableName).Where("id IN ?", ids).Find(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get data by ids: %w", err)
	}
	return results, nil
}

func buildWhereClause(filter map[string]interface{}) ([]string, []interface{}, error) {
	var conditions []string
	var args []interface{}
	for field, filterValue := range filter {
		quotedField, err := utils.QuoteSQLIdentifier(field)
		if err != nil {
			return nil, nil, err
		}

		if filterMap, ok := filterValue.(map[string]interface{}); ok {
			condition, _ := filterMap["condition"].(string)
			value := filterMap["value"]
			switch condition {
			case "equals":
				conditions = append(conditions, fmt.Sprintf("%s = ?", quotedField))
				args = append(args, value)
			case "not_equals":
				conditions = append(conditions, fmt.Sprintf("%s != ?", quotedField))
				args = append(args, value)
			case "contains":
				conditions = append(conditions, fmt.Sprintf("%s ILIKE ?", quotedField))
				args = append(args, fmt.Sprintf("%%%v%%", value))
			case "not_contains":
				conditions = append(conditions, fmt.Sprintf("%s NOT ILIKE ?", quotedField))
				args = append(args, fmt.Sprintf("%%%v%%", value))
			case "date_range":
				start, _ := filterMap["start"].(string)
				end, _ := filterMap["end"].(string)
				if start != "" && end != "" {
					conditions = append(conditions, fmt.Sprintf("%s >= ? AND %s <= ?", quotedField, quotedField))
					args = append(args, start, end)
				} else if start != "" {
					conditions = append(conditions, fmt.Sprintf("%s >= ?", quotedField))
					args = append(args, start)
				} else if end != "" {
					conditions = append(conditions, fmt.Sprintf("%s <= ?", quotedField))
					args = append(args, end)
				}
			default:
				conditions = append(conditions, fmt.Sprintf("%s = ?", quotedField))
				args = append(args, value)
			}
		} else {
			conditions = append(conditions, fmt.Sprintf("%s = ?", quotedField))
			args = append(args, filterValue)
		}
	}
	return conditions, args, nil
}

func (r *dynamicRepository) List(tableName string, query *QueryOptions) ([]map[string]interface{}, int64, error) {
	quotedTable, err := utils.QuoteSQLIdentifier(tableName)
	if err != nil {
		return nil, 0, err
	}

	var results []map[string]interface{}
	var total int64

	sql := fmt.Sprintf("SELECT * FROM %s", quotedTable)
	var conditions []string
	var args []interface{}

	if query.Filter != nil {
		conditions, args, err = buildWhereClause(query.Filter)
		if err != nil {
			return nil, 0, err
		}
	}

	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s", quotedTable)
	if len(conditions) > 0 {
		countSQL += " WHERE " + strings.Join(conditions, " AND ")
	}
	if err := r.db.Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count data: %w", err)
	}

	if len(query.Sort) > 0 {
		orders, err := buildOrderClauses(query.Sort)
		if err != nil {
			return nil, 0, err
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
	quotedTable, err := utils.QuoteSQLIdentifier(tableName)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	isTimeBucket := opts.TimeField != "" && opts.Granularity != ""

	var selectParts []string
	var groupByExpr string
	firstMetricAlias := "value"

	if isTimeBucket {
		quotedTimeField, err := utils.QuoteSQLIdentifier(opts.TimeField)
		if err != nil {
			return nil, err
		}
		truncUnit := "day"
		switch opts.Granularity {
		case "week":
			truncUnit = "week"
		case "month":
			truncUnit = "month"
		case "day", "":
			truncUnit = "day"
		default:
			return nil, fmt.Errorf("invalid granularity: %s", opts.Granularity)
		}
		groupByExpr = fmt.Sprintf("DATE_TRUNC(%s, %s)", utils.SQLStringLiteral(truncUnit), quotedTimeField)
		selectParts = append(selectParts, groupByExpr+` AS "name"`)
	} else if opts.GroupBy != "" {
		quotedGroupBy, err := utils.QuoteSQLIdentifier(opts.GroupBy)
		if err != nil {
			return nil, err
		}
		groupByExpr = quotedGroupBy
		selectParts = append(selectParts, quotedGroupBy+` AS "name"`)
	}

	for _, metric := range opts.Metrics {
		alias := metric.Alias
		if alias == "" {
			alias = "value"
		}
		if firstMetricAlias == "value" {
			firstMetricAlias = alias
		}
		quotedAlias := utils.QuoteSQLAlias(alias)

		if metric.Field == "" {
			selectParts = append(selectParts, fmt.Sprintf("COUNT(*) AS %s", quotedAlias))
			continue
		}

		quotedMetricField, err := utils.QuoteSQLIdentifier(metric.Field)
		if err != nil {
			return nil, err
		}

		switch strings.ToLower(metric.Func) {
		case "sum":
			selectParts = append(selectParts, fmt.Sprintf("SUM(%s) AS %s", quotedMetricField, quotedAlias))
		case "avg":
			selectParts = append(selectParts, fmt.Sprintf("AVG(%s) AS %s", quotedMetricField, quotedAlias))
		case "min":
			selectParts = append(selectParts, fmt.Sprintf("MIN(%s) AS %s", quotedMetricField, quotedAlias))
		case "max":
			selectParts = append(selectParts, fmt.Sprintf("MAX(%s) AS %s", quotedMetricField, quotedAlias))
		case "distinct":
			selectParts = append(selectParts, fmt.Sprintf("COUNT(DISTINCT %s) AS %s", quotedMetricField, quotedAlias))
		default:
			selectParts = append(selectParts, fmt.Sprintf("COUNT(%s) AS %s", quotedMetricField, quotedAlias))
		}
	}

	if len(selectParts) == 0 {
		selectParts = append(selectParts, `COUNT(*) AS "value"`)
	}

	sql := fmt.Sprintf("SELECT %s FROM %s", strings.Join(selectParts, ", "), quotedTable)

	var args []interface{}
	if opts.Filter != nil {
		conditions, filterArgs, err := buildWhereClause(opts.Filter)
		if err != nil {
			return nil, err
		}
		if len(conditions) > 0 {
			sql += " WHERE " + strings.Join(conditions, " AND ")
			args = append(args, filterArgs...)
		}
	}

	if groupByExpr != "" {
		sql += " GROUP BY " + groupByExpr
	}

	if groupByExpr == "" {
		// 单值统计不需要排序，避免默认 ORDER BY value 引用不存在的别名
	} else if len(opts.Sort) > 0 {
		orders, err := buildOrderClauses(opts.Sort)
		if err != nil {
			return nil, err
		}
		sql += " ORDER BY " + strings.Join(orders, ", ")
	} else if isTimeBucket {
		sql += ` ORDER BY "name" ASC`
	} else {
		quotedMetricAlias := utils.QuoteSQLAlias(firstMetricAlias)
		sql += " ORDER BY " + quotedMetricAlias + " DESC"
	}

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
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return err
	}
	for field := range data {
		if _, err := utils.QuoteSQLIdentifier(field); err != nil {
			return err
		}
	}
	if err := r.db.Table(tableName).Where("id = ?", id).Updates(&data).Error; err != nil {
		return fmt.Errorf("failed to update data: %w", err)
	}
	return nil
}

func (r *dynamicRepository) Delete(tableName, id string) error {
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return err
	}
	if err := r.db.Table(tableName).Where("id = ?", id).Delete(nil).Error; err != nil {
		return fmt.Errorf("failed to delete data: %w", err)
	}
	return nil
}

func (r *dynamicRepository) BatchCreate(tableName string, dataList []map[string]interface{}) ([]string, error) {
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return nil, err
	}
	var ids []string
	for _, data := range dataList {
		for field := range data {
			if _, err := utils.QuoteSQLIdentifier(field); err != nil {
				return nil, err
			}
		}
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
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return err
	}
	tx := r.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, update := range updates {
		for field := range update.Data {
			if _, err := utils.QuoteSQLIdentifier(field); err != nil {
				tx.Rollback()
				return err
			}
		}
		if err := tx.Table(tableName).Where("id = ?", update.ID).Updates(&update.Data).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to batch update data: %w", err)
		}
	}

	return tx.Commit().Error
}

func (r *dynamicRepository) BatchDelete(tableName string, ids []string) error {
	if _, err := utils.QuoteSQLIdentifier(tableName); err != nil {
		return err
	}
	if err := r.db.Table(tableName).Where("id IN ?", ids).Delete(nil).Error; err != nil {
		return fmt.Errorf("failed to batch delete data: %w", err)
	}
	return nil
}

func buildOrderClauses(sortFields []SortField) ([]string, error) {
	orders := make([]string, 0, len(sortFields))
	for _, sort := range sortFields {
		quotedField, err := utils.QuoteSQLIdentifier(sort.Field)
		if err != nil {
			return nil, err
		}
		order, err := utils.NormalizeSortOrder(sort.Order)
		if err != nil {
			return nil, err
		}
		orders = append(orders, fmt.Sprintf("%s %s", quotedField, order))
	}
	return orders, nil
}

func generateUUID() string {
	return fmt.Sprintf("%d", utils.DB.NowFunc().UnixNano())
}

func mustQuoteIdentifier(identifier string) string {
	quoted, err := utils.QuoteSQLIdentifier(identifier)
	if err != nil {
		panic(err)
	}
	return quoted
}
