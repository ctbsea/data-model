package repositories

import (
	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
	"gorm.io/gorm"
)

type WorkflowRepository interface {
	Create(workflow *models.Workflow) error
	GetByID(id string) (*models.Workflow, error)
	GetByName(name string) (*models.Workflow, error)
	List(page, pageSize int) ([]models.Workflow, int64, error)
	Update(workflow *models.Workflow) error
	Delete(id string) error
}

type workflowRepository struct {
	db *gorm.DB
}

func NewWorkflowRepository() WorkflowRepository {
	return &workflowRepository{db: utils.DB}
}

func (r *workflowRepository) Create(workflow *models.Workflow) error {
	return r.db.Create(workflow).Error
}

func (r *workflowRepository) GetByID(id string) (*models.Workflow, error) {
	var workflow models.Workflow
	err := r.db.Preload("Nodes").Preload("Edges").First(&workflow, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &workflow, nil
}

func (r *workflowRepository) GetByName(name string) (*models.Workflow, error) {
	var workflow models.Workflow
	err := r.db.Where("name = ?", name).Preload("Nodes").Preload("Edges").First(&workflow).Error
	if err != nil {
		return nil, err
	}
	return &workflow, nil
}

func (r *workflowRepository) List(page, pageSize int) ([]models.Workflow, int64, error) {
	var workflows []models.Workflow
	var total int64

	offset := (page - 1) * pageSize
	err := r.db.Model(&models.Workflow{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.Offset(offset).Limit(pageSize).Find(&workflows).Error
	if err != nil {
		return nil, 0, err
	}

	return workflows, total, nil
}

func (r *workflowRepository) Update(workflow *models.Workflow) error {
	return r.db.Save(workflow).Error
}

func (r *workflowRepository) Delete(id string) error {
	// 删除关联的节点和边
	if err := r.db.Where("workflow_id = ?", id).Delete(&models.WorkflowNode{}).Error; err != nil {
		return err
	}
	if err := r.db.Where("workflow_id = ?", id).Delete(&models.WorkflowEdge{}).Error; err != nil {
		return err
	}
	return r.db.Delete(&models.Workflow{}, "id = ?", id).Error
}

// WorkflowInstanceRepository 工作流实例仓储
type WorkflowInstanceRepository interface {
	Create(instance *models.WorkflowInstance) error
	GetByID(id string) (*models.WorkflowInstance, error)
	List(page, pageSize int, workflowID string) ([]models.WorkflowInstance, int64, error)
	Update(instance *models.WorkflowInstance) error
	Delete(id string) error
}

type workflowInstanceRepository struct {
	db *gorm.DB
}

func NewWorkflowInstanceRepository() WorkflowInstanceRepository {
	return &workflowInstanceRepository{db: utils.DB}
}

func (r *workflowInstanceRepository) Create(instance *models.WorkflowInstance) error {
	return r.db.Create(instance).Error
}

func (r *workflowInstanceRepository) GetByID(id string) (*models.WorkflowInstance, error) {
	var instance models.WorkflowInstance
	err := r.db.First(&instance, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *workflowInstanceRepository) List(page, pageSize int, workflowID string) ([]models.WorkflowInstance, int64, error) {
	var instances []models.WorkflowInstance
	var total int64

	offset := (page - 1) * pageSize
	query := r.db.Model(&models.WorkflowInstance{})
	if workflowID != "" {
		query = query.Where("workflow_id = ?", workflowID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&instances).Error
	if err != nil {
		return nil, 0, err
	}

	return instances, total, nil
}

func (r *workflowInstanceRepository) Update(instance *models.WorkflowInstance) error {
	return r.db.Save(instance).Error
}

func (r *workflowInstanceRepository) Delete(id string) error {
	return r.db.Delete(&models.WorkflowInstance{}, "id = ?", id).Error
}
