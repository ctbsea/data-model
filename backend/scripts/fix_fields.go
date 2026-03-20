package main

import (
	"fmt"
	"log"

	"github.com/dmdp/platform/internal/utils"
)

func main() {
	// 初始化数据库连接
	if err := utils.InitDB(); err != nil {
		log.Fatal("Failed to init database:", err)
	}

	// 查询所有数据表
	var tables []string
	if err := utils.DB.Raw("SHOW TABLES LIKE 'data_%'").Scan(&tables).Error; err != nil {
		log.Fatal("Failed to get tables:", err)
	}

	for _, table := range tables {
		fmt.Printf("Processing table: %s\n", table)

		// 获取表结构
		var columns []struct {
			Field   string
			Type    string
			Null    string
			Key     string
			Default *string
			Extra   string
		}

		if err := utils.DB.Raw(fmt.Sprintf("DESCRIBE `%s`", table)).Scan(&columns).Error; err != nil {
			log.Printf("Failed to describe table %s: %v", table, err)
			continue
		}

		// 检查每个字段
		for _, col := range columns {
			// 跳过系统字段
			if col.Field == "id" || col.Field == "created_at" || col.Field == "updated_at" || col.Field == "created_by" || col.Field == "updated_by" {
				continue
			}

			// 如果字段没有默认值且不允许NULL,修改为允许NULL
			if col.Default == nil && col.Null == "NO" {
				alterSQL := fmt.Sprintf("ALTER TABLE `%s` MODIFY COLUMN `%s` %s DEFAULT NULL", table, col.Field, col.Type)
				fmt.Printf("  Fixing column %s: %s\n", col.Field, alterSQL)
				
				if err := utils.DB.Exec(alterSQL).Error; err != nil {
					log.Printf("  Failed to fix column %s: %v", col.Field, err)
				} else {
					fmt.Printf("  ✓ Column %s fixed\n", col.Field)
				}
			}
		}
	}

	fmt.Println("Done!")
}
