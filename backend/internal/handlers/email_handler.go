package handlers

import (
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/services"
	"github.com/gin-gonic/gin"
)

type EmailHandler struct {
	service services.EmailService
	userRepo repositories.UserRepository
}

func NewEmailHandler() *EmailHandler {
	return &EmailHandler{
		service: services.NewEmailService(),
		userRepo: repositories.NewUserRepository(),
	}
}

// SendEmail 发送邮件
func (h *EmailHandler) SendEmail(c *gin.Context) {
	var req models.SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 获取当前用户ID
	userID, _ := c.Get("userID")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	// 获取用户配置的邮件地址
	user, err := h.userRepo.GetByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	fromEmail := user.EmailAddress
	if fromEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先在邮件设置中配置您的邮件地址"})
		return
	}

	email, err := h.service.SendEmail(userID.(string), fromEmail, req.To, req.Subject, req.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, email)
}

// GetInbox 获取收件箱
func (h *EmailHandler) GetInbox(c *gin.Context) {
	// 获取当前用户ID
	userID, _ := c.Get("userID")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filterEmail := c.Query("filter_email") // 过滤发件人邮箱

	emails, total, err := h.service.GetInbox(userID.(string), page, pageSize, filterEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"emails": emails,
		"total":  total,
		"page":   page,
		"size":   pageSize,
	})
}

// GetSent 获取发件箱
func (h *EmailHandler) GetSent(c *gin.Context) {
	// 获取当前用户ID
	userID, _ := c.Get("userID")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filterEmail := c.Query("filter_email") // 过滤收件人邮箱

	emails, total, err := h.service.GetSent(userID.(string), page, pageSize, filterEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"emails": emails,
		"total":  total,
		"page":   page,
		"size":   pageSize,
	})
}

// DeleteEmail 删除邮件
func (h *EmailHandler) DeleteEmail(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteEmail(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// MarkAsRead 标记已读
func (h *EmailHandler) MarkAsRead(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.MarkAsRead(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

// GetUnreadCount 获取未读数量
func (h *EmailHandler) GetUnreadCount(c *gin.Context) {
	userID, _ := c.Get("userID")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	count, err := h.service.GetUnreadCount(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}
