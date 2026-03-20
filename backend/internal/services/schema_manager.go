package services

import (
	"fmt"

	"github.com/dmdp/platform/internal/models"
	"github.com/dmdp/platform/internal/utils"
)

type SchemaManager interface {
	CreateTable(model *models.Model) error
	AlterTable(model *models.Model, oldModel *models.Model) error
	DropTable(model *models.Model) error
	GenerateTableName(modelName string) string
}

type schemaManager struct{}

func NewSchemaManager() SchemaManager {
	return &schemaManager{}
}

func (s *schemaManager) CreateTable(model *models.Model) error {
	// 构建创建表的SQL
	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS `%s` (\n", model.TableName)
	sql += "  `id` VARCHAR(64) PRIMARY KEY,\n"

	// 添加字段
	for _, field := range model.Fields {
		fieldType := MapFieldTypeToSQL(field.Type)
		sql += fmt.Sprintf("  `%s` %s", field.Name, fieldType)
		
		if field.Required {
			sql += " NOT NULL"
		}
		if field.DefaultValue != "" {
			sql += fmt.Sprintf(" DEFAULT '%s'", field.DefaultValue)
		}
		sql += ",\n"
	}

	// 添加标准字段
	sql += "  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n"
	sql += "  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n"
	sql += "  `created_by` VARCHAR(64),\n"
	sql += "  `updated_by` VARCHAR(64)\n"
	sql += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"

	// 执行SQL
	if err := utils.DB.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	// 创建索引
	for _, field := range model.Fields {
		if field.Unique {
			// 唯一索引
			indexSQL := fmt.Sprintf("CREATE UNIQUE INDEX idx_%s_%s ON `%s` (`%s`)", 
				model.TableName, field.Name, model.TableName, field.Name)
			if err := utils.DB.Exec(indexSQL).Error; err != nil {
				utils.Logger.Error(fmt.Sprintf("Failed to create unique index: %v", err))
			}
		} else {
			// 普通索引
			indexSQL := fmt.Sprintf("CREATE INDEX idx_%s_%s ON `%s` (`%s`)", 
				model.TableName, field.Name, model.TableName, field.Name)
			if err := utils.DB.Exec(indexSQL).Error; err != nil {
				utils.Logger.Error(fmt.Sprintf("Failed to create index: %v", err))
			}
		}
	}

	utils.Logger.Info(fmt.Sprintf("Table %s created successfully", model.TableName))
	return nil
}

func (s *schemaManager) AlterTable(model *models.Model, oldModel *models.Model) error {
	// 简化实现:删除旧表,创建新表
	// 生产环境应该实现更精细的ALTER TABLE逻辑
	
	if err := s.DropTable(oldModel); err != nil {
		return err
	}
	
	if err := s.CreateTable(model); err != nil {
		return err
	}
	
	return nil
}

func (s *schemaManager) DropTable(model *models.Model) error {
	sql := fmt.Sprintf("DROP TABLE IF EXISTS `%s`", model.TableName)
	
	if err := utils.DB.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to drop table: %w", err)
	}
	
	utils.Logger.Info(fmt.Sprintf("Table %s dropped successfully", model.TableName))
	return nil
}

func (s *schemaManager) GenerateTableName(modelName string) string {
	return fmt.Sprintf("data_%s", modelName)
}

func MapFieldTypeToSQL(fieldType string) string {
	switch fieldType {
	case "text":
		return "VARCHAR(255)"
	case "number":
		return "DECIMAL(20, 2)"
	case "date":
		return "TIMESTAMP"
	case "bool":
		return "BOOLEAN"
	case "enum":
		return "VARCHAR(64)"
	case "file":
		return "VARCHAR(512)"
	case "relation":
		return "VARCHAR(512)" // 存储关联记录ID,多个用逗号分隔
	case "user":
		return "VARCHAR(64)" // 存储用户ID
	default:
		return "VARCHAR(255)"
	}
}
