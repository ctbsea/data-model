package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type DataService interface {
	CreateData(modelName string, data map[string]interface{}) (string, error)
	GetData(modelName, id string) (map[string]interface{}, error)
	ListData(modelName string, req *ListDataRequest) (*ListDataResponse, error)
	AggregateData(modelName string, req *AggregateRequest) ([]map[string]interface{}, error)
	UpdateData(modelName, id string, data map[string]interface{}, userID string) error
	DeleteData(modelName, id string) error
	BatchCreate(modelName string, dataList []map[string]interface{}) ([]string, error)
	BatchUpdate(modelName string, updates []repositories.BatchUpdateItem, userID string) error
	BatchDelete(modelName string, ids []string) error
}

type AggregateRequest struct {
	GroupBy     string                      `json:"group_by"`
	TimeField   string                      `json:"time_field"`
	Granularity string                      `json:"granularity"`
	Metrics     []repositories.MetricOption `json:"metrics"`
	Filter      map[string]interface{}      `json:"filter"`
	Sort        []SortField                 `json:"sort"`
	Limit       int                         `json:"limit"`
}

type ListDataRequest struct {
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
	Filter   map[string]interface{} `json:"filter"`
	Sort     []SortField            `json:"sort"`
	Fields   []string               `json:"fields"`
}

type ListDataResponse struct {
	Data  []map[string]interface{} `json:"data"`
	Total int64                    `json:"total"`
	Page  int                      `json:"page"`
	Size  int                      `json:"size"`
}

type SortField struct {
	Field string `json:"field"`
	Order string `json:"order"`
}

type dataService struct {
	modelRepo   repositories.ModelRepository
	fieldRepo   repositories.FieldRepository
	dynamicRepo repositories.DynamicRepository
	modelCache  []*models.Model
	engine      AutomationEngine
}

func NewDataService(engine AutomationEngine) DataService {
	return &dataService{
		modelRepo:   repositories.NewModelRepository(),
		fieldRepo:   repositories.NewFieldRepository(),
		dynamicRepo: repositories.NewDynamicRepository(),
		engine:      engine,
	}
}

func (s *dataService) ensureModelFields(model *models.Model) error {
	if model == nil || len(model.Fields) > 0 {
		return nil
	}
	fields, err := s.fieldRepo.GetByModelID(model.ID)
	if err != nil {
		return err
	}
	model.Fields = fields
	return nil
}

func (s *dataService) CreateData(modelName string, data map[string]interface{}) (string, error) {
	// 获取模型定义
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return "", errors.New("model not found")
	}
	if err := s.ensureModelFields(model); err != nil {
		return "", err
	}

	if err := s.validateData(model, data, "", true); err != nil {
		return "", err
	}

	// 创建数据
	id, err := s.dynamicRepo.Create(model.TableName, data)
	if err != nil {
		return "", err
	}

	if s.engine != nil {
		if fullData, err2 := s.dynamicRepo.GetByID(model.TableName, id); err2 == nil {
			s.engine.TriggerEvent("record_create", modelName, id, fullData)
		}
	}

	return id, nil
}

func (s *dataService) GetData(modelName, id string) (map[string]interface{}, error) {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, errors.New("model not found")
	}

	data, err := s.dynamicRepo.GetByID(model.TableName, id)
	if err != nil {
		return nil, err
	}
	dataList := []map[string]interface{}{data}
	if err := s.attachRelationData(model, dataList); err != nil {
		fmt.Printf("Failed to attach relation data: %v\n", err)
	}

	return data, nil
}

