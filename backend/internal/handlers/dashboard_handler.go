package handlers

import (
	"net/http"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	db *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

type SaveDashboardRequest struct {
	Name   string `json:"name" binding:"required"`
	Config string `json:"config"`
}

// SaveDashboard 保存仪表盘配置
func (h *DashboardHandler) SaveDashboard(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req SaveDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 查找是否已存在仪表盘
	var dashboard models.Dashboard
	result := h.db.Where("user_id = ?", userID).First(&dashboard)

	if result.Error == gorm.ErrRecordNotFound {
		// 创建新仪表盘
		dashboard = models.Dashboard{
			ID:     uuid.New().String(),
			UserID: userID.(string),
			Name:   req.Name,
			Config: req.Config,
		}
		if err := h.db.Create(&dashboard).Error; err != nil {
			utils.Logger.Error("Failed to create dashboard: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
			return
		}
	} else {
		// 更新现有仪表盘
		dashboard.Name = req.Name
		dashboard.Config = req.Config
		if err := h.db.Save(&dashboard).Error; err != nil {
			utils.Logger.Error("Failed to update dashboard: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
			return
		}
	}

	c.JSON(http.StatusOK, dashboard)
}

// GetDashboard 获取仪表盘配置
func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	userID, _ := c.Get("userID")

	var dashboard models.Dashboard
	result := h.db.Where("user_id = ?", userID).First(&dashboard)

	if result.Error == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, dashboard)
}
