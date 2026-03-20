package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type PageRepository interface {
	Create(page *models.Page) error
	GetByID(id string) (*models.Page, error)
	GetByRoute(route string) (*models.Page, error)
	List(page, pageSize int) ([]models.Page, int64, error)
	Update(page *models.Page) error
	Delete(id string) error
}

type pageRepository struct {
	db *gorm.DB
}

func NewPageRepository() PageRepository {
	return &pageRepository{db: utils.DB}
}

func (r *pageRepository) Create(page *models.Page) error {
	return r.db.Create(page).Error
}

func (r *pageRepository) GetByID(id string) (*models.Page, error) {
	var page models.Page
	err := r.db.First(&page, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &page, nil
}

func (r *pageRepository) GetByRoute(route string) (*models.Page, error) {
	var page models.Page
	err := r.db.Where("route = ?", route).First(&page).Error
	if err != nil {
		return nil, err
	}
	return &page, nil
}

func (r *pageRepository) List(page, pageSize int) ([]models.Page, int64, error) {
	var pages []models.Page
	var total int64

	offset := (page - 1) * pageSize
	err := r.db.Model(&models.Page{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.Offset(offset).Limit(pageSize).Find(&pages).Error
	if err != nil {
		return nil, 0, err
	}

	return pages, total, nil
}

func (r *pageRepository) Update(page *models.Page) error {
	return r.db.Save(page).Error
}

func (r *pageRepository) Delete(id string) error {
	return r.db.Delete(&models.Page{}, "id = ?", id).Error
}
