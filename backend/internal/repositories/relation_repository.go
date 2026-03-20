package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type RelationRepository interface {
	Create(relation *models.Relation) error
	GetByID(id string) (*models.Relation, error)
	GetByModelID(modelID string) ([]models.Relation, error)
	Update(relation *models.Relation) error
	Delete(id string) error
	DeleteByModelID(modelID string) error
}

type relationRepository struct {
	db *gorm.DB
}

func NewRelationRepository() RelationRepository {
	return &relationRepository{db: utils.DB}
}

func (r *relationRepository) Create(relation *models.Relation) error {
	return r.db.Create(relation).Error
}

func (r *relationRepository) GetByID(id string) (*models.Relation, error) {
	var relation models.Relation
	err := r.db.First(&relation, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &relation, nil
}

func (r *relationRepository) GetByModelID(modelID string) ([]models.Relation, error) {
	var relations []models.Relation
	err := r.db.Where("model_id = ?", modelID).Find(&relations).Error
	return relations, err
}

func (r *relationRepository) Update(relation *models.Relation) error {
	return r.db.Save(relation).Error
}

func (r *relationRepository) Delete(id string) error {
	return r.db.Delete(&models.Relation{}, "id = ?", id).Error
}

func (r *relationRepository) DeleteByModelID(modelID string) error {
	return r.db.Delete(&models.Relation{}, "model_id = ?", modelID).Error
}
