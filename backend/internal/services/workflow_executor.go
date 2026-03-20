package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/repositories"
	"github.com/dmdp/platform/internal/utils"
	"github.com/google/uuid"
)

type WorkflowExecutor interface {
	StartWorkflow(workflowID string, input map[string]interface{}, userID string) (*models.WorkflowInstance, error)
	ExecuteNode(instanceID string, nodeID string) error
	CompleteTask(instanceID string, taskID string, output map[string]interface{}) error
	CancelWorkflow(instanceID string) error
	GetNextNodes(workflowID string, currentNodeID string) ([]models.WorkflowNode, error)
}

type workflowExecutor struct {
	workflowRepo         repositories.WorkflowRepository
	instanceRepo         repositories.WorkflowInstanceRepository
}

func NewWorkflowExecutor() WorkflowExecutor {
	return &workflowExecutor{
		workflowRepo: repositories.NewWorkflowRepository(),
		instanceRepo: repositories.NewWorkflowInstanceRepository(),
	}
}

// StartWorkflow 启动工作流
func (e *workflowExecutor) StartWorkflow(workflowID string, input map[string]interface{}, userID string) (*models.WorkflowInstance, error) {
	// 获取工作流定义
	workflow, err := e.workflowRepo.GetByID(workflowID)
	if err != nil {
		return nil, errors.New("workflow not found")
	}

	// 检查工作流状态
	if workflow.Status != "published" {
		return nil, errors.New("workflow is not published")
	}

	// 查找起始节点
	var startNode *models.WorkflowNode
	for _, node := range workflow.Nodes {
		if node.Type == "start" {
			startNode = &node
			break
		}
	}

	if startNode == nil {
		return nil, errors.New("no start node found")
	}

	// 创建工作流实例
	inputJSON, _ := json.Marshal(input)
	instance := &models.WorkflowInstance{
		ID:          uuid.New().String(),
		WorkflowID:  workflowID,
		Status:      "running",
		Input:       string(inputJSON),
		CurrentNode: startNode.ID,
		StartedBy:   userID,
		StartedAt:   time.Now(),
	}

	if err := e.instanceRepo.Create(instance); err != nil {
		return nil, fmt.Errorf("failed to create workflow instance: %w", err)
	}

	// 执行起始节点
	if err := e.ExecuteNode(instance.ID, startNode.ID); err != nil {
		// 如果执行失败,更新实例状态
		instance.Status = "failed"
		instance.Error = err.Error()
		e.instanceRepo.Update(instance)
		return nil, err
	}

	return instance, nil
}

// ExecuteNode 执行节点
func (e *workflowExecutor) ExecuteNode(instanceID string, nodeID string) error {
	// 获取工作流实例
	instance, err := e.instanceRepo.GetByID(instanceID)
	if err != nil {
		return errors.New("workflow instance not found")
	}

	// 获取工作流定义
	workflow, err := e.workflowRepo.GetByID(instance.WorkflowID)
	if err != nil {
		return errors.New("workflow not found")
	}

	// 查找当前节点
	var currentNode *models.WorkflowNode
	for i := range workflow.Nodes {
		if workflow.Nodes[i].ID == nodeID {
			currentNode = &workflow.Nodes[i]
			break
		}
	}

	if currentNode == nil {
		return errors.New("node not found")
	}

	// 更新实例当前节点
	instance.CurrentNode = nodeID
	e.instanceRepo.Update(instance)

	// 根据节点类型执行不同的逻辑
	switch currentNode.Type {
	case "start":
		// 起始节点,直接进入下一个节点
		return e.moveToNextNodes(instance, workflow, currentNode)

	case "end":
		// 结束节点,完成工作流
		instance.Status = "completed"
		now := time.Now()
		instance.CompletedAt = &now
		e.instanceRepo.Update(instance)
		utils.Logger.Info(fmt.Sprintf("Workflow instance %s completed", instanceID))
		return nil

	case "task":
		// 任务节点,创建待办任务
		return e.executeTaskNode(instance, currentNode)

	case "condition":
		// 条件节点,根据条件选择分支
		return e.executeConditionNode(instance, workflow, currentNode)

	case "parallel":
		// 并行节点,同时执行多个分支
		return e.executeParallelNode(instance, workflow, currentNode)

	case "approval":
		// 审批节点,创建审批任务
		return e.executeApprovalNode(instance, currentNode)

	case "script":
		// 脚本节点,执行脚本
		return e.executeScriptNode(instance, currentNode)

	default:
		return fmt.Errorf("unknown node type: %s", currentNode.Type)
	}
}

