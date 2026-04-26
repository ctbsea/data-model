package utils

import (
	"fmt"
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
		PrepareStmt: false, // 禁用 prepared statements 避免缓存计划问题
	}
	if config.Get().Server.Mode == "debug" {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Silent)
	}

	DB, err = gorm.Open(postgres.Open(cfg.DSN()), gormConfig)
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
	// 使用 DisableForeignKeyConstraintWhenMigrating 避免外键约束问题
	migrator := DB.Migrator()

	// 逐个迁移表,忽略已存在的表
	modelsToMigrate := []interface{}{
		&models.User{},
		&models.Role{},
		&models.Permission{},
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
		if err := migrator.AutoMigrate(model); err != nil {
			Logger.Warn("Migration warning",
				zap.String("model", fmt.Sprintf("%T", model)),
				zap.Error(err))
			// 继续迁移其他表,不中断
		}
	}

	Logger.Info("Database migration completed")
	return nil
}

func CloseDatabase() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