func (s *dataService) ListData(modelName string, req *ListDataRequest) (*ListDataResponse, error) {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, errors.New("model not found")
	}

	// 构建查询选项
	queryOptions := &repositories.QueryOptions{
		Page:     req.Page,
		PageSize: req.PageSize,
		Filter:   req.Filter,
		Fields:   req.Fields,
	}

	// 转换排序字段
	for _, sort := range req.Sort {
		queryOptions.Sort = append(queryOptions.Sort, repositories.SortField{
			Field: sort.Field,
			Order: sort.Order,
		})
	}

	// 默认按 ID 降序排序
	if len(queryOptions.Sort) == 0 {
		queryOptions.Sort = append(queryOptions.Sort, repositories.SortField{
			Field: "id",
			Order: "desc",
		})
	}

	// 查询数据
	data, total, err := s.dynamicRepo.List(model.TableName, queryOptions)
	if err != nil {
		return nil, err
	}

	// 批量附加关联数据
	if err := s.attachRelationData(model, data); err != nil {
		fmt.Printf("Failed to attach relation data: %v\n", err)
	}

	// 批量附加评论统计
	if err := s.attachCommentCounts(model.Name, data); err != nil {
		fmt.Printf("Failed to attach comment counts: %v\n", err)
	}

	return &ListDataResponse{
		Data:  data,
		Total: total,
		Page:  req.Page,
		Size:  req.PageSize,
	}, nil
}

func (s *dataService) AggregateData(modelName string, req *AggregateRequest) ([]map[string]interface{}, error) {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, errors.New("model not found")
	}

	// 构建字段名集合用于校验
	fieldSet := make(map[string]string) // name -> type
	for _, f := range model.Fields {
		fieldSet[f.Name] = f.Type
	}
	// 系统字段也允许
	fieldSet["id"] = "text"
	fieldSet["created_at"] = "date"
	fieldSet["updated_at"] = "date"
	fieldSet["created_by"] = "text"
	fieldSet["updated_by"] = "text"

	// 校验 GroupBy 字段
	if req.GroupBy != "" {
		if _, ok := fieldSet[req.GroupBy]; !ok {
			return nil, fmt.Errorf("group_by field '%s' not found in model", req.GroupBy)
		}
	}

	// 校验 TimeField
	if req.TimeField != "" {
		ft, ok := fieldSet[req.TimeField]
		if !ok {
			return nil, fmt.Errorf("time_field '%s' not found in model", req.TimeField)
		}
		if ft != "date" && req.TimeField != "created_at" && req.TimeField != "updated_at" {
			return nil, fmt.Errorf("time_field '%s' must be a date type field", req.TimeField)
		}
	}

	// 校验 Metrics 字段类型
	for _, m := range req.Metrics {
		if m.Field == "" {
			continue
		}
		ft, ok := fieldSet[m.Field]
		if !ok {
			return nil, fmt.Errorf("metric field '%s' not found in model", m.Field)
		}
		// sum/avg 只允许 number 类型；min/max/distinct 允许所有类型
		if (m.Func == "sum" || m.Func == "avg") && ft != "number" {
			return nil, fmt.Errorf("metric field '%s' must be number type for %s", m.Field, m.Func)
		}
	}

	opts := &repositories.AggregateOptions{
		GroupBy:     req.GroupBy,
		TimeField:   req.TimeField,
		Granularity: req.Granularity,
		Metrics:     req.Metrics,
		Filter:      req.Filter,
		Limit:       req.Limit,
	}
	for _, s := range req.Sort {
		opts.Sort = append(opts.Sort, repositories.SortField{Field: s.Field, Order: s.Order})
	}

	return s.dynamicRepo.Aggregate(model.TableName, opts)
}

// attachCommentCounts 批量附加评论统计
func (s *dataService) attachCommentCounts(modelName string, dataList []map[string]interface{}) error {
	if len(dataList) == 0 {
		return nil
	}

	// 收集所有记录ID
	recordIDs := []string{}
	for _, row := range dataList {
		if id, ok := row["id"].(string); ok && id != "" {
			recordIDs = append(recordIDs, id)
		}
	}

	if len(recordIDs) == 0 {
		return nil
	}

	// 查询评论统计
	var counts []models.CommentCount
	utils.DB.Where("model_name = ? AND record_id IN ?", modelName, recordIDs).Find(&counts)

	// 构建ID到数量的映射
	countMap := make(map[string]int)
	for _, c := range counts {
		countMap[c.RecordID] = c.Count
	}

	// 附加到每条记录
	for _, row := range dataList {
		if id, ok := row["id"].(string); ok {
			row["_comment_count"] = countMap[id]
		}
	}

	return nil
}

