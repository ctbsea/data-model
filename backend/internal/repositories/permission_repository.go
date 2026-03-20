package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type PermissionRepository interface {
	Create(permission *models.Permission) error
	GetByID(id string) (*models.Permission, error)
	List() ([]models.Permission, error)
	Delete(id string) error
}

type permissionRepository struct {
	db *gorm.DB
}

func NewPermissionRepository() PermissionRepository {
	return &permissionRepository{db: utils.DB}
}

func (r *permissionRepository) Create(permission *models.Permission) error {
	return r.db.Create(permission).Error
}

func (r *permissionRepository) GetByID(id string) (*models.Permission, error) {
	var permission models.Permission
	err := r.db.First(&permission, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &permission, nil
}

func (r *permissionRepository) List() ([]models.Permission, error) {
	var permissions []models.Permission
	err := r.db.Find(&permissions).Error
	return permissions, err
}

func (r *permissionRepository) Delete(id string) error {
	return r.db.Delete(&models.Permission{}, "id = ?", id).Error
}
