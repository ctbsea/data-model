package services

import (
	"errors"
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type AuthService interface {
	Register(username, email, password string) error
	Login(username, password string) (token, refreshToken string, err error)
	RefreshToken(refreshToken string) (newToken string, err error)
	GetCurrentUser(userID string) (*models.User, error)
	UpdateEmailAddress(userID, emailAddress string) error
}

type authService struct {
	userRepo repositories.UserRepository
}

func NewAuthService() AuthService {
	return &authService{
		userRepo: repositories.NewUserRepository(),
	}
}

func (s *authService) Register(username, email, password string) error {
	// 检查用户名是否已存在
	if _, err := s.userRepo.GetByUsername(username); err == nil {
		return errors.New("username already exists")
	}

	// 检查邮箱是否已存在
	if _, err := s.userRepo.GetByEmail(email); err == nil {
		return errors.New("email already exists")
	}

	// 加密密码
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 创建用户
	user := &models.User{
		ID:           uuid.New().String(),
		Username:     username,
		Email:        email,
		PasswordHash: hashedPassword,
		Status:       "active",
	}

	if err := s.userRepo.Create(user); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// 默认分配普通用户角色
	if err := s.userRepo.AssignRoles(user.ID, []string{"role_user"}); err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to assign default role: %v", err))
	}

	return nil
}

func (s *authService) Login(username, password string) (string, string, error) {
	// 查找用户
	user, err := s.userRepo.GetByUsername(username)
	if err != nil {
		return "", "", errors.New("invalid username or password")
	}

	// 验证密码
	if !utils.CheckPassword(password, user.PasswordHash) {
		return "", "", errors.New("invalid username or password")
	}

	// 检查用户状态
	if user.Status != "active" {
		return "", "", errors.New("user is not active")
	}

	// 获取用户角色
	roles := make([]string, len(user.Roles))
	for i, role := range user.Roles {
		roles[i] = role.Name
	}

	// 生成 token
	token, err := utils.GenerateToken(user.ID, roles)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	// 生成 refresh token
	refreshToken, err := utils.GenerateRefreshToken(user.ID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return token, refreshToken, nil
}

func (s *authService) RefreshToken(refreshToken string) (string, error) {
	// 解析 refresh token
	userID, err := utils.ParseRefreshToken(refreshToken)
	if err != nil {
		return "", errors.New("invalid refresh token")
	}

	// 获取用户信息
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return "", errors.New("user not found")
	}

	// 检查用户状态
	if user.Status != "active" {
		return "", errors.New("user is not active")
	}

	// 获取用户角色
	roles := make([]string, len(user.Roles))
	for i, role := range user.Roles {
		roles[i] = role.Name
	}

	// 生成新的 token
	newToken, err := utils.GenerateToken(user.ID, roles)
	if err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	return newToken, nil
}

func (s *authService) GetCurrentUser(userID string) (*models.User, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

func (s *authService) UpdateEmailAddress(userID, emailAddress string) error {
	return s.userRepo.UpdateEmailAddress(userID, emailAddress)
}
