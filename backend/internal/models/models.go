package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户表
type User struct {
	ID           string    `json:"id" gorm:"primaryKey;size:64"`
	Username     string    `json:"username" gorm:"uniqueIndex;size:64;not null"`
	Email        string    `json:"email" gorm:"uniqueIndex;size:128;not null"`
	PasswordHash string    `json:"-" gorm:"size:256;not null"`
	Nickname     string    `json:"nickname" gorm:"size:64"`
	Avatar       string    `json:"avatar" gorm:"size:256"`
	Status       string    `json:"status" gorm:"size:20;default:'active'"`
	EmailAddress string    `json:"email_address" gorm:"size:128"` // 用户配置的邮件地址
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
	
	Roles        []Role    `json:"roles" gorm:"many2many:user_roles;"`
}

// Role 角色表
type Role struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	Name        string    `json:"name" gorm:"uniqueIndex;size:64;not null"`
	DisplayName string    `json:"display_name" gorm:"size:128"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	Permissions []Permission `json:"permissions" gorm:"many2many:role_permissions;"`
}

// Permission 权限表
type Permission struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	Name        string    `json:"name" gorm:"uniqueIndex;size:128;not null"`
	DisplayName string    `json:"display_name" gorm:"size:128"`
	Resource    string    `json:"resource" gorm:"size:64"`
	Action      string    `json:"action" gorm:"size:32"`
	CreatedAt   time.Time `json:"created_at"`
}

// Model 数据模型定义
type Model struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	Name        string    `json:"name" gorm:"uniqueIndex;size:64;not null"`
	DisplayName string    `json:"display_name" gorm:"size:128;not null"`
	Description string    `json:"description" gorm:"size:512"`
	TableName   string    `json:"table_name" gorm:"uniqueIndex;size:64;not null"`
	Version     int       `json:"version" gorm:"default:1"`
	Status      string    `json:"status" gorm:"size:20;default:'draft'"`
	CreatedBy   string    `json:"created_by" gorm:"size:64"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	Fields      []Field    `json:"fields" gorm:"foreignKey:ModelID"`
	Relations   []Relation `json:"relations" gorm:"foreignKey:ModelID"`
}

