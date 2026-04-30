package utils

import (
	"fmt"
	"strings"
	"time"

	"github.com/dmdp/platform/internal/config"
	"github.com/dmdp/platform/internal/models"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDatabase(cfg *config.DatabaseConfig) error {
	var err error

	gormConfig := &gorm.Config{
		PrepareStmt:                              false,
		DisableForeignKeyConstraintWhenMigrating: true,
	}
	if config.Get().Server.Mode == "debug" {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Silent)
	}

	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.DSN(),
		PreferSimpleProtocol: true,
	}), gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	Logger.Info("Database connected successfully")
	return nil
}

func AutoMigrate() error {
	modelsToMigrate := []interface{}{
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.DictionaryItem{},
		&models.Model{},
		&models.Field{},
		&models.Relation{},
		&models.ModelVersion{},
		&models.Workflow{},
		&models.WorkflowNode{},
		&models.WorkflowEdge{},
		&models.WorkflowInstance{},
		&models.WorkflowTask{},
		&models.NodeExecution{},
		&models.Page{},
		&models.ChangeLog{},
		&models.CellLock{},
		&models.Comment{},
		&models.ViewConfig{},
		&models.CommentCount{},
		&models.Email{},
		&models.Dashboard{},
		&models.Automation{},
		&models.AutomationRun{},
		&models.AutomationWebhookLog{},
	}

	for _, model := range modelsToMigrate {
		if err := DB.AutoMigrate(model); err != nil {
			Logger.Warn("Migration warning", zap.String("model", fmt.Sprintf("%T", model)), zap.Error(err))
			if strings.Contains(err.Error(), "insufficient arguments") {
				if _, ok := model.(*models.DictionaryItem); ok {
					if ensureErr := EnsureDictionaryItemsTable(); ensureErr != nil {
						return ensureErr
					}
				}
				continue
			}
			return err
		}
	}
	if err := EnsureAutomationTables(); err != nil {
		return err
	}

	Logger.Info("Database migration completed")
	return nil
}

func EnsureAutomationTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS automations (
			id varchar(64) PRIMARY KEY,
			model_id varchar(64) NOT NULL,
			name varchar(128) NOT NULL,
			description varchar(512),
			enabled boolean DEFAULT false,
			triggers json,
			actions json,
			run_count integer DEFAULT 0,
			success_count integer DEFAULT 0,
			fail_count integer DEFAULT 0,
			webhook_token varchar(64),
			created_by varchar(64),
			created_at timestamptz,
			updated_at timestamptz,
			deleted_at timestamptz
		)`,
		`ALTER TABLE automations ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 0`,
		`ALTER TABLE automations ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0`,
		`ALTER TABLE automations ADD COLUMN IF NOT EXISTS fail_count integer DEFAULT 0`,
		`ALTER TABLE automations ADD COLUMN IF NOT EXISTS webhook_token varchar(64)`,
		`ALTER TABLE automations ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
		`CREATE INDEX IF NOT EXISTS idx_automations_model_id ON automations (model_id)`,
		`CREATE INDEX IF NOT EXISTS idx_automations_deleted_at ON automations (deleted_at)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_automations_webhook_token ON automations (webhook_token) WHERE webhook_token IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS automation_runs (
			id varchar(64) PRIMARY KEY,
			automation_id varchar(64) NOT NULL,
			status varchar(20),
			trigger_data json,
			steps json,
			result text,
			error text,
			retry_count integer DEFAULT 0,
			started_at timestamptz,
			completed_at timestamptz
		)`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS status varchar(20)`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS trigger_data json`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS steps json`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS result text`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS error text`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS started_at timestamptz`,
		`ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS completed_at timestamptz`,
		`CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs (automation_id)`,
		`CREATE TABLE IF NOT EXISTS automation_webhook_logs (
			id varchar(64) PRIMARY KEY,
			automation_id varchar(64),
			webhook_token varchar(64) NOT NULL,
			idempotency_key varchar(128),
			status varchar(20),
			message varchar(512),
			payload json,
			remote_ip varchar(64),
			user_agent varchar(512),
			created_at timestamptz
		)`,
		`CREATE INDEX IF NOT EXISTS idx_automation_webhook_logs_automation_id ON automation_webhook_logs (automation_id)`,
		`CREATE INDEX IF NOT EXISTS idx_automation_webhook_logs_webhook_token ON automation_webhook_logs (webhook_token)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_webhook_logs_idempotency ON automation_webhook_logs (automation_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key <> '' AND status IN ('accepted', 'duplicate')`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func EnsureDictionaryItemsTable() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS dictionary_items (
			id varchar(64) PRIMARY KEY,
			"type" varchar(32) NOT NULL,
			code varchar(32) NOT NULL,
			name varchar(128) NOT NULL,
			name_zh varchar(128),
			name_en varchar(128),
			symbol varchar(32),
			icon varchar(256),
			sort integer DEFAULT 0,
			enabled boolean DEFAULT true,
			created_at timestamptz,
			updated_at timestamptz,
			deleted_at timestamptz
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionary_type_code ON dictionary_items ("type", code)`,
		`CREATE INDEX IF NOT EXISTS idx_dictionary_items_deleted_at ON dictionary_items (deleted_at)`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func CloseDatabase() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
