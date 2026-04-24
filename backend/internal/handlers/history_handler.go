package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type HistoryHandler struct {
	db *gorm.DB
}

func NewHistoryHandler(db *gorm.DB) *HistoryHandler {
	return &HistoryHandler{db: db}
}

// HistoryRecord 历史记录响应结构
type HistoryRecord struct {
	ID        string      `json:"id"`
	ChangedAt string      `json:"changed_at"`
	User      UserInfo    `json:"user"`
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}

// UserInfo 用户信息
type UserInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Avatar   string `json:"avatar"`
}

// GetHistory 获取记录的变更历史
func (h *HistoryHandler) GetHistory(c *gin.Context) {
	modelName := c.Param("model_name")
	recordID := c.Param("record_id")
	
	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 查询总数
	var total int64
	h.db.Model(&models.ChangeLog{}).Where("model_name = ? AND row_id = ?", modelName, recordID).Count(&total)

	// 查询变更日志（分页 + 倒序）
	var changeLogs []models.ChangeLog
	offset := (page - 1) * pageSize
	if err := h.db.Where("model_name = ? AND row_id = ?", modelName, recordID).
		Order("changed_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&changeLogs).Error; err != nil {
		utils.Logger.Error(fmt.Sprintf("Failed to get history: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取历史记录失败"})
		return
	}

	// 批量获取用户信息
	userIDs := make([]string, 0)
	userMap := make(map[string]models.User)
	for _, log := range changeLogs {
		if log.ChangedBy != "" {
			if _, exists := userMap[log.ChangedBy]; !exists {
				userIDs = append(userIDs, log.ChangedBy)
			}
		}
	}

	if len(userIDs) > 0 {
		var users []models.User
		h.db.Where("id IN ?", userIDs).Find(&users)
		for _, user := range users {
			userMap[user.ID] = user
		}
	}

	// 获取字段配置用于显示字段名称
	var fields []models.Field
	h.db.Where("model_id = (SELECT id FROM models WHERE name = ?)", modelName).Find(&fields)
	fieldMap := make(map[string]models.Field)
	for _, field := range fields {
		fieldMap[field.Name] = field
	}

	// 转换为响应格式
	result := make([]HistoryRecord, 0, len(changeLogs))
	for _, log := range changeLogs {
		user := UserInfo{
			ID:     log.ChangedBy,
			Name:   "未知用户",
			Avatar: "",
		}
		if u, ok := userMap[log.ChangedBy]; ok {
			user.Name = u.Nickname
			if user.Name == "" {
				user.Name = u.Username
			}
			user.Avatar = u.Avatar
		}

		// 使用字段的显示名称
		fieldName := log.FieldName
		if field, ok := fieldMap[log.FieldName]; ok {
			fieldName = field.DisplayName
		}

		// 解析 JSON 字符串为原始值
		var oldValue, newValue interface{}
		if log.OldValue != "" {
			json.Unmarshal([]byte(log.OldValue), &oldValue)
		}
		if log.NewValue != "" {
			json.Unmarshal([]byte(log.NewValue), &newValue)
		}

		result = append(result, HistoryRecord{
			ID:        log.ID,
			ChangedAt: log.ChangedAt.Format("2006/01/02 15:04:05"),
			User:      user,
			FieldName: fieldName,
			OldValue:  oldValue,
			NewValue:  newValue,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  result,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}
