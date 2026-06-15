package services

import (
	"fmt"
	"strings"

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
	quotedTable, err := utils.QuoteSQLIdentifier(model.TableName)
	if err != nil {
		return err
	}

	columns := []string{
		`"id" VARCHAR(64) PRIMARY KEY`,
	}
	for _, field := range model.Fields {
		column, err := buildColumnDefinition(field)
		if err != nil {
			return err
		}
		columns = append(columns, column)
	}
	columns = append(columns,
		`"created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
		`"updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
		`"created_by" VARCHAR(64)`,
		`"updated_by" VARCHAR(64)`,
	)

	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (\n  %s\n);", quotedTable, strings.Join(columns, ",\n  "))
	if err := utils.DB.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	for _, field := range model.Fields {
		indexName, err := utils.QuoteSQLIdentifier(fmt.Sprintf("idx_%s_%s", model.TableName, field.Name))
		if err != nil {
			return err
		}
		quotedField, err := utils.QuoteSQLIdentifier(field.Name)
		if err != nil {
			return err
		}
		unique := ""
		if field.Unique {
			unique = "UNIQUE "
		}
		indexSQL := fmt.Sprintf("CREATE %sINDEX IF NOT EXISTS %s ON %s (%s)", unique, indexName, quotedTable, quotedField)
		if err := utils.DB.Exec(indexSQL).Error; err != nil {
			utils.Logger.Error(fmt.Sprintf("Failed to create index: %v", err))
		}
	}

	utils.Logger.Info(fmt.Sprintf("Table %s created successfully", model.TableName))
	return nil
}

func (s *schemaManager) AlterTable(model *models.Model, oldModel *models.Model) error {
	if err := s.DropTable(oldModel); err != nil {
		return err
	}
	if err := s.CreateTable(model); err != nil {
		return err
	}
	return nil
}

func (s *schemaManager) DropTable(model *models.Model) error {
	quotedTable, err := utils.QuoteSQLIdentifier(model.TableName)
	if err != nil {
		return err
	}

	sql := fmt.Sprintf("DROP TABLE IF EXISTS %s", quotedTable)
	if err := utils.DB.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to drop table: %w", err)
	}

	utils.Logger.Info(fmt.Sprintf("Table %s dropped successfully", model.TableName))
	return nil
}

func (s *schemaManager) GenerateTableName(modelName string) string {
	return fmt.Sprintf("data_%s", modelName)
}

func buildColumnDefinition(field models.Field) (string, error) {
	quotedField, err := utils.QuoteSQLIdentifier(field.Name)
	if err != nil {
		return "", err
	}

	column := fmt.Sprintf("%s %s", quotedField, MapFieldTypeToSQL(field.Type))
	if field.Required {
		column += " NOT NULL"
	}
	if field.DefaultValue != "" {
		column += " DEFAULT " + utils.SQLStringLiteral(field.DefaultValue)
	}
	return column, nil
}

func MapFieldTypeToSQL(fieldType string) string {
	switch fieldType {
	case "text":
		return "VARCHAR(255)"
	case "number", "currency":
		return "DECIMAL(20, 2)"
	case "country":
		return "VARCHAR(32)"
	case "date":
		return "TIMESTAMP"
	case "bool", "boolean":
		return "BOOLEAN"
	case "enum":
		return "VARCHAR(64)"
	case "file", "image":
		return "VARCHAR(512)"
	case "relation":
		return "VARCHAR(512)"
	case "user":
		return "VARCHAR(64)"
	default:
		return "VARCHAR(255)"
	}
}
