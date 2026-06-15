package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
)

type EmailRepository interface {
	Create(email *models.Email) error
	GetByID(id string) (*models.Email, error)
	ListInbox(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error)
	ListSent(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error)
	Delete(id string) error
	MarkAsRead(id string) error
	GetUnreadCount(userID string) (int64, error)
}

type emailRepository struct{}

func NewEmailRepository() EmailRepository {
	return &emailRepository{}
}

func (r *emailRepository) Create(email *models.Email) error {
	return utils.DB.Create(email).Error
}

func (r *emailRepository) GetByID(id string) (*models.Email, error) {
	var email models.Email
	if err := utils.DB.Where("id = ?", id).First(&email).Error; err != nil {
		return nil, err
	}
	return &email, nil
}

func (r *emailRepository) ListInbox(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error) {
	var emails []models.Email
	var total int64

	// 收件箱：查询to字段等于用户邮件地址的邮件
	var user models.User
	if err := utils.DB.First(&user, "id = ?", userID).Error; err != nil {
		return nil, 0, err
	}

	db := utils.DB.Model(&models.Email{}).Where("\"to\" = ?", user.EmailAddress)
	// 如果有过滤邮箱，过滤发件人
	if filterEmail != "" {
		db = db.Where("\"from\" = ?", filterEmail)
	}
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&emails).Error; err != nil {
		return nil, 0, err
	}

	return emails, total, nil
}

func (r *emailRepository) ListSent(userID string, page, pageSize int, filterEmail string) ([]models.Email, int64, error) {
	var emails []models.Email
	var total int64

	// 发件箱：查询from字段等于用户邮件地址的邮件
	var user models.User
	if err := utils.DB.First(&user, "id = ?", userID).Error; err != nil {
		return nil, 0, err
	}

	db := utils.DB.Model(&models.Email{}).Where("\"from\" = ?", user.EmailAddress)
	// 如果有过滤邮箱，过滤收件人
	if filterEmail != "" {
		db = db.Where("\"to\" = ?", filterEmail)
	}
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&emails).Error; err != nil {
		return nil, 0, err
	}

	return emails, total, nil
}

func (r *emailRepository) Delete(id string) error {
	return utils.DB.Where("id = ?", id).Delete(&models.Email{}).Error
}

func (r *emailRepository) MarkAsRead(id string) error {
	return utils.DB.Model(&models.Email{}).Where("id = ?", id).Update("is_read", true).Error
}

func (r *emailRepository) GetUnreadCount(userID string) (int64, error) {
	var count int64
	var user models.User
	if err := utils.DB.First(&user, "id = ?", userID).Error; err != nil {
		return 0, err
	}
	if err := utils.DB.Model(&models.Email{}).Where("\"to\" = ? AND is_read = ?", user.EmailAddress, false).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
