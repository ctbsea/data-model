package services

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type ModelService interface {
	CreateModel(name, displayName, description, createdBy string) (*models.Model, error)
	GetModel(id string) (*models.Model, error)
	GetModelByName(name string) (*models.Model, error)
	ListModels(page, pageSize int) ([]models.Model, int64, error)
	UpdateModel(id string, updates map[string]interface{}) error
	DeleteModel(id string) error
	
	AddField(modelID string, field *models.Field) error
	UpdateField(modelID, fieldID string, field *models.Field) error
	DeleteField(modelID, fieldID string) error
	
	AddRelation(modelID string, relation *models.Relation) error
	UpdateRelation(modelID, relationID string, relation *models.Relation) error
	DeleteRelation(modelID, relationID string) error
	
	ApplyModel(modelID string) error
}

type modelService struct {
	modelRepo      repositories.ModelRepository
	fieldRepo      repositories.FieldRepository
	relationRepo   repositories.RelationRepository
	versionRepo    repositories.ModelVersionRepository
	schemaManager  SchemaManager
}

func NewModelService() ModelService {
	return &modelService{
		modelRepo:     repositories.NewModelRepository(),
		fieldRepo:     repositories.NewFieldRepository(),
		relationRepo:  repositories.NewRelationRepository(),
		versionRepo:   repositories.NewModelVersionRepository(),
		schemaManager: NewSchemaManager(),
	}
}

func (s *modelService) CreateModel(name, displayName, description, createdBy string) (*models.Model, error) {
	// 检查模型名称是否已存在
	if _, err := s.modelRepo.GetByName(name); err == nil {
		return nil, errors.New("model name already exists")
	}

	tableName := fmt.Sprintf("data_%s", name)
	model := &models.Model{
		ID:          uuid.New().String(),
		Name:        name,
		DisplayName: displayName,
		Description: description,
		TableName:   tableName,
		Version:     1,
		Status:      "draft",
		CreatedBy:   createdBy,
	}

	if err := s.modelRepo.Create(model); err != nil {
		return nil, fmt.Errorf("failed to create model: %w", err)
	}

	return model, nil
}

func (s *modelService) GetModel(id string) (*models.Model, error) {
	model, err := s.modelRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return model, nil
}

func (s *modelService) GetModelByName(name string) (*models.Model, error) {
	model, err := s.modelRepo.GetByName(name)
	if err != nil {
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return model, nil
}

func (s *modelService) ListModels(page, pageSize int) ([]models.Model, int64, error) {
	models, total, err := s.modelRepo.List(page, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list models: %w", err)
	}
	return models, total, nil
}

func (s *modelService) UpdateModel(id string, updates map[string]interface{}) error {
	model, err := s.modelRepo.GetByID(id)
	if err != nil {
		return errors.New("model not found")
	}

	if displayName, ok := updates["display_name"].(string); ok {
		model.DisplayName = displayName
	}
	if description, ok := updates["description"].(string); ok {
		model.Description = description
	}
	if status, ok := updates["status"].(string); ok {
		model.Status = status
	}

	if err := s.modelRepo.Update(model); err != nil {
		return fmt.Errorf("failed to update model: %w", err)
	}

	return nil
}

func (s *modelService) DeleteModel(id string) error {
	model, err := s.modelRepo.GetByID(id)
	if err != nil {
		return errors.New("model not found")
	}

	// 删除关联的字段和关系
	if err := s.fieldRepo.DeleteByModelID(model.ID); err != nil {
		return fmt.Errorf("failed to delete fields: %w", err)
	}
	if err := s.relationRepo.DeleteByModelID(model.ID); err != nil {
		return fmt.Errorf("failed to delete relations: %w", err)
	}

	// 删除模型
	if err := s.modelRepo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete model: %w", err)
	}

	return nil
}

func (s *modelService) AddField(modelID string, field *models.Field) error {
	model, err := s.modelRepo.GetByID(modelID)
	if err != nil {
		return errors.New("model not found")
	}

	field.ID = uuid.New().String()
	field.ModelID = model.ID

	if err := s.fieldRepo.Create(field); err != nil {
		return fmt.Errorf("failed to add field: %w", err)
	}

	// 如果模型已应用,则使用ALTER TABLE添加新字段
	if model.Status == "applied" {
		fieldType := MapFieldTypeToSQL(field.Type)
		alterSQL := fmt.Sprintf("ALTER TABLE `%s` ADD COLUMN `%s` %s", model.TableName, field.Name, fieldType)
		
		// 如果有默认值,添加DEFAULT子句
		if field.DefaultValue != "" {
			alterSQL += fmt.Sprintf(" DEFAULT '%s'", field.DefaultValue)
		} else {
			// 根据字段类型设置不同的默认值
			if field.Type == "date" {
				// 日期字段使用NULL
				alterSQL += " NULL"
			} else {
				// 其他字段使用NULL默认值
				alterSQL += " DEFAULT NULL"
			}
		}
		
		if err := utils.DB.Exec(alterSQL).Error; err != nil {
			return fmt.Errorf("failed to add column: %w", err)
		}
	}

	return nil
}