// moveToNextNodes 移动到下一个节点
func (e *workflowExecutor) moveToNextNodes(instance *models.WorkflowInstance, workflow *models.Workflow, currentNode *models.WorkflowNode) error {
	nextNodes, err := e.GetNextNodes(workflow.ID, currentNode.ID)
	if err != nil {
		return err
	}

	if len(nextNodes) == 0 {
		return errors.New("no next node found")
	}

	// 如果只有一个下一个节点,直接执行
	if len(nextNodes) == 1 {
		return e.ExecuteNode(instance.ID, nextNodes[0].ID)
	}

	// 多个下一个节点,需要条件判断(在condition节点处理)
	return errors.New("multiple next nodes without condition")
}

// executeTaskNode 执行任务节点
func (e *workflowExecutor) executeTaskNode(instance *models.WorkflowInstance, node *models.WorkflowNode) error {
	// 解析任务配置
	var config struct {
		TaskName string `json:"task_name"`
		Assignee string `json:"assignee"`
	}

	if node.Config != "" {
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return fmt.Errorf("invalid task config: %w", err)
		}
	}

	// 创建任务记录
	task := &models.WorkflowTask{
		ID:         uuid.New().String(),
		InstanceID: instance.ID,
		NodeID:     node.ID,
		Name:       config.TaskName,
		Assignee:   config.Assignee,
		Status:     "pending",
		CreatedAt:  time.Now(),
	}

	// 保存任务
	if err := utils.DB.Create(task).Error; err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	utils.Logger.Info(fmt.Sprintf("Task %s created for instance %s", task.ID, instance.ID))
	return nil
}

// executeConditionNode 执行条件节点
func (e *workflowExecutor) executeConditionNode(instance *models.WorkflowInstance, workflow *models.Workflow, node *models.WorkflowNode) error {
	// 解析条件配置
	var config struct {
		Expression string `json:"expression"`
	}

	if node.Config != "" {
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return fmt.Errorf("invalid condition config: %w", err)
		}
	}

	// 获取下一个节点
	nextNodes, err := e.GetNextNodes(workflow.ID, node.ID)
	if err != nil {
		return err
	}

	// TODO: 实现条件表达式求值
	// 这里简化处理,选择第一个下一个节点
	if len(nextNodes) > 0 {
		return e.ExecuteNode(instance.ID, nextNodes[0].ID)
	}

	return errors.New("no next node found for condition")
}

// executeParallelNode 执行并行节点
func (e *workflowExecutor) executeParallelNode(instance *models.WorkflowInstance, workflow *models.Workflow, node *models.WorkflowNode) error {
	// 获取所有下一个节点
	nextNodes, err := e.GetNextNodes(workflow.ID, node.ID)
	if err != nil {
		return err
	}

	// 并行执行所有分支
	for _, nextNode := range nextNodes {
		// 创建新的实例来执行并行分支
		parallelInstance := &models.WorkflowInstance{
			ID:          uuid.New().String(),
			WorkflowID:  workflow.ID,
			ParentID:    &instance.ID,
			Status:      "running",
			Input:       instance.Input,
			CurrentNode: nextNode.ID,
			StartedBy:   instance.StartedBy,
			StartedAt:   time.Now(),
		}

		if err := e.instanceRepo.Create(parallelInstance); err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create parallel instance: %v", err))
			continue
		}

		// 异步执行分支
		go e.ExecuteNode(parallelInstance.ID, nextNode.ID)
	}

	return nil
}

