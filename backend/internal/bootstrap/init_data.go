package bootstrap

import (
	"fmt"
	"log"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// InitDefaultData 初始化默认数据
func InitDefaultData() error {
	// 初始化默认管理员账号
	if err := initDefaultAdmin(); err != nil {
		return fmt.Errorf("failed to init default admin: %w", err)
	}

	// 初始化默认角色
	if err := initDefaultRoles(); err != nil {
		return fmt.Errorf("failed to init default roles: %w", err)
	}

	// 初始化默认权限
	if err := initDefaultPermissions(); err != nil {
		return fmt.Errorf("failed to init default permissions: %w", err)
	}

	if err := initDefaultDictionaries(); err != nil {
		return fmt.Errorf("failed to init default dictionaries: %w", err)
	}

	return nil
}

// initDefaultAdmin 初始化默认管理员账号
func initDefaultAdmin() error {
	userRepo := repositories.NewUserRepository()

	// 检查admin账号是否已存在
	_, err := userRepo.GetByUsername("admin")
	if err == nil {
		utils.Logger.Info("Admin account already exists")
		return nil
	}

	// 创建admin账号
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	admin := &models.User{
		ID:           uuid.New().String(),
		Username:     "admin",
		Email:        "admin@dmdp.com",
		PasswordHash: string(hashedPassword),
		Nickname:     "系统管理员",
		Status:       "active",
	}

	if err := userRepo.Create(admin); err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	utils.Logger.Info("Default admin account created successfully")
	log.Println("====================================")
	log.Println("Default Admin Account:")
	log.Println("Username: admin")
	log.Println("Password: admin123")
	log.Println("====================================")

	return nil
}

// initDefaultRoles 初始化默认角色
func initDefaultRoles() error {
	roleRepo := repositories.NewRoleRepository()

	// 检查是否已存在角色
	roles, err := roleRepo.List()
	if err != nil {
		return err
	}

	if len(roles) > 0 {
		utils.Logger.Info("Roles already exist")
		return nil
	}

	// 创建默认角色
	defaultRoles := []struct {
		Name        string
		DisplayName string
	}{
		{
			Name:        "super_admin",
			DisplayName: "超级管理员",
		},
		{
			Name:        "admin",
			DisplayName: "管理员",
		},
		{
			Name:        "user",
			DisplayName: "普通用户",
		},
	}

	for _, roleData := range defaultRoles {
		role := &models.Role{
			ID:          uuid.New().String(),
			Name:        roleData.Name,
			DisplayName: roleData.DisplayName,
		}

		if err := roleRepo.Create(role); err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create role %s: %v", roleData.Name, err))
			continue
		}

		utils.Logger.Info(fmt.Sprintf("Role %s created successfully", roleData.Name))
	}

	// 为admin用户分配超级管理员角色
	userRepo := repositories.NewUserRepository()
	admin, err := userRepo.GetByUsername("admin")
	if err == nil {
		superAdminRole, err := roleRepo.GetByName("super_admin")
		if err == nil {
			// 分配角色
			if err := userRepo.AssignRoles(admin.ID, []string{superAdminRole.ID}); err != nil {
				utils.Logger.Error(fmt.Sprintf("Failed to assign super_admin role to admin: %v", err))
			} else {
				utils.Logger.Info("Super admin role assigned to admin user")
			}
		}
	}

	return nil
}

