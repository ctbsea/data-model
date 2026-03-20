package services

import (
	"errors"
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/google/uuid"
)

type PageService interface {
	CreatePage(name, route, title, createdBy string) (*models.Page, error)
	GetPage(id string) (*models.Page, error)
	GetPageByRoute(route string) (*models.Page, error)
	ListPages(page, pageSize int) ([]models.Page, int64, error)
	UpdatePage(id string, updates map[string]interface{}) error
	DeletePage(id string) error
	ValidateRoute(route string) error
}

type pageService struct {
	pageRepo repositories.PageRepository
}

func NewPageService() PageService {
	return &pageService{
		pageRepo: repositories.NewPageRepository(),
	}
}

func (s *pageService) CreatePage(name, route, title, createdBy string) (*models.Page, error) {
	// 验证路由
	if err := s.ValidateRoute(route); err != nil {
		return nil, err
	}

	// 检查路由是否已存在
	if _, err := s.pageRepo.GetByRoute(route); err == nil {
		return nil, errors.New("route already exists")
	}

	page := &models.Page{
		ID:        uuid.New().String(),
		Name:      name,
		Route:     route,
		Title:     title,
		Components: "[]",
		CreatedBy: createdBy,
	}

	if err := s.pageRepo.Create(page); err != nil {
		return nil, fmt.Errorf("failed to create page: %w", err)
	}

	return page, nil
}

func (s *pageService) GetPage(id string) (*models.Page, error) {
	page, err := s.pageRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get page: %w", err)
	}
	return page, nil
}

func (s *pageService) GetPageByRoute(route string) (*models.Page, error) {
	page, err := s.pageRepo.GetByRoute(route)
	if err != nil {
		return nil, fmt.Errorf("failed to get page: %w", err)
	}
	return page, nil
}

func (s *pageService) ListPages(page, pageSize int) ([]models.Page, int64, error) {
	pages, total, err := s.pageRepo.List(page, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list pages: %w", err)
	}
	return pages, total, nil
}

func (s *pageService) UpdatePage(id string, updates map[string]interface{}) error {
	page, err := s.pageRepo.GetByID(id)
	if err != nil {
		return errors.New("page not found")
	}

	if name, ok := updates["name"].(string); ok {
		page.Name = name
	}
	if title, ok := updates["title"].(string); ok {
		page.Title = title
	}
	if layout, ok := updates["layout"].(string); ok {
		page.Layout = layout
	}
	if components, ok := updates["components"].(string); ok {
		page.Components = components
	}
	if permissions, ok := updates["permissions"].(string); ok {
		page.Permissions = permissions
	}

	if err := s.pageRepo.Update(page); err != nil {
		return fmt.Errorf("failed to update page: %w", err)
	}

	return nil
}

func (s *pageService) DeletePage(id string) error {
	if err := s.pageRepo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete page: %w", err)
	}
	return nil
}

func (s *pageService) ValidateRoute(route string) error {
	if route == "" {
		return errors.New("route cannot be empty")
	}
	if route[0] != '/' {
		return errors.New("route must start with /")
	}
	return nil
}