func (s *modelService) UpdateField(modelID, fieldID string, field *models.Field) error {
	existingField, err := s.fieldRepo.GetByID(fieldID)
	if err != nil {
		return errors.New("field not found")
	}

	if existingField.ModelID != modelID {
		return errors.New("field does not belong to this model")
	}

	// 只更新非零值字段
	if field.Name != "" {
		existingField.Name = field.Name
	}
	if field.DisplayName != "" {
		existingField.DisplayName = field.DisplayName
	}
	if field.Type != "" {
		existingField.Type = field.Type
	}
	// 布尔值需要特殊处理，因为零值也是有效值
	existingField.Required = field.Required
	existingField.Unique = field.Unique
	existingField.IsLock = field.IsLock
	existingField.Deleted = field.Deleted
	
	if field.DefaultValue != "" {
		existingField.DefaultValue = field.DefaultValue
	}
	if field.Options != "" && field.Options != "[]" {
		existingField.Options = field.Options
	}
	if field.Validation != "" && field.Validation != "{}" {
		existingField.Validation = field.Validation
	}
	if field.RelationConfig != "" && field.RelationConfig != "{}" {
		existingField.RelationConfig = field.RelationConfig
	}
	if field.Order != 0 {
		existingField.Order = field.Order
	}

	if err := s.fieldRepo.Update(existingField); err != nil {
		return fmt.Errorf("failed to update field: %w", err)
	}

	return nil
}

func (s *modelService) DeleteField(modelID, fieldID string) error {
	field, err := s.fieldRepo.GetByID(fieldID)
	if err != nil {
		return errors.New("field not found")
	}

	if field.ModelID != modelID {
		return errors.New("field does not belong to this model")
	}

	if err := s.fieldRepo.Delete(fieldID); err != nil {
		return fmt.Errorf("failed to delete field: %w", err)
	}

	return nil
}

func (s *modelService) AddRelation(modelID string, relation *models.Relation) error {
	model, err := s.modelRepo.GetByID(modelID)
	if err != nil {
		return errors.New("model not found")
	}

	relation.ID = uuid.New().String()
	relation.ModelID = model.ID

	if err := s.relationRepo.Create(relation); err != nil {
		return fmt.Errorf("failed to add relation: %w", err)
	}

	return nil
}

func (s *modelService) UpdateRelation(modelID, relationID string, relation *models.Relation) error {
	existingRelation, err := s.relationRepo.GetByID(relationID)
	if err != nil {
		return errors.New("relation not found")
	}

	if existingRelation.ModelID != modelID {
		return errors.New("relation does not belong to this model")
	}

	relation.ID = existingRelation.ID
	relation.ModelID = existingRelation.ModelID

	if err := s.relationRepo.Update(relation); err != nil {
		return fmt.Errorf("failed to update relation: %w", err)
	}

	return nil
}

func (s *modelService) DeleteRelation(modelID, relationID string) error {
	relation, err := s.relationRepo.GetByID(relationID)
	if err != nil {
		return errors.New("relation not found")
	}

	if relation.ModelID != modelID {
		return errors.New("relation does not belong to this model")
	}

	if err := s.relationRepo.Delete(relationID); err != nil {
		return fmt.Errorf("failed to delete relation: %w", err)
	}

	return nil
}

func (s *modelService) ApplyModel(modelID string) error {
	model, err := s.modelRepo.GetByID(modelID)
	if err != nil {
		return errors.New("model not found")
	}

	// 创建版本记录
	schema, err := json.Marshal(model)
	if err != nil {
		return fmt.Errorf("failed to marshal model schema: %w", err)
	}

	version := &models.ModelVersion{
		ID:        uuid.New().String(),
		ModelID:   model.ID,
		Version:   model.Version,
		Schema:    string(schema),
		ChangeLog: "Model applied",
		CreatedBy: model.CreatedBy,
	}

	if err := s.versionRepo.Create(version); err != nil {
		return fmt.Errorf("failed to create version: %w", err)
	}

	// 更新模型状态
	model.Status = "applied"
	if err := s.modelRepo.Update(model); err != nil {
		return fmt.Errorf("failed to update model status: %w", err)
	}

	return nil
}