// Field 字段定义
type Field struct {
	ID           string    `json:"id" gorm:"primaryKey;size:64"`
	ModelID      string    `json:"model_id" gorm:"index;size:64;not null"`
	Name         string    `json:"name" gorm:"size:64;not null"`
	DisplayName  string    `json:"display_name" gorm:"size:128;not null"`
	Type         string    `json:"type" gorm:"size:32;not null"`
	Required     bool      `json:"required" gorm:"default:false"`
	Unique       bool      `json:"unique" gorm:"default:false"`
	DefaultValue string    `json:"default_value" gorm:"size:256"`
	Options      string    `json:"options" gorm:"type:json"`
	Validation   string    `json:"validation" gorm:"type:json"`
	// 关联字段配置
	RelationConfig string `json:"relation_config" gorm:"type:json"` // JSON: {target_model_id, relation_type, display_field, allow_multiple, allow_duplicate, bidirectional}
	IsLock         bool   `json:"is_lock" gorm:"default:false"`      // 字段锁定
	CreatedBy      string `json:"created_by" gorm:"size:64"`         // 创建人用户ID
	Order          int    `json:"order" gorm:"default:0"`
	Deleted        bool   `json:"deleted" gorm:"default:false"` // 软删除标记
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// Relation 关联关系定义
type Relation struct {
	ID            string    `json:"id" gorm:"primaryKey;size:64"`
	ModelID       string    `json:"model_id" gorm:"index;size:64;not null"`
	Name          string    `json:"name" gorm:"size:64;not null"`
	Type          string    `json:"type" gorm:"size:20;not null"`
	TargetModelID string    `json:"target_model_id" gorm:"size:64;not null"`
	ForeignKey    string    `json:"foreign_key" gorm:"size:64"`
	JunctionTable string    `json:"junction_table" gorm:"size:64"`
	CascadeDelete bool      `json:"cascade_delete" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ModelVersion 模型版本历史
type ModelVersion struct {
	ID        string    `json:"id" gorm:"primaryKey;size:64"`
	ModelID   string    `json:"model_id" gorm:"index;size:64;not null"`
	Version   int       `json:"version" gorm:"not null"`
	Schema    string    `json:"schema" gorm:"type:json;not null"`
	ChangeLog string    `json:"change_log" gorm:"type:text"`
	CreatedBy string    `json:"created_by" gorm:"size:64"`
	CreatedAt time.Time `json:"created_at"`
}

// Workflow 工作流定义
type Workflow struct {
	ID            string           `json:"id" gorm:"primaryKey;size:64"`
	Name          string           `json:"name" gorm:"uniqueIndex;size:128;not null"`
	DisplayName   string           `json:"display_name" gorm:"size:256"`
	Description   string           `json:"description" gorm:"size:512"`
	TriggerConfig string           `json:"trigger_config" gorm:"type:json"`
	Status        string           `json:"status" gorm:"size:20;default:'draft'"`
	CreatedBy     string           `json:"created_by" gorm:"size:64"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
	DeletedAt     gorm.DeletedAt   `json:"-" gorm:"index"`
	
	Nodes         []WorkflowNode   `json:"nodes" gorm:"foreignKey:WorkflowID"`
	Edges         []WorkflowEdge   `json:"edges" gorm:"foreignKey:WorkflowID"`
}

// WorkflowNode 工作流节点
type WorkflowNode struct {
	ID         string    `json:"id" gorm:"primaryKey;size:64"`
	WorkflowID string    `json:"workflow_id" gorm:"index;size:64"`
	Type       string    `json:"type" gorm:"size:32;not null"`
	Name       string    `json:"name" gorm:"size:128;not null"`
	Config     string    `json:"config" gorm:"type:json"`
	X          int       `json:"x"`
	Y          int       `json:"y"`
	CreatedAt  time.Time `json:"created_at"`
}

// WorkflowEdge 工作流边(连接)
type WorkflowEdge struct {
	ID           string    `json:"id" gorm:"primaryKey;size:64"`
	WorkflowID   string    `json:"workflow_id" gorm:"index;size:64"`
	SourceNodeID string    `json:"source_node_id" gorm:"size:64;not null"`
	TargetNodeID string    `json:"target_node_id" gorm:"size:64;not null"`
	Condition    string    `json:"condition" gorm:"type:json"`
	Label        string    `json:"label" gorm:"size:128"`
	CreatedAt    time.Time `json:"created_at"`
}

// Comment 评论表
type Comment struct {
	ID        string    `json:"id" gorm:"primaryKey;size:64"`
	ModelName string    `json:"model_name" gorm:"index;size:64;not null"`
	RecordID  string    `json:"record_id" gorm:"index;size:64;not null"`
	UserID    string    `json:"user_id" gorm:"size:64;not null"`
	UserName  string    `json:"user_name" gorm:"size:128;not null"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at"`
}

// WorkflowInstance 工作流实例
type WorkflowInstance struct {
	ID          string     `json:"id" gorm:"primaryKey;size:64"`
	WorkflowID  string     `json:"workflow_id" gorm:"index;size:64"`
	ParentID    *string    `json:"parent_id" gorm:"size:64"`
	Status      string     `json:"status" gorm:"size:20"`
	Input       string     `json:"input" gorm:"type:json"`
	Output      string     `json:"output" gorm:"type:json"`
	CurrentNode string     `json:"current_node" gorm:"size:64"`
	StartedBy   string     `json:"started_by" gorm:"size:64"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	Error       string     `json:"error" gorm:"type:text"`
}

// WorkflowTask 工作流任务
type WorkflowTask struct {
	ID          string     `json:"id" gorm:"primaryKey;size:64"`
	InstanceID  string     `json:"instance_id" gorm:"index;size:64"`
	NodeID      string     `json:"node_id" gorm:"size:64"`
	Name        string     `json:"name" gorm:"size:128"`
	Assignee    string     `json:"assignee" gorm:"size:64"`
	Type        string     `json:"type" gorm:"size:32"`
	Status      string     `json:"status" gorm:"size:20"`
	Input       string     `json:"input" gorm:"type:json"`
	Output      string     `json:"output" gorm:"type:json"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// NodeExecution 节点执行记录
type NodeExecution struct {
	ID          string     `json:"id" gorm:"primaryKey;size:64"`
	InstanceID  string     `json:"instance_id" gorm:"index;size:64"`
	NodeID      string     `json:"node_id" gorm:"size:64"`
	Status      string     `json:"status" gorm:"size:20"`
	Input       string     `json:"input" gorm:"type:json"`
	Output      string     `json:"output" gorm:"type:json"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	Error       string     `json:"error" gorm:"type:text"`
	RetryCount  int        `json:"retry_count"`
}

// Page 页面配置
type Page struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	Name        string    `json:"name" gorm:"size:128;not null"`
	Route       string    `json:"route" gorm:"uniqueIndex;size:256;not null"`
	Title       string    `json:"title" gorm:"size:256"`
	Layout      string    `json:"layout" gorm:"type:json"`
	Components  string    `json:"components" gorm:"type:json;not null"`
	Permissions string    `json:"permissions" gorm:"type:json"`
	CreatedBy   string    `json:"created_by" gorm:"size:64"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// ChangeLog 变更日志
type ChangeLog struct {
	ID         string      `json:"id" gorm:"primaryKey;size:64"`
	ModelName  string      `json:"model_name" gorm:"index;size:64"`
	RowID      string      `json:"row_id" gorm:"index;size:64"`
	FieldName  string      `json:"field_name" gorm:"size:64"`
	OldValue   interface{} `json:"old_value" gorm:"type:json"`
	NewValue   interface{} `json:"new_value" gorm:"type:json"`
	Version    int64       `json:"version" gorm:"uniqueIndex:idx_model_version"`
	Operation  string      `json:"operation" gorm:"size:20"`
	ChangedBy  string      `json:"changed_by" gorm:"size:64"`
	ChangedAt  time.Time   `json:"changed_at"`
}

// CellLock 单元格锁
type CellLock struct {
	ID         string    `json:"id" gorm:"primaryKey;size:64"`
	ModelName  string    `json:"model_name" gorm:"size:64;not null"`
	RowID      string    `json:"row_id" gorm:"size:64;not null"`
	FieldName  string    `json:"field_name" gorm:"size:64"`
	LockedBy   string    `json:"locked_by" gorm:"size:64;not null"`
	LockedAt   time.Time `json:"locked_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// ViewConfig 视图配置
type ViewConfig struct {
	ID            string    `json:"id" gorm:"primaryKey;size:64"`
	UserID        string    `json:"user_id" gorm:"index;size:64;not null"`
	ModelName     string    `json:"model_name" gorm:"index;size:64;not null"`
	ViewType      string    `json:"view_type" gorm:"size:20;not null"` // table, kanban, calendar
	Filters       string    `json:"filters" gorm:"type:json"`
	Sorts         string    `json:"sorts" gorm:"type:json"`
	ColumnWidths  string    `json:"column_widths" gorm:"type:json"`
	FrozenColumns int       `json:"frozen_columns" gorm:"default:0"`
	VisibleFields string    `json:"visible_fields" gorm:"type:json"`
	CalendarStart string    `json:"calendar_start" gorm:"size:64"` // 日历视图开始时间字段
	CalendarEnd   string    `json:"calendar_end" gorm:"size:64"`   // 日历视图结束时间字段
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CommentCount 评论统计
type CommentCount struct {
	ModelName string    `json:"model_name" gorm:"primaryKey;size:64"`
	RecordID  string    `json:"record_id" gorm:"primaryKey;size:64"`
	Count     int       `json:"count" gorm:"default:0"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Dashboard 仪表盘配置
type Dashboard struct {
	ID        string    `json:"id" gorm:"primaryKey;size:64"`
	UserID    string    `json:"user_id" gorm:index;size:64;not null"`
	Name      string    `json:"name" gorm:"size:128;not null"`
	Config    string    `json:"config" gorm:"type:json"` // JSON: { panels: [] }
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
