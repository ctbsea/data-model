package models

import "time"

type Email struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id" gorm:"type:varchar(64);index"` // 用户ID
	From      string    `json:"from" gorm:"type:varchar(255)"`
	To        string    `json:"to" gorm:"type:varchar(255)"`
	Subject   string    `json:"subject" gorm:"type:varchar(500)"`
	Body      string    `json:"body" gorm:"type:text"`
	Status    string    `json:"status" gorm:"type:varchar(20)"` // sent, received, draft
	IsRead    bool      `json:"is_read" gorm:"default:false"`   // 已读/未读
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SendEmailRequest struct {
	To      string `json:"to" binding:"required,email"`
	Subject string `json:"subject" binding:"required"`
	Body    string `json:"body" binding:"required"`
}
