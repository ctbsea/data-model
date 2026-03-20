package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type RoleRepository interface {
	Create(role *models.Role) error
	GetByID(id string) (*models.Role, error)
	GetByName(name string) (*models.Role, error)
	List() ([]models.Role, error)
	Update(role *models.Role) error
	Delete(id string) error
	AssignPermissions(roleID string, permissionIDs []string) error
	GetRolePermissions(roleID string) ([]models.Permission, error)
}

type roleRepository struct {
	db *gorm.DB
}

func NewRoleRepository() RoleRepository {
	return &roleRepository{db: utils.DB}
}

func (r *roleRepository) Create(role *models.Role) error {
	return r.db.Create(role).Error
}

func (r *roleRepository) GetByID(id string) (*models.Role, error) {
	var role models.Role
	err := r.db.Preload("Permissions").First(&role, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) GetByName(name string) (*models.Role, error) {
	var role models.Role
	err := r.db.Where("name = ?", name).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) List() ([]models.Role, error) {
	var roles []models.Role
	err := r.db.Preload("Permissions").Find(&roles).Error
	return roles, err
}

func (r *roleRepository) Update(role *models.Role) error {
	return r.db.Save(role).Error
}

func (r *roleRepository) Delete(id string) error {
	return r.db.Delete(&models.Role{}, "id = ?", id).Error
}

func (r *roleRepository) AssignPermissions(roleID string, permissionIDs []string) error {
	// 先删除旧的权限关联
	if err := r.db.Exec("DELETE FROM role_permissions WHERE role_id = ?", roleID).Error; err != nil {
		return err
	}

	// 添加新的权限关联
	for _, permissionID := range permissionIDs {
		if err := r.db.Exec("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", roleID, permissionID).Error; err != nil {
			return err
		}
	}

	return nil
}

func (r *roleRepository) GetRolePermissions(roleID string) ([]models.Permission, error) {
	var permissions []models.Permission
	err := r.db.Table("permissions").
		Joins("JOIN role_permissions ON permissions.id = role_permissions.permission_id").
		Where("role_permissions.role_id = ?", roleID).
		Find(&permissions).Error
	return permissions, err
}
