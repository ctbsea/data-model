package handlers

import (
	"net/http"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ViewConfigHandler struct {
	db *gorm.DB
}

func NewViewConfigHandler(db *gorm.DB) *ViewConfigHandler {
	return &ViewConfigHandler{db: db}
}

type SaveViewConfigRequest struct {
	ModelName     string `json:"model_name" binding:"required"`
	ViewType      string `json:"view_type" binding:"required"`
	Filters       string `json:"filters"`
	Sorts         string `json:"sorts"`
	ColumnWidths  string `json:"column_widths"`
	FrozenColumns int    `json:"frozen_columns"`
	VisibleFields string `json:"visible_fields"`
	CalendarStart string `json:"calendar_start"`
	CalendarEnd   string `json:"calendar_end"`
}

// SaveViewConfig 保存视图配置
func (h *ViewConfigHandler) SaveViewConfig(c *gin.Context) {
	userID, _ := c.Get("userID")
	
	var req SaveViewConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 查找是否已存在配置
	var config models.ViewConfig
	result := h.db.Where("user_id = ? AND model_name = ? AND view_type = ?", 
		userID, req.ModelName, req.ViewType).First(&config)

	if result.Error == gorm.ErrRecordNotFound {
		// 创建新配置
		config = models.ViewConfig{
			ID:            uuid.New().String(),
			UserID:        userID.(string),
			ModelName:     req.ModelName,
			ViewType:      req.ViewType,
			Filters:       req.Filters,
			Sorts:         req.Sorts,
			ColumnWidths:  req.ColumnWidths,
			FrozenColumns: req.FrozenColumns,
			VisibleFields: req.VisibleFields,
			CalendarStart: req.CalendarStart,
			CalendarEnd:   req.CalendarEnd,
		}
		if err := h.db.Create(&config).Error; err != nil {
			utils.Logger.Error("Failed to create view config: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
			return
		}
	} else {
		// 更新现有配置
		config.Filters = req.Filters
		config.Sorts = req.Sorts
		config.ColumnWidths = req.ColumnWidths
		config.FrozenColumns = req.FrozenColumns
		config.VisibleFields = req.VisibleFields
		config.CalendarStart = req.CalendarStart
		config.CalendarEnd = req.CalendarEnd
		if err := h.db.Save(&config).Error; err != nil {
			utils.Logger.Error("Failed to update view config: " + err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
			return
		}
	}

	c.JSON(http.StatusOK, config)
}

// GetViewConfig 获取视图配置
func (h *ViewConfigHandler) GetViewConfig(c *gin.Context) {
	userID, _ := c.Get("userID")
	modelName := c.Query("model_name")
	viewType := c.Query("view_type")

	if modelName == "" || viewType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少参数"})
		return
	}

	var config models.ViewConfig
	result := h.db.Where("user_id = ? AND model_name = ? AND view_type = ?", 
		userID, modelName, viewType).First(&config)

	if result.Error == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, config)
}
