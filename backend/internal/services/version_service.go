package services

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
)

type VersionService interface {
	CreateVersion(modelID, schema, changeLog, createdBy string) error
	GetVersionHistory(modelID string) ([]models.ModelVersion, error)
	RollbackToVersion(modelID string, version int) error
}

type versionService struct {
	versionRepo repositories.ModelVersionRepository
	modelRepo   repositories.ModelRepository
}

func NewVersionService() VersionService {
	return &versionService{
		versionRepo: repositories.NewModelVersionRepository(),
		modelRepo:   repositories.NewModelRepository(),
	}
}

func (s *versionService) CreateVersion(modelID, schema, changeLog, createdBy string) error {
	// 获取最新版本号
	latestVersion, err := s.versionRepo.GetLatestVersion(modelID)
	newVersion := 1
	if err == nil {
		newVersion = latestVersion.Version + 1
	}

	version := &models.ModelVersion{
		ID:        generateUUID(),
		ModelID:   modelID,
		Version:   newVersion,
		Schema:    schema,
		ChangeLog: changeLog,
		CreatedBy: createdBy,
	}

	if err := s.versionRepo.Create(version); err != nil {
		return fmt.Errorf("failed to create version: %w", err)
	}

	return nil
}

func (s *versionService) GetVersionHistory(modelID string) ([]models.ModelVersion, error) {
	versions, err := s.versionRepo.GetByModelID(modelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get version history: %w", err)
	}
	return versions, nil
}

func (s *versionService) RollbackToVersion(modelID string, version int) error {
	// 获取指定版本
	modelVersion, err := s.versionRepo.GetByVersion(modelID, version)
	if err != nil {
		return errors.New("version not found")
	}

	// 解析模型定义
	var model models.Model
	if err := json.Unmarshal([]byte(modelVersion.Schema), &model); err != nil {
		return fmt.Errorf("failed to parse model schema: %w", err)
	}

	// 获取当前模型
	currentModel, err := s.modelRepo.GetByID(modelID)
	if err != nil {
		return errors.New("model not found")
	}

	// 使用SchemaManager重建表
	schemaManager := NewSchemaManager()
	if err := schemaManager.AlterTable(&model, currentModel); err != nil {
		return fmt.Errorf("failed to rollback table: %w", err)
	}

	// 更新模型
	model.ID = currentModel.ID
	model.Version = currentModel.Version + 1
	model.Status = "rolled_back"
	
	if err := s.modelRepo.Update(&model); err != nil {
		return fmt.Errorf("failed to update model: %w", err)
	}

	// 创建新版本记录
	schema, _ := json.Marshal(model)
	if err := s.CreateVersion(modelID, string(schema), 
		fmt.Sprintf("Rolled back to version %d", version), 
		modelVersion.CreatedBy); err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to create version record: %v", err))
	}

	return nil
}

func generateUUID() string {
	return fmt.Sprintf("%d", utils.DB.NowFunc().UnixNano())
}
