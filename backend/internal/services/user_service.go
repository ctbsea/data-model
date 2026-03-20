package services

import (
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type UserService interface {
	CreateUser(username, email, password, nickname string) (*models.User, error)
	GetUser(id string) (*models.User, error)
	ListUsers(page, pageSize int) ([]models.User, int64, error)
	UpdateUser(id string, updates map[string]interface{}) error
	DeleteUser(id string) error
	AssignRoles(userID string, roleIDs []string) error
}

type userService struct {
	userRepo repositories.UserRepository
}

func NewUserService() UserService {
	return &userService{
		userRepo: repositories.NewUserRepository(),
	}
}

func (s *userService) CreateUser(username, email, password, nickname string) (*models.User, error) {
	// 检查用户名是否已存在
	if _, err := s.userRepo.GetByUsername(username); err == nil {
		return nil, fmt.Errorf("username already exists")
	}

	// 检查邮箱是否已存在
	if _, err := s.userRepo.GetByEmail(email); err == nil {
		return nil, fmt.Errorf("email already exists")
	}

	// 加密密码
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 创建用户
	user := &models.User{
		ID:           uuid.New().String(),
		Username:     username,
		Email:        email,
		PasswordHash: hashedPassword,
		Nickname:     nickname,
		Status:       "active",
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *userService) GetUser(id string) (*models.User, error) {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

func (s *userService) ListUsers(page, pageSize int) ([]models.User, int64, error) {
	users, total, err := s.userRepo.List(page, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}
	return users, total, nil
}

func (s *userService) UpdateUser(id string, updates map[string]interface{}) error {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// 更新字段
	if nickname, ok := updates["nickname"].(string); ok {
		user.Nickname = nickname
	}
	if avatar, ok := updates["avatar"].(string); ok {
		user.Avatar = avatar
	}
	if status, ok := updates["status"].(string); ok {
		user.Status = status
	}

	if err := s.userRepo.Update(user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

func (s *userService) DeleteUser(id string) error {
	if err := s.userRepo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

func (s *userService) AssignRoles(userID string, roleIDs []string) error {
	if err := s.userRepo.AssignRoles(userID, roleIDs); err != nil {
		return fmt.Errorf("failed to assign roles: %w", err)
	}
	return nil
}
