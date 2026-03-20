package services

import (
	"errors"
	"time"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/google/uuid"
)

type EmailService interface {
	SendEmail(userID, from, to, subject, body string) (*models.Email, error)
	GetInbox(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error)
	GetSent(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error)
	DeleteEmail(id string) error
	MarkAsRead(id string) error
	GetUnreadCount(userID string) (int64, error)
}

type emailService struct {
	repo repositories.EmailRepository
}

func NewEmailService() EmailService {
	return &emailService{
		repo: repositories.NewEmailRepository(),
	}
}

func (s *emailService) SendEmail(userID, from, to, subject, body string) (*models.Email, error) {
	if from == "" || to == "" {
		return nil, errors.New("from and to email are required")
	}

	email := &models.Email{
		ID:        uuid.New().String(),
		UserID:    userID,
		From:      from,
		To:        to,
		Subject:   subject,
		Body:      body,
		Status:    "sent",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.Create(email); err != nil {
		return nil, err
	}

	// 模拟发送邮件（实际项目中应调用SMTP服务）
	// 这里只是保存记录，实际发送需要配置SMTP

	return email, nil
}

func (s *emailService) GetInbox(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error) {
	return s.repo.ListInbox(userID, page, pageSize, filterEmail)
}

func (s *emailService) GetSent(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error) {
	return s.repo.ListSent(userID, page, pageSize, filterEmail)
}

func (s *emailService) DeleteEmail(id string) error {
	return s.repo.Delete(id)
}

func (s *emailService) MarkAsRead(id string) error {
	return s.repo.MarkAsRead(id)
}

func (s *emailService) GetUnreadCount(userID string) (int64, error) {
	return s.repo.GetUnreadCount(userID)
}
