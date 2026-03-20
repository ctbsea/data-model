package services

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type WorkflowService interface {
	CreateWorkflow(name, displayName, description, createdBy string) (*models.Workflow, error)
	GetWorkflow(id string) (*models.Workflow, error)
	ListWorkflows(page, pageSize int) ([]models.Workflow, int64, error)
	UpdateWorkflow(id string, updates map[string]interface{}) error
	DeleteWorkflow(id string) error
	AddNode(workflowID string, node *models.WorkflowNode) error
	UpdateNode(nodeID string, updates map[string]interface{}) error
	DeleteNode(nodeID string) error
	AddEdge(workflowID string, edge *models.WorkflowEdge) error
	DeleteEdge(edgeID string) error
	ValidateWorkflow(workflowID string) error
}

type workflowService struct {
	workflowRepo repositories.WorkflowRepository
}

func NewWorkflowService() WorkflowService {
	return &workflowService{
		workflowRepo: repositories.NewWorkflowRepository(),
	}
}

func (s *workflowService) CreateWorkflow(name, displayName, description, createdBy string) (*models.Workflow, error) {
	// 检查名称是否已存在
	if _, err := s.workflowRepo.GetByName(name); err == nil {
		return nil, errors.New("workflow name already exists")
	}

	workflow := &models.Workflow{
		ID:            uuid.New().String(),
		Name:          name,
		DisplayName:   displayName,
		Description:   description,
		TriggerConfig: "{}", // 默认空JSON对象
		Status:        "draft",
		CreatedBy:     createdBy,
	}

	if err := s.workflowRepo.Create(workflow); err != nil {
		return nil, fmt.Errorf("failed to create workflow: %w", err)
	}

	return workflow, nil
}

func (s *workflowService) GetWorkflow(id string) (*models.Workflow, error) {
	workflow, err := s.workflowRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow: %w", err)
	}
	return workflow, nil
}

func (s *workflowService) ListWorkflows(page, pageSize int) ([]models.Workflow, int64, error) {
	workflows, total, err := s.workflowRepo.List(page, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list workflows: %w", err)
	}
	return workflows, total, nil
}

func (s *workflowService) UpdateWorkflow(id string, updates map[string]interface{}) error {
	workflow, err := s.workflowRepo.GetByID(id)
	if err != nil {
		return errors.New("workflow not found")
	}

	if displayName, ok := updates["display_name"].(string); ok {
		workflow.DisplayName = displayName
	}
	if description, ok := updates["description"].(string); ok {
		workflow.Description = description
	}
	if status, ok := updates["status"].(string); ok {
		workflow.Status = status
	}
	if triggerConfig, ok := updates["trigger_config"].(string); ok {
		workflow.TriggerConfig = triggerConfig
	}

	if err := s.workflowRepo.Update(workflow); err != nil {
		return fmt.Errorf("failed to update workflow: %w", err)
	}

	return nil
}

func (s *workflowService) DeleteWorkflow(id string) error {
	if err := s.workflowRepo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete workflow: %w", err)
	}
	return nil
}

func (s *workflowService) AddNode(workflowID string, node *models.WorkflowNode) error {
	// 验证工作流是否存在
	if _, err := s.workflowRepo.GetByID(workflowID); err != nil {
		return errors.New("workflow not found")
	}

	node.ID = uuid.New().String()
	node.WorkflowID = workflowID

	// 如果Config为空,设置为空JSON对象
	if node.Config == "" {
		node.Config = "{}"
	}

	// 验证节点配置
	if err := s.validateNodeConfig(node); err != nil {
		return err
	}

	// 使用utils.DB直接插入节点
	if err := utils.DB.Create(node).Error; err != nil {
		return fmt.Errorf("failed to add node: %w", err)
	}

	return nil
}

func (s *workflowService) UpdateNode(nodeID string, updates map[string]interface{}) error {
	// TODO: 实现节点更新
	return errors.New("not implemented")
}

func (s *workflowService) DeleteNode(nodeID string) error {
	// TODO: 实现节点删除
	return errors.New("not implemented")
}

func (s *workflowService) AddEdge(workflowID string, edge *models.WorkflowEdge) error {
	// 验证工作流是否存在
	if _, err := s.workflowRepo.GetByID(workflowID); err != nil {
		return errors.New("workflow not found")
	}

	edge.ID = uuid.New().String()
	edge.WorkflowID = workflowID

	// 如果Condition为空,设置为空JSON对象
	if edge.Condition == "" {
		edge.Condition = "{}"
	}

	// 使用utils.DB直接插入边
	if err := utils.DB.Create(edge).Error; err != nil {
		return fmt.Errorf("failed to add edge: %w", err)
	}

	return nil
}

func (s *workflowService) DeleteEdge(edgeID string) error {
	// TODO: 实现边删除
	return errors.New("not implemented")
}

func (s *workflowService) ValidateWorkflow(workflowID string) error {
	workflow, err := s.workflowRepo.GetByID(workflowID)
	if err != nil {
		return errors.New("workflow not found")
	}

	// 检查是否有起始节点
	hasStart := false
	for _, node := range workflow.Nodes {
		if node.Type == "start" {
			hasStart = true
			break
		}
	}
	if !hasStart {
		return errors.New("workflow must have a start node")
	}

	// 检查是否有结束节点
	hasEnd := false
	for _, node := range workflow.Nodes {
		if node.Type == "end" {
			hasEnd = true
			break
		}
	}
	if !hasEnd {
		return errors.New("workflow must have an end node")
	}

	// 检查节点连接是否完整
	// TODO: 实现更复杂的图验证逻辑

	return nil
}

func (s *workflowService) validateNodeConfig(node *models.WorkflowNode) error {
	// 验证节点类型
	validTypes := map[string]bool{
		"start":    true,
		"end":      true,
		"task":     true,
		"condition": true,
		"parallel": true,
		"approval": true,
		"script":   true,
	}

	if !validTypes[node.Type] {
		return fmt.Errorf("invalid node type: %s", node.Type)
	}

	// 验证配置JSON格式
	if node.Config != "" {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return fmt.Errorf("invalid node config JSON: %w", err)
		}
	}

	return nil
}