// initDefaultPermissions 初始化默认权限
func initDefaultPermissions() error {
	roleRepo := repositories.NewRoleRepository()

	// 检查是否已存在权限
	roles, err := roleRepo.List()
	if err != nil {
		return err
	}

	// 检查第一个角色的权限
	if len(roles) > 0 {
		perms, err := roleRepo.GetRolePermissions(roles[0].ID)
		if err == nil && len(perms) > 0 {
			utils.Logger.Info("Permissions already exist")
			return nil
		}
	}

	// 创建默认权限
	defaultPermissions := []struct {
		Name        string
		DisplayName string
		Resource    string
		Action      string
	}{
		// 用户管理权限
		{Name: "user_list", DisplayName: "用户列表", Resource: "user", Action: "list"},
		{Name: "user_create", DisplayName: "创建用户", Resource: "user", Action: "create"},
		{Name: "user_update", DisplayName: "编辑用户", Resource: "user", Action: "update"},
		{Name: "user_delete", DisplayName: "删除用户", Resource: "user", Action: "delete"},

		// 角色管理权限
		{Name: "role_list", DisplayName: "角色列表", Resource: "role", Action: "list"},
		{Name: "role_create", DisplayName: "创建角色", Resource: "role", Action: "create"},
		{Name: "role_update", DisplayName: "编辑角色", Resource: "role", Action: "update"},
		{Name: "role_delete", DisplayName: "删除角色", Resource: "role", Action: "delete"},

		// 模型管理权限
		{Name: "model_list", DisplayName: "模型列表", Resource: "model", Action: "list"},
		{Name: "model_create", DisplayName: "创建模型", Resource: "model", Action: "create"},
		{Name: "model_update", DisplayName: "编辑模型", Resource: "model", Action: "update"},
		{Name: "model_delete", DisplayName: "删除模型", Resource: "model", Action: "delete"},
		{Name: "model_apply", DisplayName: "应用模型", Resource: "model", Action: "apply"},

		// 数据管理权限
		{Name: "data_list", DisplayName: "数据列表", Resource: "data", Action: "list"},
		{Name: "data_create", DisplayName: "创建数据", Resource: "data", Action: "create"},
		{Name: "data_update", DisplayName: "编辑数据", Resource: "data", Action: "update"},
		{Name: "data_delete", DisplayName: "删除数据", Resource: "data", Action: "delete"},

		// 页面管理权限
		{Name: "page_list", DisplayName: "页面列表", Resource: "page", Action: "list"},
		{Name: "page_create", DisplayName: "创建页面", Resource: "page", Action: "create"},
		{Name: "page_update", DisplayName: "编辑页面", Resource: "page", Action: "update"},
		{Name: "page_delete", DisplayName: "删除页面", Resource: "page", Action: "delete"},
	}

	// 创建权限
	var permissionIDs []string
	for _, permData := range defaultPermissions {
		// 检查权限是否已存在
		var existingPerm models.Permission
		if err := utils.DB.Where("name = ?", permData.Name).First(&existingPerm).Error; err == nil {
			// 权限已存在,跳过
			permissionIDs = append(permissionIDs, existingPerm.ID)
			utils.Logger.Info(fmt.Sprintf("Permission %s already exists, skipping", permData.Name))
			continue
		}

		permission := &models.Permission{
			ID:          uuid.New().String(),
			Name:        permData.Name,
			DisplayName: permData.DisplayName,
			Resource:    permData.Resource,
			Action:      permData.Action,
		}

		// 直接插入数据库
		if err := utils.DB.Create(permission).Error; err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create permission %s: %v", permData.Name, err))
			continue
		}

		permissionIDs = append(permissionIDs, permission.ID)
		utils.Logger.Info(fmt.Sprintf("Permission %s created successfully", permData.Name))
	}

	// 为超级管理员角色分配所有权限
	superAdminRole, err := roleRepo.GetByName("super_admin")
	if err == nil {
		if err := roleRepo.AssignPermissions(superAdminRole.ID, permissionIDs); err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to assign permissions to super_admin: %v", err))
		} else {
			utils.Logger.Info("All permissions assigned to super_admin role")
		}
	}

	return nil
}

func initDefaultDictionaries() error {
	if err := utils.EnsureDictionaryItemsTable(); err != nil {
		return fmt.Errorf("failed to ensure dictionary items table: %w", err)
	}

	items := []models.DictionaryItem{
		{Type: "currency", Code: "CNY", Name: "人民币", NameZh: "人民币", NameEn: "Chinese Yuan", Symbol: "¥", Sort: 1, Enabled: true},
		{Type: "currency", Code: "USD", Name: "美元", NameZh: "美元", NameEn: "US Dollar", Symbol: "$", Sort: 2, Enabled: true},
		{Type: "currency", Code: "EUR", Name: "欧元", NameZh: "欧元", NameEn: "Euro", Symbol: "€", Sort: 3, Enabled: true},
		{Type: "currency", Code: "GBP", Name: "英镑", NameZh: "英镑", NameEn: "British Pound", Symbol: "£", Sort: 4, Enabled: true},
		{Type: "currency", Code: "JPY", Name: "日元", NameZh: "日元", NameEn: "Japanese Yen", Symbol: "¥", Sort: 5, Enabled: true},
		{Type: "currency", Code: "HKD", Name: "港币", NameZh: "港币", NameEn: "Hong Kong Dollar", Symbol: "HK$", Sort: 6, Enabled: true},
		{Type: "country", Code: "CN", Name: "中国", NameZh: "中国", NameEn: "China", Icon: "🇨🇳", Sort: 1, Enabled: true},
		{Type: "country", Code: "US", Name: "美国", NameZh: "美国", NameEn: "United States", Icon: "🇺🇸", Sort: 2, Enabled: true},
		{Type: "country", Code: "GB", Name: "英国", NameZh: "英国", NameEn: "United Kingdom", Icon: "🇬🇧", Sort: 3, Enabled: true},
		{Type: "country", Code: "JP", Name: "日本", NameZh: "日本", NameEn: "Japan", Icon: "🇯🇵", Sort: 4, Enabled: true},
		{Type: "country", Code: "DE", Name: "德国", NameZh: "德国", NameEn: "Germany", Icon: "🇩🇪", Sort: 5, Enabled: true},
		{Type: "country", Code: "FR", Name: "法国", NameZh: "法国", NameEn: "France", Icon: "🇫🇷", Sort: 6, Enabled: true},
	}

	for _, item := range items {
		var existing models.DictionaryItem
		if err := utils.DB.Where("type = ? AND code = ?", item.Type, item.Code).First(&existing).Error; err == nil {
			continue
		}
		item.ID = uuid.New().String()
		if err := utils.DB.Create(&item).Error; err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create dictionary %s/%s: %v", item.Type, item.Code, err))
		}
	}
	return nil
}
