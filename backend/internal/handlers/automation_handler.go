package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

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

func generateToken() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
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
		ModelID:      req.ModelID,
		Name:         req.Name,
		Description:  req.Description,
		Triggers:     req.Triggers,
		Actions:      req.Actions,
		Enabled:      req.Enabled,
		WebhookToken: generateToken(),
		CreatedBy:    userID.(string),
	}

	if err := utils.DB.Create(&automation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if automation.Enabled && h.engine != nil {
		h.engine.ReloadAutomation(automation.ID)
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
	if h.engine != nil {
		h.engine.ReloadAutomation(id)
	}
	c.JSON(http.StatusOK, automation)
}

// Delete 删除自动化
func (h *AutomationHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	if h.engine != nil {
		h.engine.ReloadAutomation(id) // removes cron entry before delete
	}

	if err := utils.DB.Delete(&models.Automation{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
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

// RegenerateWebhookToken 重新生成 webhook token
func (h *AutomationHandler) RegenerateWebhookToken(c *gin.Context) {
	id := c.Param("id")

	var automation models.Automation
	if err := utils.DB.First(&automation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	newToken := generateToken()
	if err := utils.DB.Model(&automation).Update("webhook_token", newToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"webhook_token": newToken})
}

// ListRuns 获取自动化运行记录
func (h *AutomationHandler) ListRuns(c *gin.Context) {
	id := c.Param("id")
	limit := 50
	status := c.Query("status") // optional filter: success | failed | running

	query := utils.DB.Where("automation_id = ?", id).Order("started_at DESC").Limit(limit)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var runs []models.AutomationRun
	if err := query.Find(&runs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"runs": runs})
}

// GetStats 获取自动化统计数据
func (h *AutomationHandler) GetStats(c *gin.Context) {
	id := c.Param("id")

	var automation models.Automation
	if err := utils.DB.First(&automation, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "automation not found"})
		return
	}

	// last 7 days daily breakdown
	type DayStat struct {
		Date         string `json:"date"`
		SuccessCount int    `json:"success_count"`
		FailCount    int    `json:"fail_count"`
	}

	var dailyStats []DayStat
	utils.DB.Raw(`
		SELECT
			DATE(started_at) as date,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count
		FROM automation_runs
		WHERE automation_id = ? AND started_at >= ?
		GROUP BY DATE(started_at)
		ORDER BY date ASC
	`, id, time.Now().AddDate(0, 0, -7)).Scan(&dailyStats)

	// avg duration
	var avgDuration float64
	utils.DB.Raw(`
		SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000), 0)
		FROM automation_runs
		WHERE automation_id = ? AND status = 'success' AND completed_at IS NOT NULL
	`, id).Scan(&avgDuration)

	// last run
	var lastRun models.AutomationRun
	utils.DB.Where("automation_id = ?", id).Order("started_at DESC").First(&lastRun)

	c.JSON(http.StatusOK, gin.H{
		"run_count":     automation.RunCount,
		"success_count": automation.SuccessCount,
		"fail_count":    automation.FailCount,
		"avg_duration_ms": avgDuration,
		"daily_stats":   dailyStats,
		"last_run":      lastRun,
	})
}

// WebhookTrigger 外部 webhook 触发（公开路由，无需 JWT）
func (h *AutomationHandler) WebhookTrigger(c *gin.Context) {
	token := c.Param("token")

	var payload map[string]interface{}
	// payload is optional
	_ = c.ShouldBindJSON(&payload)
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["_source"] = "webhook"

	if err := h.engine.TriggerWebhook(token, payload); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "triggered"})
}