// executeApprovalNode 执行审批节点
func (e *workflowExecutor) executeApprovalNode(instance *models.WorkflowInstance, node *models.WorkflowNode) error {
	// 解析审批配置
	var config struct {
		Approvers []string `json:"approvers"`
		Mode      string   `json:"mode"` // or, and
	}

	if node.Config != "" {
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return fmt.Errorf("invalid approval config: %w", err)
		}
	}

	// 为每个审批人创建审批任务
	for _, approver := range config.Approvers {
		task := &models.WorkflowTask{
			ID:         uuid.New().String(),
			InstanceID: instance.ID,
			NodeID:     node.ID,
			Name:       "审批任务",
			Assignee:   approver,
			Type:       "approval",
			Status:     "pending",
			CreatedAt:  time.Now(),
		}

		if err := utils.DB.Create(task).Error; err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create approval task: %v", err))
			continue
		}
	}

	return nil
}

// executeScriptNode 执行脚本节点
func (e *workflowExecutor) executeScriptNode(instance *models.WorkflowInstance, node *models.WorkflowNode) error {
	// 解析脚本配置
	var config struct {
		Script string `json:"script"`
	}

	if node.Config != "" {
		if err := json.Unmarshal([]byte(node.Config), &config); err != nil {
			return fmt.Errorf("invalid script config: %w", err)
		}
	}

	// TODO: 实现脚本执行引擎
	// 这里简化处理,直接进入下一个节点
	workflow, _ := e.workflowRepo.GetByID(instance.WorkflowID)
	return e.moveToNextNodes(instance, workflow, node)
}

// CompleteTask 完成任务
func (e *workflowExecutor) CompleteTask(instanceID string, taskID string, output map[string]interface{}) error {
	// 获取任务
	var task models.WorkflowTask
	if err := utils.DB.First(&task, "id = ?", taskID).Error; err != nil {
		return errors.New("task not found")
	}

	// 检查任务状态
	if task.Status != "pending" {
		return errors.New("task is not pending")
	}

	// 更新任务状态
	outputJSON, _ := json.Marshal(output)
	task.Status = "completed"
	task.Output = string(outputJSON)
	now := time.Now()
	task.CompletedAt = &now

	if err := utils.DB.Save(&task).Error; err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}

	// 获取工作流实例
	instance, err := e.instanceRepo.GetByID(instanceID)
	if err != nil {
		return errors.New("workflow instance not found")
	}

	// 获取工作流定义
	workflow, err := e.workflowRepo.GetByID(instance.WorkflowID)
	if err != nil {
		return errors.New("workflow not found")
	}

	// 查找当前节点
	var currentNode *models.WorkflowNode
	for i := range workflow.Nodes {
		if workflow.Nodes[i].ID == task.NodeID {
			currentNode = &workflow.Nodes[i]
			break
		}
	}

	// 移动到下一个节点
	return e.moveToNextNodes(instance, workflow, currentNode)
}

// CancelWorkflow 取消工作流
func (e *workflowExecutor) CancelWorkflow(instanceID string) error {
	instance, err := e.instanceRepo.GetByID(instanceID)
	if err != nil {
		return errors.New("workflow instance not found")
	}

	instance.Status = "cancelled"
	now := time.Now()
	instance.CompletedAt = &now

	if err := e.instanceRepo.Update(instance); err != nil {
		return fmt.Errorf("failed to cancel workflow: %w", err)
	}

	return nil
}

// GetNextNodes 获取下一个节点
func (e *workflowExecutor) GetNextNodes(workflowID string, currentNodeID string) ([]models.WorkflowNode, error) {
	// 查找从当前节点出发的边
	var edges []models.WorkflowEdge
	if err := utils.DB.Where("workflow_id = ? AND source_node_id = ?", workflowID, currentNodeID).Find(&edges).Error; err != nil {
		return nil, err
	}

	if len(edges) == 0 {
		return nil, errors.New("no outgoing edges found")
	}

	// 获取目标节点ID
	targetNodeIDs := make([]string, len(edges))
	for i, edge := range edges {
		targetNodeIDs[i] = edge.TargetNodeID
	}

	// 查询目标节点
	var nodes []models.WorkflowNode
	if err := utils.DB.Where("id IN ?", targetNodeIDs).Find(&nodes).Error; err != nil {
		return nil, err
	}

	return nodes, nil
}
