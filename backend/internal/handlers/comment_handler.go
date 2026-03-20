package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommentHandler struct {
	db *gorm.DB
}

func NewCommentHandler(db *gorm.DB) *CommentHandler {
	return &CommentHandler{db: db}
}

// GetComments 获取某条记录的评论列表
func (h *CommentHandler) GetComments(c *gin.Context) {
	modelName := c.Param("model_name")
	recordID := c.Param("record_id")

	var comments []models.Comment
	if err := h.db.Where("model_name = ? AND record_id = ?", modelName, recordID).
		Order("created_at desc").
		Find(&comments).Error; err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to get comments: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取评论失败"})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// CreateComment 创建评论
func (h *CommentHandler) CreateComment(c *gin.Context) {
	var req struct {
		ModelName string `json:"model_name" binding:"required"`
		RecordID  string `json:"record_id" binding:"required"`
		Content   string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 获取当前用户信息
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	var user models.User
	userName := "用户"
	if err := h.db.First(&user, "id = ?", userID).Error; err == nil {
		userName = user.Nickname
	}

	comment := models.Comment{
		ID:        uuid.New().String(),
		ModelName: req.ModelName,
		RecordID:  req.RecordID,
		UserID:    userID.(string),
		UserName:  userName,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}

	if err := h.db.Create(&comment).Error; err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to create comment: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建评论失败"})
		return
	}

	// 更新评论统计
	h.db.Model(&models.CommentCount{}).
		Where("model_name = ? AND record_id = ?", req.ModelName, req.RecordID).
		Updates(map[string]interface{}{
			"count":      gorm.Expr("count + 1"),
			"updated_at": time.Now(),
		})
	
	// 如果记录不存在则创建
	var cc models.CommentCount
	if err := h.db.Where("model_name = ? AND record_id = ?", req.ModelName, req.RecordID).First(&cc).Error; err == gorm.ErrRecordNotFound {
		h.db.Create(&models.CommentCount{
			ModelName: req.ModelName,
			RecordID:  req.RecordID,
			Count:     1,
			UpdatedAt: time.Now(),
		})
	}

	c.JSON(http.StatusOK, comment)
}

// DeleteComment 删除评论
func (h *CommentHandler) DeleteComment(c *gin.Context) {
	commentID := c.Param("id")

	// 获取当前用户ID
	userID, _ := c.Get("userID")

	// 检查评论是否存在且属于当前用户
	var comment models.Comment
	if err := h.db.First(&comment, "id = ?", commentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "评论不存在"})
		return
	}

	if comment.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此评论"})
		return
	}

	if err := h.db.Delete(&comment).Error; err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to delete comment: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除评论失败"})
		return
	}

	// 更新评论统计
	h.db.Model(&models.CommentCount{}).
		Where("model_name = ? AND record_id = ? AND count > 0", comment.ModelName, comment.RecordID).
		Updates(map[string]interface{}{
			"count":      gorm.Expr("count - 1"),
			"updated_at": time.Now(),
		})

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// GetCommentCounts 批量获取评论数量（从统计表）
func (h *CommentHandler) GetCommentCounts(c *gin.Context) {
	modelName := c.Query("model_name")
	recordIDs := c.Query("record_ids") // 逗号分隔的record_id列表

	if modelName == "" || recordIDs == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 解析record_ids
	ids := []string{}
	for _, id := range splitString(recordIDs, ",") {
		if id != "" {
			ids = append(ids, id)
		}
	}

	if len(ids) == 0 {
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	// 从统计表查询
	var counts []models.CommentCount
	h.db.Where("model_name = ? AND record_id IN ?", modelName, ids).Find(&counts)

	// 转换为map
	result := make(map[string]int)
	for _, c := range counts {
		result[c.RecordID] = c.Count
	}

	c.JSON(http.StatusOK, result)
}

func splitString(s, sep string) []string {
	result := []string{}
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || string(s[i]) == sep {
			if i > start {
				result = append(result, s[start:i])
			}
			start = i + 1
		}
	}
	return result
}