// attachRelationData 批量附加关联数据
func (s *dataService) attachRelationData(model *models.Model, dataList []map[string]interface{}) error {
	// 找出所有关联字段
	relationFields := []models.Field{}
	for _, field := range model.Fields {
		if field.Type == "relation" && field.RelationConfig != "" {
			relationFields = append(relationFields, field)
		}
	}

	if len(relationFields) == 0 {
		return nil
	}

	// 获取所有模型用于查找目标表（使用缓存）
	var allModels []models.Model
	if s.modelCache != nil {
		allModels = make([]models.Model, len(s.modelCache))
		for i, m := range s.modelCache {
			allModels[i] = *m
		}
	} else {
		var err error
		allModels, _, err = s.modelRepo.List(1, 1000)
		if err != nil {
			return err
		}
		s.modelCache = make([]*models.Model, len(allModels))
		for i := range allModels {
			s.modelCache[i] = &allModels[i]
		}
	}

	modelMap := make(map[string]*models.Model)
	for i := range allModels {
		modelMap[allModels[i].ID] = &allModels[i]
	}

	// 对每个关联字段批量查询
	for _, field := range relationFields {
		var config struct {
			TargetModelID string   `json:"target_model_id"`
			DisplayFields []string `json:"display_fields"`
		}
		if err := json.Unmarshal([]byte(field.RelationConfig), &config); err != nil {
			continue
		}

		targetModel, ok := modelMap[config.TargetModelID]
		if !ok {
			continue
		}

		// 收集所有关联ID
		relationIDs := []string{}
		for _, row := range dataList {
			if val, ok := row[field.Name]; ok && val != nil {
				relationIDs = append(relationIDs, normalizeRelationIDs(val)...)
			}
		}

		if len(relationIDs) == 0 {
			continue
		}

		// 批量查询关联数据
		relationData, err := s.dynamicRepo.GetByIDs(targetModel.TableName, relationIDs)
		if err != nil {
			continue
		}

		// 构建ID到数据的映射
		relationMap := make(map[string]map[string]interface{})
		for _, item := range relationData {
			if id, ok := item["id"].(string); ok {
				relationMap[id] = item
			}
		}

		// 附加关联数据到每条记录
		for _, row := range dataList {
			if val, ok := row[field.Name]; ok && val != nil {
				ids := normalizeRelationIDs(val)
				if len(ids) == 1 {
					if related, exists := relationMap[ids[0]]; exists {
						row[field.Name+"_data"] = related
					}
				} else if len(ids) > 1 {
					relatedList := []map[string]interface{}{}
					for _, id := range ids {
						if related, exists := relationMap[id]; exists {
							relatedList = append(relatedList, related)
						}
					}
					row[field.Name+"_data"] = relatedList
				}
			}
		}
	}

	return nil
}

func normalizeRelationIDs(value interface{}) []string {
	ids := []string{}
	add := func(id string) {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}

	switch v := value.(type) {
	case string:
		if strings.HasPrefix(v, "[") {
			var values []string
			if err := json.Unmarshal([]byte(v), &values); err == nil {
				for _, id := range values {
					add(id)
				}
				return ids
			}
		}
		for _, id := range strings.Split(v, ",") {
			add(id)
		}
	case []string:
		for _, id := range v {
			add(id)
		}
	case []interface{}:
		for _, id := range v {
			if idStr, ok := id.(string); ok {
				add(idStr)
			}
		}
	}
	return ids
}

func normalizeStringValues(value interface{}) []string {
	values := []string{}
	add := func(item string) {
		item = strings.TrimSpace(item)
		if item != "" {
			values = append(values, item)
		}
	}

	switch v := value.(type) {
	case string:
		if strings.HasPrefix(v, "[") {
			var items []string
			if err := json.Unmarshal([]byte(v), &items); err == nil {
				for _, item := range items {
					add(item)
				}
				return values
			}
		}
		for _, item := range strings.Split(v, ",") {
			add(item)
		}
	case []string:
		for _, item := range v {
			add(item)
		}
	case []interface{}:
		for _, item := range v {
			add(fmt.Sprintf("%v", item))
		}
	}
	return values
}

