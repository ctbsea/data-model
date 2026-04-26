package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/services"
	"github.com/gin-gonic/gin"
)

type DataHandler struct {
	dataService services.DataService
}

func NewDataHandler(engine services.AutomationEngine) *DataHandler {
	return &DataHandler{
		dataService: services.NewDataService(engine),
	}
}

type BatchOperationRequest struct {
	Operation string                   `json:"operation" binding:"required"` // create, update, delete
	Data      []map[string]interface{} `json:"data"`
	IDs       []string                 `json:"ids"`
	Updates   []repositories.BatchUpdateItem `json:"updates"`
}

func (h *DataHandler) ListData(c *gin.Context) {
	modelName := c.Param("modelName")
	
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	
	req := &services.ListDataRequest{
		Page:     page,
		PageSize: pageSize,
		Filter:   make(map[string]interface{}),
	}

	// 解析过滤条件
	if filterStr := c.Query("filter"); filterStr != "" {
		var filter map[string]interface{}
		if err := json.Unmarshal([]byte(filterStr), &filter); err == nil {
			req.Filter = filter
		}
	}

	// 解析排序
	if sortsStr := c.Query("sorts"); sortsStr != "" {
		var sorts []services.SortField
		if err := json.Unmarshal([]byte(sortsStr), &sorts); err == nil {
			req.Sort = sorts
		}
	}

	response, err := h.dataService.ListData(modelName, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *DataHandler) GetData(c *gin.Context) {
	modelName := c.Param("modelName")
	id := c.Param("id")

	data, err := h.dataService.GetData(modelName, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "data not found"})
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *DataHandler) CreateData(c *gin.Context) {
	modelName := c.Param("modelName")

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := h.dataService.CreateData(modelName, data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "data created successfully",
	})
}

func (h *DataHandler) UpdateData(c *gin.Context) {
	modelName := c.Param("modelName")
	id := c.Param("id")

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 获取当前用户ID
	userID, _ := c.Get("userID")

	if err := h.dataService.UpdateData(modelName, id, data, userID.(string)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "data updated successfully"})
}

func (h *DataHandler) DeleteData(c *gin.Context) {
	modelName := c.Param("modelName")
	id := c.Param("id")

	if err := h.dataService.DeleteData(modelName, id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "data deleted successfully"})
}

func (h *DataHandler) AggregateData(c *gin.Context) {
	modelName := c.Param("modelName")

	req := &services.AggregateRequest{
		GroupBy:     c.Query("group_by"),
		TimeField:   c.Query("time_field"),
		Granularity: c.Query("granularity"),
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil {
			req.Limit = v
		}
	}

	if metricsStr := c.Query("metrics"); metricsStr != "" {
		var metrics []repositories.MetricOption
		if err := json.Unmarshal([]byte(metricsStr), &metrics); err == nil {
			req.Metrics = metrics
		}
	}

	if filterStr := c.Query("filter"); filterStr != "" {
		var filter map[string]interface{}
		if err := json.Unmarshal([]byte(filterStr), &filter); err == nil {
			req.Filter = filter
		}
	}

	if sortsStr := c.Query("sorts"); sortsStr != "" {
		var sorts []services.SortField
		if err := json.Unmarshal([]byte(sortsStr), &sorts); err == nil {
			req.Sort = sorts
		}
	}

	result, err := h.dataService.AggregateData(modelName, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *DataHandler) BatchOperation(c *gin.Context) {
	modelName := c.Param("modelName")

	var req BatchOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	switch req.Operation {
	case "create":
		ids, err := h.dataService.BatchCreate(modelName, req.Data)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"ids":      ids,
			"message":  "batch create successfully",
			"count":    len(ids),
		})

	case "update":
		// 获取当前用户ID
		userID, _ := c.Get("userID")
		if err := h.dataService.BatchUpdate(modelName, req.Updates, userID.(string)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "batch update successfully",
			"count":   len(req.Updates),
		})

	case "delete":
		if err := h.dataService.BatchDelete(modelName, req.IDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "batch delete successfully",
			"count":   len(req.IDs),
		})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid operation"})
	}
}
