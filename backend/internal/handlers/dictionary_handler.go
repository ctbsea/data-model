package handlers

import (
	"net/http"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DictionaryHandler struct{}

func NewDictionaryHandler() *DictionaryHandler {
	return &DictionaryHandler{}
}

type saveDictionaryItemRequest struct {
	Type    string `json:"type" binding:"required"`
	Code    string `json:"code" binding:"required"`
	Name    string `json:"name" binding:"required"`
	NameZh  string `json:"name_zh"`
	NameEn  string `json:"name_en"`
	Symbol  string `json:"symbol"`
	Icon    string `json:"icon"`
	Sort    int    `json:"sort"`
	Enabled *bool  `json:"enabled"`
}

func (h *DictionaryHandler) List(c *gin.Context) {
	dictType := c.Query("type")
	if dictType == "" {
		dictType = c.Param("type")
	}

	query := utils.DB.Model(&models.DictionaryItem{}).Order("sort ASC, code ASC")
	if dictType != "" {
		query = query.Where("type = ?", dictType)
	}
	if c.Query("all") != "true" {
		query = query.Where("enabled = ?", true)
	}

	var items []models.DictionaryItem
	if err := query.Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *DictionaryHandler) Create(c *gin.Context) {
	var req saveDictionaryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	item := models.DictionaryItem{
		ID:      uuid.New().String(),
		Type:    req.Type,
		Code:    req.Code,
		Name:    req.Name,
		NameZh:  req.NameZh,
		NameEn:  req.NameEn,
		Symbol:  req.Symbol,
		Icon:    req.Icon,
		Sort:    req.Sort,
		Enabled: enabled,
	}
	if item.NameZh == "" {
		item.NameZh = item.Name
	}
	if item.NameEn == "" {
		item.NameEn = item.Name
	}

	if err := utils.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *DictionaryHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var item models.DictionaryItem
	if err := utils.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dictionary item not found"})
		return
	}

	var req saveDictionaryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"type":    req.Type,
		"code":    req.Code,
		"name":    req.Name,
		"name_zh": req.NameZh,
		"name_en": req.NameEn,
		"symbol":  req.Symbol,
		"icon":    req.Icon,
		"sort":    req.Sort,
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := utils.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *DictionaryHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := utils.DB.Delete(&models.DictionaryItem{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
