package handlers

import (
	"net/http"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/services"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
)

type AutomationHandler struct {
	engine services.AutomationEngine
}

func NewAutomationHandler(engine services.AutomationEngine) *AutomationHandler {
	return &AutomationHandler{engine: engine}
}

// List 获取模型的自动化列表
func (h *AutomationHandler) List(c *gin.Context) {
	modelID := c.Param("modelId")
	if modelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_id required"})
		return
	}

	var automations []models.Automation
	if err := utils.DB.Where("model_id = ?", modelID).Order("created_at DESC").Find(&automations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"automations": automations})
}

// GetByID 获取单个自动化
func (h *AutomationHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var automation models.Automation
	if err := utils.DB.First(&automation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	c.JSON(http.StatusOK, automation)
}

// Create 创建自动化
func (h *AutomationHandler) Create(c *gin.Context) {
	var req struct {
		ModelID     string `json:"model_id" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Triggers    string `json:"triggers"`
		Actions     string `json:"actions"`
		Enabled     bool   `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	automation := models.Automation{
		ModelID:     req.ModelID,
		Name:        req.Name,
		Description: req.Description,
		Triggers:    req.Triggers,
		Actions:     req.Actions,
		Enabled:     req.Enabled,
		CreatedBy:   userID.(string),
	}

	if err := utils.DB.Create(&automation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, automation)
}

// Update 更新自动化
func (h *AutomationHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var automation models.Automation
	if err := utils.DB.First(&automation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Triggers    *string `json:"triggers"`
		Actions     *string `json:"actions"`
		Enabled     *bool   `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Triggers != nil {
		updates["triggers"] = *req.Triggers
	}
	if req.Actions != nil {
		updates["actions"] = *req.Actions
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := utils.DB.Model(&automation).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	utils.DB.First(&automation, "id = ?", id)
	c.JSON(http.StatusOK, automation)
}

// Delete 删除自动化
func (h *AutomationHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := utils.DB.Delete(&models.Automation{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ListRuns 获取自动化运行记录
func (h *AutomationHandler) ListRuns(c *gin.Context) {
	id := c.Param("id")

	var runs []models.AutomationRun
	if err := utils.DB.Where("automation_id = ?", id).Order("started_at DESC").Limit(50).Find(&runs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"runs": runs})
}

// ToggleEnable 切换启用状态
func (h *AutomationHandler) ToggleEnable(c *gin.Context) {
	id := c.Param("id")

	var automation models.Automation
	if err := utils.DB.First(&automation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	if err := utils.DB.Model(&automation).Update("enabled", !automation.Enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	utils.DB.First(&automation, "id = ?", id)
	if h.engine != nil {
		h.engine.ReloadAutomation(id)
	}
	c.JSON(http.StatusOK, automation)
}
