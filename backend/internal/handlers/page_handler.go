package handlers

import (
	"net/http"
	"strconv"

	"github.com/dmdp/platform/internal/services"
	"github.com/gin-gonic/gin"
)

type PageHandler struct {
	pageService services.PageService
}

func NewPageHandler() *PageHandler {
	return &PageHandler{
		pageService: services.NewPageService(),
	}
}

type CreatePageRequest struct {
	Name  string `json:"name" binding:"required"`
	Route string `json:"route" binding:"required"`
	Title string `json:"title"`
}

type UpdatePageRequest struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Layout      string `json:"layout"`
	Components  string `json:"components"`
	Permissions string `json:"permissions"`
}

type ListPagesResponse struct {
	Pages interface{} `json:"pages"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Size  int         `json:"size"`
}

func (h *PageHandler) ListPages(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	pages, total, err := h.pageService.ListPages(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ListPagesResponse{
		Pages: pages,
		Total: total,
		Page:  page,
		Size:  pageSize,
	})
}

func (h *PageHandler) CreatePage(c *gin.Context) {
	var req CreatePageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	page, err := h.pageService.CreatePage(req.Name, req.Route, req.Title, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, page)
}

func (h *PageHandler) GetPage(c *gin.Context) {
	id := c.Param("id")

	page, err := h.pageService.GetPage(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "page not found"})
		return
	}

	c.JSON(http.StatusOK, page)
}

func (h *PageHandler) GetPageByRoute(c *gin.Context) {
	route := c.Param("route")

	page, err := h.pageService.GetPageByRoute("/" + route)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "page not found"})
		return
	}

	c.JSON(http.StatusOK, page)
}

func (h *PageHandler) UpdatePage(c *gin.Context) {
	id := c.Param("id")

	var req UpdatePageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"name":        req.Name,
		"title":       req.Title,
		"layout":      req.Layout,
		"components":  req.Components,
		"permissions": req.Permissions,
	}

	if err := h.pageService.UpdatePage(id, updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "page updated successfully"})
}

func (h *PageHandler) DeletePage(c *gin.Context) {
	id := c.Param("id")

	if err := h.pageService.DeletePage(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "page deleted successfully"})
}
