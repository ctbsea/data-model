package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
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
	GroupBy     string                    `json:"group_by"`
	TimeField   string                    `json:"time_field"`
	Granularity string                    `json:"granularity"`
	Metrics     []repositories.MetricOption `json:"metrics"`
	Filter      map[string]interface{}    `json:"filter"`
	Sort        []SortField               `json:"sort"`
	Limit       int                       `json:"limit"`
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
	dynamicRepo repositories.DynamicRepository
	modelCache  []*models.Model // 模型缓存
}

func NewDataService() DataService {
	return &dataService{
		modelRepo:   repositories.NewModelRepository(),
		dynamicRepo: repositories.NewDynamicRepository(),
	}
}

func (s *dataService) CreateData(modelName string, data map[string]interface{}) (string, error) {
	// 获取模型定义
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return "", errors.New("model not found")
	}

	// 创建数据时不验证required字段,只验证类型
	if err := s.validateDataTypes(model, data); err != nil {
		return "", err
	}

	// 创建数据
	id, err := s.dynamicRepo.Create(model.TableName, data)
	if err != nil {
		return "", err
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
		if (m.Func == "sum" || m.Func == "avg") && m.Field != "" {
			ft, ok := fieldSet[m.Field]
			if !ok {
				return nil, fmt.Errorf("metric field '%s' not found in model", m.Field)
			}
			if ft != "number" {
				return nil, fmt.Errorf("metric field '%s' must be number type for %s", m.Field, m.Func)
			}
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
			TargetModelID string `json:"target_model_id"`
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
				switch v := val.(type) {
				case string:
					if v != "" {
						relationIDs = append(relationIDs, v)
					}
				case []interface{}:
					for _, id := range v {
						if idStr, ok := id.(string); ok && idStr != "" {
							relationIDs = append(relationIDs, idStr)
						}
					}
				}
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
				switch v := val.(type) {
				case string:
					if related, exists := relationMap[v]; exists {
						row[field.Name+"_data"] = related
					}
				case []interface{}:
					relatedList := []map[string]interface{}{}
					for _, id := range v {
						if idStr, ok := id.(string); ok {
							if related, exists := relationMap[idStr]; exists {
								relatedList = append(relatedList, related)
							}
						}
					}
					row[field.Name+"_data"] = relatedList
				}
			}
		}
	}

	return nil
}

func (s *dataService) UpdateData(modelName, id string, data map[string]interface{}, userID string) error {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return errors.New("model not found")
	}

	// 验证数据
	if err := s.validateData(model, data); err != nil {
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

	return nil
}

func (s *dataService) BatchCreate(modelName string, dataList []map[string]interface{}) ([]string, error) {
	model, err := s.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, errors.New("model not found")
	}

	// 验证所有数据
	for _, data := range dataList {
		if err := s.validateData(model, data); err != nil {
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

	// 验证所有数据
	for _, update := range updates {
		if err := s.validateData(model, update.Data); err != nil {
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

func (s *dataService) validateData(model *models.Model, data map[string]interface{}) error {
	// 不再验证必填字段,只验证字段类型
	for i := range model.Fields {
		field := &model.Fields[i]

		// 验证字段类型
		if value, exists := data[field.Name]; exists && value != nil {
			if err := s.validateFieldType(field, value); err != nil {
				return err
			}
			// 数字类型:字符串转数字
			if field.Type == "number" {
				if str, ok := value.(string); ok {
					if num, err := strconv.ParseFloat(str, 64); err == nil {
						data[field.Name] = num
					}
				}
			}
		}
	}

	return nil
}

func (s *dataService) validateFieldType(field *models.Field, value interface{}) error {
	switch field.Type {
	case "text":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("field %s must be string", field.Name)
		}
	case "number":
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
	case "bool":
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
			if err := s.validateFieldType(field, value); err != nil {
				return err
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
