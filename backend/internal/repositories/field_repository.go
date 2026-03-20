package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type FieldRepository interface {
	Create(field *models.Field) error
	GetByID(id string) (*models.Field, error)
	GetByModelID(modelID string) ([]models.Field, error)
	Update(field *models.Field) error
	Delete(id string) error
	DeleteByModelID(modelID string) error
}

type fieldRepository struct {
	db *gorm.DB
}

func NewFieldRepository() FieldRepository {
	return &fieldRepository{db: utils.DB}
}

func (r *fieldRepository) Create(field *models.Field) error {
	return r.db.Create(field).Error
}

func (r *fieldRepository) GetByID(id string) (*models.Field, error) {
	var field models.Field
	err := r.db.First(&field, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &field, nil
}

func (r *fieldRepository) GetByModelID(modelID string) ([]models.Field, error) {
	var fields []models.Field
	err := r.db.Where("model_id = ?", modelID).Order("\"order\"").Find(&fields).Error
	return fields, err
}

func (r *fieldRepository) Update(field *models.Field) error {
	return r.db.Save(field).Error
}

func (r *fieldRepository) Delete(id string) error {
	return r.db.Delete(&models.Field{}, "id = ?", id).Error
}

func (r *fieldRepository) DeleteByModelID(modelID string) error {
	return r.db.Delete(&models.Field{}, "model_id = ?", modelID).Error
}
