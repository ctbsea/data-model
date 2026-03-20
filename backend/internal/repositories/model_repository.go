package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type ModelRepository interface {
	Create(model *models.Model) error
	GetByID(id string) (*models.Model, error)
	GetByName(name string) (*models.Model, error)
	GetByTableName(tableName string) (*models.Model, error)
	List(page, pageSize int) ([]models.Model, int64, error)
	Update(model *models.Model) error
	Delete(id string) error
}

type modelRepository struct {
	db *gorm.DB
}

func NewModelRepository() ModelRepository {
	return &modelRepository{db: utils.DB}
}

func (r *modelRepository) Create(model *models.Model) error {
	return r.db.Create(model).Error
}

func (r *modelRepository) GetByID(id string) (*models.Model, error) {
	var model models.Model
	err := r.db.Preload("Fields", "deleted = ?", false).Preload("Relations").First(&model, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *modelRepository) GetByName(name string) (*models.Model, error) {
	var model models.Model
	err := r.db.Preload("Fields", "deleted = ?", false).Preload("Relations").Where("name = ?", name).First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *modelRepository) GetByTableName(tableName string) (*models.Model, error) {
	var model models.Model
	err := r.db.Where("table_name = ?", tableName).First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *modelRepository) List(page, pageSize int) ([]models.Model, int64, error) {
	var modelList []models.Model
	var total int64

	offset := (page - 1) * pageSize
	err := r.db.Model(&models.Model{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.Preload("Fields", "deleted = ?", false).Offset(offset).Limit(pageSize).Find(&modelList).Error
	if err != nil {
		return nil, 0, err
	}

	return modelList, total, nil
}

func (r *modelRepository) Update(model *models.Model) error {
	return r.db.Save(model).Error
}

func (r *modelRepository) Delete(id string) error {
	return r.db.Delete(&models.Model{}, "id = ?", id).Error
}
