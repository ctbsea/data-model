package handlers

import (
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/services"
	"github.com/gin-gonic/gin"
)

type WorkflowHandler struct {
	workflowService  services.WorkflowService
	workflowExecutor services.WorkflowExecutor
}

func NewWorkflowHandler() *WorkflowHandler {
	return &WorkflowHandler{
		workflowService:  services.NewWorkflowService(),
		workflowExecutor: services.NewWorkflowExecutor(),
	}
}

type CreateWorkflowRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name" binding:"required"`
	Description string `json:"description"`
}

type UpdateWorkflowRequest struct {
	DisplayName   string `json:"display_name"`
	Description   string `json:"description"`
	Status        string `json:"status"`
	TriggerConfig string `json:"trigger_config"`
}

type AddNodeRequest struct {
	Type   string `json:"type" binding:"required"`
	Name   string `json:"name" binding:"required"`
	Config string `json:"config"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
}

type AddEdgeRequest struct {
	SourceNodeID string `json:"source_node_id" binding:"required"`
	TargetNodeID string `json:"target_node_id" binding:"required"`
	Condition    string `json:"condition"`
	Label        string `json:"label"`
}

type ListWorkflowsResponse struct {
	Workflows interface{} `json:"workflows"`
	Total     int64       `json:"total"`
	Page      int         `json:"page"`
	Size      int         `json:"size"`
}

func (h *WorkflowHandler) ListWorkflows(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	workflows, total, err := h.workflowService.ListWorkflows(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ListWorkflowsResponse{
		Workflows: workflows,
		Total:     total,
		Page:      page,
		Size:      pageSize,
	})
}

func (h *WorkflowHandler) CreateWorkflow(c *gin.Context) {
	var req CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	workflow, err := h.workflowService.CreateWorkflow(
		req.Name,
		req.DisplayName,
		req.Description,
		userID.(string),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, workflow)
}

func (h *WorkflowHandler) GetWorkflow(c *gin.Context) {
	id := c.Param("id")

	workflow, err := h.workflowService.GetWorkflow(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

func (h *WorkflowHandler) UpdateWorkflow(c *gin.Context) {
	id := c.Param("id")

	var req UpdateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"display_name":   req.DisplayName,
		"description":    req.Description,
		"status":         req.Status,
		"trigger_config": req.TriggerConfig,
	}

	if err := h.workflowService.UpdateWorkflow(id, updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "workflow updated successfully"})
}

func (h *WorkflowHandler) DeleteWorkflow(c *gin.Context) {
	id := c.Param("id")

	if err := h.workflowService.DeleteWorkflow(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "workflow deleted successfully"})
}

func (h *WorkflowHandler) AddNode(c *gin.Context) {
	workflowID := c.Param("id")

	var req AddNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	node := &models.WorkflowNode{
		Type:   req.Type,
		Name:   req.Name,
		Config: req.Config,
		X:      req.X,
		Y:      req.Y,
	}

	if err := h.workflowService.AddNode(workflowID, node); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, node)
}

func (h *WorkflowHandler) AddEdge(c *gin.Context) {
	workflowID := c.Param("id")

	var req AddEdgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	edge := &models.WorkflowEdge{
		SourceNodeID: req.SourceNodeID,
		TargetNodeID: req.TargetNodeID,
		Condition:    req.Condition,
		Label:        req.Label,
	}

	if err := h.workflowService.AddEdge(workflowID, edge); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, edge)
}

func (h *WorkflowHandler) ValidateWorkflow(c *gin.Context) {
	id := c.Param("id")

	if err := h.workflowService.ValidateWorkflow(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "valid": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true, "message": "workflow is valid"})
}

type StartWorkflowRequest struct {
	Input map[string]interface{} `json:"input"`
}

type CompleteTaskRequest struct {
	Output map[string]interface{} `json:"output"`
}

func (h *WorkflowHandler) StartWorkflow(c *gin.Context) {
	workflowID := c.Param("id")

	var req StartWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	instance, err := h.workflowExecutor.StartWorkflow(workflowID, req.Input, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, instance)
}

func (h *WorkflowHandler) CompleteTask(c *gin.Context) {
	instanceID := c.Param("instanceId")
	taskID := c.Param("taskId")

	var req CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.workflowExecutor.CompleteTask(instanceID, taskID, req.Output); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task completed successfully"})
}

func (h *WorkflowHandler) CancelWorkflow(c *gin.Context) {
	instanceID := c.Param("instanceId")

	if err := h.workflowExecutor.CancelWorkflow(instanceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "workflow cancelled successfully"})
}