func shouldNormalizeStringArray(field *models.Field, value interface{}) bool {
	if field.Type == "multi_select" {
		return true
	}
	if field.Type != "select" {
		return false
	}
	switch value.(type) {
	case []string, []interface{}:
		return true
	default:
		return false
	}
}

func (s *dataService) UpdateData(modelName, id string, data map[string]interface{}, userID string) error {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return errors.New("model not found")
	}
	if err := s.ensureModelFields(model); err != nil {
		return err
	}

	// 验证数据
	if err := s.validateData(model, data, id, false); err != nil {
		return err
	}

	// 获取旧数据用于记录变更日志
	utils.Logger.Info(fmt.Sprintf("Getting old data for change log: table=%s, id=%s", model.TableName, id))
	oldData, err := s.dynamicRepo.GetByID(model.TableName, id)
	if err != nil {
		// 如果获取旧数据失败，记录错误并使用空map继续更新
		utils.Logger.Error(fmt.Sprintf("Failed to get old data for change log: %v", err))
		oldData = make(map[string]interface{})
	} else {
		utils.Logger.Info(fmt.Sprintf("Got old data for change log: %+v", oldData))
	}

	// 更新数据
	if err := s.dynamicRepo.Update(model.TableName, id, data); err != nil {
		return err
	}

	// 记录变更日志
	s.recordChangeLogs(modelName, id, oldData, data, userID)

	if s.engine != nil {
		if fullData, err2 := s.dynamicRepo.GetByID(model.TableName, id); err2 == nil {
			s.engine.TriggerEvent("record_update", modelName, id, fullData)
		}
	}

	return nil
}

func (s *dataService) DeleteData(modelName, id string) error {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return errors.New("model not found")
	}

	if err := s.dynamicRepo.Delete(model.TableName, id); err != nil {
		return err
	}

	if s.engine != nil {
		s.engine.TriggerEvent("record_delete", modelName, id, map[string]interface{}{"id": id})
	}

	return nil
}

func (s *dataService) BatchCreate(modelName string, dataList []map[string]interface{}) ([]string, error) {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, errors.New("model not found")
	}
	if err := s.ensureModelFields(model); err != nil {
		return nil, err
	}

	// 验证所有数据
	for _, data := range dataList {
		if err := s.validateData(model, data, "", true); err != nil {
			return nil, err
		}
	}

	ids, err := s.dynamicRepo.BatchCreate(model.TableName, dataList)
	if err != nil {
		return nil, err
	}

	return ids, nil
}

func (s *dataService) BatchUpdate(modelName string, updates []repositories.BatchUpdateItem, userID string) error {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return errors.New("model not found")
	}
	if err := s.ensureModelFields(model); err != nil {
		return err
	}

	// 验证所有数据
	for _, update := range updates {
		if err := s.validateData(model, update.Data, update.ID, false); err != nil {
			return err
		}
	}

	// 批量获取旧数据用于记录变更日志
	oldDataMap := make(map[string]map[string]interface{})
	for _, update := range updates {
		if oldData, err := s.dynamicRepo.GetByID(model.TableName, update.ID); err == nil {
			oldDataMap[update.ID] = oldData
		} else {
			// 如果获取失败，使用空map
			oldDataMap[update.ID] = make(map[string]interface{})
		}
	}

	if err := s.dynamicRepo.BatchUpdate(model.TableName, updates); err != nil {
		return err
	}

	// 批量记录变更日志
	for _, update := range updates {
		if oldData, ok := oldDataMap[update.ID]; ok {
			s.recordChangeLogs(modelName, update.ID, oldData, update.Data, userID)
		}
	}

	return nil
}

func (s *dataService) BatchDelete(modelName string, ids []string) error {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return errors.New("model not found")
	}

	if err := s.dynamicRepo.BatchDelete(model.TableName, ids); err != nil {
		return err
	}

	return nil
}

