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

	Logger.Info("Database migration completed")
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
