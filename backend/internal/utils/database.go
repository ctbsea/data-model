package utils

import (
	"fmt"
	"time"

	"github.com/dmdp/platform/internal/config"
	"github.com/dmdp/platform/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDatabase(cfg *config.DatabaseConfig) error {
	var err error

	gormConfig := &gorm.Config{}
	if config.Get().Server.Mode == "debug" {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Silent)
	}

	DB, err = gorm.Open(mysql.Open(cfg.DSN()), gormConfig)
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
	err := DB.AutoMigrate(
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
	)
	if err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
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