func (s *dataService) validateData(model *models.Model, data map[string]interface{}, currentID string, requireAll bool) error {
	for i := range model.Fields {
		field := &model.Fields[i]
		value, exists := data[field.Name]

		if field.Required {
			if (!exists && requireAll) || (exists && isEmptyFieldValue(value)) {
				return fmt.Errorf("%s不能为空", field.DisplayName)
			}
		}

		if exists && value != nil && !isEmptyFieldValue(value) {
			if field.Type == "bool" || field.Type == "boolean" {
				booleanValue, ok := normalizeBooleanValue(value)
				if !ok {
					return fmt.Errorf("field %s must be boolean", field.Name)
				}
				data[field.Name] = strconv.FormatBool(booleanValue)
				value = booleanValue
			}
			if err := s.validateFieldType(field, value); err != nil {
				return err
			}
			if shouldNormalizeStringArray(field, value) {
				values := normalizeStringValues(value)
				data[field.Name] = strings.Join(values, ",")
			}
			if field.Type == "relation" {
				ids := normalizeRelationIDs(value)
				if len(ids) > 1 {
					data[field.Name] = strings.Join(ids, ",")
				} else if len(ids) == 1 {
					data[field.Name] = ids[0]
				}
			}
			if field.Type == "number" || field.Type == "currency" {
				if str, ok := value.(string); ok {
					if num, err := strconv.ParseFloat(str, 64); err == nil {
						data[field.Name] = num
					}
				}
			}
			if field.Unique {
				if err := s.validateUniqueValue(model.TableName, field, data[field.Name], currentID); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func isEmptyFieldValue(value interface{}) bool {
	if value == nil {
		return true
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v) == ""
	case []string:
		return len(v) == 0
	case []interface{}:
		return len(v) == 0
	default:
		return false
	}
}

func normalizeBooleanValue(value interface{}) (bool, bool) {
	switch v := value.(type) {
	case bool:
		return v, true
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "true", "1", "yes", "y", "是":
			return true, true
		case "false", "0", "no", "n", "否":
			return false, true
		default:
			return false, false
		}
	case int:
		return v != 0, true
	case int8:
		return v != 0, true
	case int16:
		return v != 0, true
	case int32:
		return v != 0, true
	case int64:
		return v != 0, true
	case uint:
		return v != 0, true
	case uint8:
		return v != 0, true
	case uint16:
		return v != 0, true
	case uint32:
		return v != 0, true
	case uint64:
		return v != 0, true
	case float32:
		return v != 0, true
	case float64:
		return v != 0, true
	default:
		return false, false
	}
}

func (s *dataService) validateUniqueValue(tableName string, field *models.Field, value interface{}, currentID string) error {
	if isEmptyFieldValue(value) {
		return nil
	}
	quotedTable, err := utils.QuoteSQLIdentifier(tableName)
	if err != nil {
		return err
	}
	quotedField, err := utils.QuoteSQLIdentifier(field.Name)
	if err != nil {
		return err
	}
	quotedID, err := utils.QuoteSQLIdentifier("id")
	if err != nil {
		return err
	}

	sql := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s::text = ?", quotedTable, quotedField)
	args := []interface{}{fmt.Sprintf("%v", value)}
	if currentID != "" {
		sql += fmt.Sprintf(" AND %s <> ?", quotedID)
		args = append(args, currentID)
	}

	var count int64
	if err := utils.DB.Raw(sql, args...).Scan(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("%s已存在，不能重复", field.DisplayName)
	}
	return nil
}

func (s *dataService) validateFieldType(field *models.Field, value interface{}) error {
	switch field.Type {
	case "relation":
		switch value.(type) {
		case string, []string, []interface{}:
			return nil
		default:
			return fmt.Errorf("field %s must be string or array", field.Name)
		}
	case "select", "multi_select":
		switch value.(type) {
		case string, []string, []interface{}:
			return nil
		default:
			return fmt.Errorf("field %s must be string or array", field.Name)
		}
	case "text", "textarea", "email", "phone", "url", "file", "image", "country", "user":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("field %s must be string", field.Name)
		}
	case "number", "currency":
		// 允许字符串数字和空值
		if isNumber(value) {
			return nil
		}
		if str, ok := value.(string); ok {
			if str == "" {
				return nil // 允许空字符串
			}
			if _, err := strconv.ParseFloat(str, 64); err != nil {
				return fmt.Errorf("field %s must be number", field.Name)
			}
			return nil
		}
		return fmt.Errorf("field %s must be number", field.Name)
	case "bool", "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("field %s must be boolean", field.Name)
		}
	case "date":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("field %s must be date string", field.Name)
		}
	}

	// 验证自定义验证规则
	if field.Validation != "" {
		var validationRules map[string]interface{}
		if err := json.Unmarshal([]byte(field.Validation), &validationRules); err == nil {
			// 这里可以添加更多的验证逻辑
			// 例如: min, max, pattern等
		}
	}

	return nil
}

