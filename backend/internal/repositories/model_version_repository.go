package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type ModelVersionRepository interface {
	Create(version *models.ModelVersion) error
	GetByModelID(modelID string) ([]models.ModelVersion, error)
	GetByVersion(modelID string, version int) (*models.ModelVersion, error)
	GetLatestVersion(modelID string) (*models.ModelVersion, error)
}

type modelVersionRepository struct {
	db *gorm.DB
}

func NewModelVersionRepository() ModelVersionRepository {
	return &modelVersionRepository{db: utils.DB}
}

func (r *modelVersionRepository) Create(version *models.ModelVersion) error {
	return r.db.Create(version).Error
}

func (r *modelVersionRepository) GetByModelID(modelID string) ([]models.ModelVersion, error) {
	var versions []models.ModelVersion
	err := r.db.Where("model_id = ?", modelID).Order("version DESC").Find(&versions).Error
	return versions, err
}

func (r *modelVersionRepository) GetByVersion(modelID string, version int) (*models.ModelVersion, error) {
	var modelVersion models.ModelVersion
	err := r.db.Where("model_id = ? AND version = ?", modelID, version).First(&modelVersion).Error
	if err != nil {
		return nil, err
	}
	return &modelVersion, nil
}

func (r *modelVersionRepository) GetLatestVersion(modelID string) (*models.ModelVersion, error) {
	var version models.ModelVersion
	err := r.db.Where("model_id = ?", modelID).Order("version DESC").First(&version).Error
	if err != nil {
		return nil, err
	}
	return &version, nil
}
