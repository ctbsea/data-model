package main

import (
	"fmt"
	"log"

	"github.com/dmdp/platform/internal/config"
	"github.com/dmdp/platform/internal/utils"
)

func main() {
	if err := config.Init("./config/config.yaml"); err != nil {
		log.Fatal("Failed to load config:", err)
	}
	if err := utils.InitLogger(&config.Get().Log); err != nil {
		log.Fatal("Failed to init logger:", err)
	}
	defer utils.Sync()
	if err := utils.InitDatabase(&config.Get().Database); err != nil {
		log.Fatal("Failed to init database:", err)
	}
	defer utils.CloseDatabase()

	var tables []string
	if err := utils.DB.Raw(`
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public' AND tablename LIKE 'data\_%' ESCAPE '\'
	`).Scan(&tables).Error; err != nil {
		log.Fatal("Failed to get tables:", err)
	}

	fixed := 0
	for _, table := range tables {
		quotedTable, err := utils.QuoteSQLIdentifier(table)
		if err != nil {
			log.Printf("Invalid table %s: %v", table, err)
			continue
		}
		fmt.Printf("Processing table: %s\n", table)

		var columns []struct {
			ColumnName    string  `gorm:"column:column_name"`
			IsNullable    string  `gorm:"column:is_nullable"`
			ColumnDefault *string `gorm:"column:column_default"`
		}
		if err := utils.DB.Raw(`
			SELECT column_name, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = ?
		`, table).Scan(&columns).Error; err != nil {
			log.Printf("Failed to inspect table %s: %v", table, err)
			continue
		}

		for _, col := range columns {
			if isSystemField(col.ColumnName) || col.ColumnDefault != nil || col.IsNullable != "NO" {
				continue
			}
			quotedColumn, err := utils.QuoteSQLIdentifier(col.ColumnName)
			if err != nil {
				log.Printf("Invalid column %s.%s: %v", table, col.ColumnName, err)
				continue
			}
			alterSQL := fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP NOT NULL", quotedTable, quotedColumn)
			fmt.Printf("  Fixing column %s: %s\n", col.ColumnName, alterSQL)
			if err := utils.DB.Exec(alterSQL).Error; err != nil {
				log.Printf("  Failed to fix column %s: %v", col.ColumnName, err)
			} else {
				fixed++
				fmt.Printf("  Column %s fixed\n", col.ColumnName)
			}
		}
	}

	fmt.Printf("Done! Fixed %d columns\n", fixed)
}

func isSystemField(field string) bool {
	switch field {
	case "id", "created_at", "updated_at", "created_by", "updated_by":
		return true
	default:
		return false
	}
}
