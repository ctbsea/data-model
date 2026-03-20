package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/services"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
)

type ModelHandler struct {
	modelService   services.ModelService
	versionService services.VersionService
	schemaManager  services.SchemaManager
}

func NewModelHandler() *ModelHandler {
	return &ModelHandler{
		modelService:   services.NewModelService(),
		versionService: services.NewVersionService(),
		schemaManager:  services.NewSchemaManager(),
	}
}

type CreateModelRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name" binding:"required"`
	Description string `json:"description"`
}

type UpdateModelRequest struct {
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type AddFieldRequest struct {
	Name           string `json:"name" binding:"required"`
	DisplayName    string `json:"display_name" binding:"required"`
	Type           string `json:"type" binding:"required"`
	Required       bool   `json:"required"`
	Unique         bool   `json:"unique"`
	DefaultValue   string `json:"default_value"`
	Options        string `json:"options"`
	Validation     string `json:"validation"`
	RelationConfig string `json:"relation_config"`
	IsLock         bool   `json:"is_lock"`
	Order          int    `json:"order"`
	Deleted        bool   `json:"deleted"`
}

type UpdateFieldRequest struct {
	Name           string `json:"name"`
	DisplayName    string `json:"display_name"`
	Type           string `json:"type"`
	Required       bool   `json:"required"`
	Unique         bool   `json:"unique"`
	DefaultValue   string `json:"default_value"`
	Options        string `json:"options"`
	Validation     string `json:"validation"`
	RelationConfig string `json:"relation_config"`
	IsLock         bool   `json:"is_lock"`
	Order          int    `json:"order"`
	Deleted        bool   `json:"deleted"`
}

type AddRelationRequest struct {
	Name          string `json:"name" binding:"required"`
	Type          string `json:"type" binding:"required"`
	TargetModelID string `json:"target_model_id" binding:"required"`
	ForeignKey    string `json:"foreign_key"`
	JunctionTable string `json:"junction_table"`
	CascadeDelete bool   `json:"cascade_delete"`
}

type ListModelsResponse struct {
	Models interface{} `json:"models"`
	Total  int64       `json:"total"`
	Page   int         `json:"page"`
	Size   int         `json:"size"`
}

func (h *ModelHandler) ListModels(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	models, total, err := h.modelService.ListModels(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ListModelsResponse{
		Models: models,
		Total:  total,
		Page:   page,
		Size:   pageSize,
	})
}

func (h *ModelHandler) CreateModel(c *gin.Context) {
	var req CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	model, err := h.modelService.CreateModel(req.Name, req.DisplayName, req.Description, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, model)
}

func (h *ModelHandler) GetModel(c *gin.Context) {
	id := c.Param("id")

	model, err := h.modelService.GetModel(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model not found"})
		return
	}

	c.JSON(http.StatusOK, model)
}

func (h *ModelHandler) UpdateModel(c *gin.Context) {
	id := c.Param("id")

	var req UpdateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"display_name": req.DisplayName,
		"description":  req.Description,
		"status":       req.Status,
	}

	if err := h.modelService.UpdateModel(id, updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model updated successfully"})
}

func (h *ModelHandler) DeleteModel(c *gin.Context) {
	id := c.Param("id")

	if err := h.modelService.DeleteModel(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model deleted successfully"})
}

func (h *ModelHandler) ApplyModel(c *gin.Context) {
	id := c.Param("id")

	model, err := h.modelService.GetModel(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model not found"})
		return
	}

	// 创建数据库表
	if err := h.schemaManager.CreateTable(model); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 应用模型
	if err := h.modelService.ApplyModel(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model applied successfully"})
}

func (h *ModelHandler) GetModelVersions(c *gin.Context) {
	id := c.Param("id")

	versions, err := h.versionService.GetVersionHistory(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, versions)
}

func (h *ModelHandler) RollbackModel(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Version int `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.versionService.RollbackToVersion(id, req.Version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "model rolled back successfully"})
}

func (h *ModelHandler) AddField(c *gin.Context) {
	modelID := c.Param("id")

	var req AddFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 添加日志查看接收到的数据
	utils.Logger.Info(fmt.Sprintf("AddField request: Name=%s, Type=%s, Options=%s", req.Name, req.Type, req.Options))

	// 处理Validation字段,确保是有效的JSON
	validation := req.Validation
	if validation == "" {
		validation = "{}"
	}

	// 处理Options字段,确保是有效的JSON
	options := req.Options
	if options == "" {
		options = "[]"
	}

	// 处理RelationConfig字段,确保是有效的JSON
	relationConfig := req.RelationConfig
	if relationConfig == "" {
		relationConfig = "{}"
	}

	field := &models.Field{
		Name:           req.Name,
		DisplayName:    req.DisplayName,
		Type:           req.Type,
		Required:       req.Required,
		Unique:         req.Unique,
		DefaultValue:   req.DefaultValue,
		Options:        options,
		Validation:     validation,
		RelationConfig: relationConfig,
		IsLock:         req.IsLock,
		Order:          req.Order,
		Deleted:        false,
	}

	if err := h.modelService.AddField(modelID, field); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, field)
}

func (h *ModelHandler) UpdateField(c *gin.Context) {
	modelID := c.Param("id")
	fieldID := c.Param("fieldId")

	var req UpdateFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 处理Validation字段,确保是有效的JSON
	validation := req.Validation
	if validation == "" {
		validation = "{}"
	}

	// 处理Options字段,确保是有效的JSON
	options := req.Options
	if options == "" {
		options = "[]"
	}

	// 处理RelationConfig字段,确保是有效的JSON
	relationConfig := req.RelationConfig
	if relationConfig == "" {
		relationConfig = "{}"
	}

	field := &models.Field{
		Name:           req.Name,
		DisplayName:    req.DisplayName,
		Type:           req.Type,
		Required:       req.Required,
		Unique:         req.Unique,
		DefaultValue:   req.DefaultValue,
		Options:        options,
		Validation:     validation,
		RelationConfig: relationConfig,
		IsLock:         req.IsLock,
		Order:          req.Order,
		Deleted:        req.Deleted,
	}

	if err := h.modelService.UpdateField(modelID, fieldID, field); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "field updated successfully"})
}

func (h *ModelHandler) DeleteField(c *gin.Context) {
	modelID := c.Param("id")
	fieldID := c.Param("fieldId")

	if err := h.modelService.DeleteField(modelID, fieldID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "field deleted successfully"})
}

func (h *ModelHandler) AddRelation(c *gin.Context) {
	modelID := c.Param("id")

	var req AddRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	relation := &models.Relation{
		Name:          req.Name,
		Type:          req.Type,
		TargetModelID: req.TargetModelID,
		ForeignKey:    req.ForeignKey,
		JunctionTable: req.JunctionTable,
		CascadeDelete: req.CascadeDelete,
	}

	if err := h.modelService.AddRelation(modelID, relation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, relation)
}

func (h *ModelHandler) UpdateRelation(c *gin.Context) {
	modelID := c.Param("id")
	relationID := c.Param("relationId")

	var req AddRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	relation := &models.Relation{
		Name:          req.Name,
		Type:          req.Type,
		TargetModelID: req.TargetModelID,
		ForeignKey:    req.ForeignKey,
		JunctionTable: req.JunctionTable,
		CascadeDelete: req.CascadeDelete,
	}

	if err := h.modelService.UpdateRelation(modelID, relationID, relation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "relation updated successfully"})
}

func (h *ModelHandler) DeleteRelation(c *gin.Context) {
	modelID := c.Param("id")
	relationID := c.Param("relationId")

	if err := h.modelService.DeleteRelation(modelID, relationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "relation deleted successfully"})
}