func (s *dataService) validateDataTypes(model *models.Model, data map[string]interface{}) error {
	// 只验证字段类型,不验证required
	for i := range model.Fields {
		field := &model.Fields[i]

		// 验证字段类型
		if value, exists := data[field.Name]; exists && value != nil {
			if field.Type == "bool" || field.Type == "boolean" {
				booleanValue, ok := normalizeBooleanValue(value)
				if !ok {
					return fmt.Errorf("field %s must be boolean", field.Name)
				}
				data[field.Name] = strconv.FormatBool(booleanValue)
				value = booleanValue
			}
			if err := s.validateFieldType(field, value); err != nil {
				return err
			}
			if shouldNormalizeStringArray(field, value) {
				values := normalizeStringValues(value)
				data[field.Name] = strings.Join(values, ",")
			}
		}
	}

	return nil
}

func isNumber(value interface{}) bool {
	switch value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return true
	default:
		return false
	}
}

// recordChangeLogs 记录变更日志
func (s *dataService) recordChangeLogs(modelName, recordID string, oldData, newData map[string]interface{}, userID string) {
	// 忽略系统字段
	systemFields := map[string]bool{
		"id":         true,
		"created_at": true,
		"updated_at": true,
		"created_by": true,
		"updated_by": true,
	}

	now := time.Now()
	var changeLogs []models.ChangeLog

	utils.Logger.Info(fmt.Sprintf("Recording change logs for model=%s, record=%s, oldData=%v, newData=%v", modelName, recordID, oldData, newData))

	for field, newValue := range newData {
		// 跳过系统字段
		if systemFields[field] {
			continue
		}

		oldValue := oldData[field]

		// 比较新旧值，只有变化才记录
		if !isEqual(oldValue, newValue) {
			utils.Logger.Info(fmt.Sprintf("Field %s changed: oldValue=%v, newValue=%v", field, oldValue, newValue))

			// 将值转换为 JSON 字符串格式存储
			var oldValueStr, newValueStr string
			if oldValue != nil {
				oldValueJSON, _ := json.Marshal(oldValue)
				oldValueStr = string(oldValueJSON)
			} else {
				oldValueStr = "null"
			}
			if newValue != nil {
				newValueJSON, _ := json.Marshal(newValue)
				newValueStr = string(newValueJSON)
			} else {
				newValueStr = "null"
			}

			changeLogs = append(changeLogs, models.ChangeLog{
				ID:        uuid.New().String(),
				ModelName: modelName,
				RowID:     recordID,
				FieldName: field,
				OldValue:  oldValueStr,
				NewValue:  newValueStr,
				ChangedBy: userID,
				ChangedAt: now,
				Operation: "update",
			})
		}
	}

	// 批量保存变更日志
	if len(changeLogs) > 0 {
		utils.Logger.Info(fmt.Sprintf("Saving %d change logs", len(changeLogs)))
		if err := utils.DB.Create(&changeLogs).Error; err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to save change logs: %v", err))
		} else {
			utils.Logger.Info(fmt.Sprintf("Successfully saved %d change logs", len(changeLogs)))
		}
	} else {
		utils.Logger.Info("No changes detected")
	}
}

// isEqual 比较两个值是否相等
func isEqual(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// 尝试转换为 JSON 进行比较
	aJSON, aErr := json.Marshal(a)
	bJSON, bErr := json.Marshal(b)
	if aErr == nil && bErr == nil {
		result := string(aJSON) == string(bJSON)
		if !result {
			utils.Logger.Info(fmt.Sprintf("Values different: a=%s, b=%s", string(aJSON), string(bJSON)))
		}
		return result
	}

	return a == b
}
