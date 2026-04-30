package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/dmdp/platform/internal/bootstrap"
	"github.com/dmdp/platform/internal/config"
	"github.com/dmdp/platform/internal/handlers"
	"github.com/dmdp/platform/internal/middleware"
	"github.com/dmdp/platform/internal/services"
	"github.com/dmdp/platform/internal/utils"
	"github.com/gin-gonic/gin"
)

func main() {
	// 加载配置
	if err := config.Init("./config/config.yaml"); err != nil {
		panic(fmt.Sprintf("Failed to load config: %v", err))
	}
	cfg := config.Get()

	// 初始化日志
	if err := utils.InitLogger(&cfg.Log); err != nil {
		panic(fmt.Sprintf("Failed to init logger: %v", err))
	}
	defer utils.Sync()

	// 初始化数据库
	if err := utils.InitDatabase(&cfg.Database); err != nil {
		utils.Logger.Fatal(fmt.Sprintf("Failed to init database: %v", err))
	}
	defer utils.CloseDatabase()

	// 自动迁移
	if err := utils.AutoMigrate(); err != nil {
		utils.Logger.Fatal(fmt.Sprintf("Failed to auto migrate: %v", err))
	}

	// 初始化默认数据
	if err := bootstrap.InitDefaultData(); err != nil {
		utils.Logger.Fatal(fmt.Sprintf("Failed to init default data: %v", err))
	}

	// 初始化自动化执行引擎
	engine := services.NewAutomationEngine(utils.DB, cfg.SMTP)
	if err := engine.Start(); err != nil {
		utils.Logger.Warn(fmt.Sprintf("Automation engine start warning: %v", err))
	}

	// 初始化 JWT
	utils.InitJWT(cfg.JWT.Secret)

	// 设置 Gin 模式
	gin.SetMode(cfg.Server.Mode)

	// 创建 Gin 引擎
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// 注册健康检查接口
	healthHandler := handlers.NewHealthHandler()
	router.GET("/health", healthHandler.Check)

	// 文件上传目录
	uploadDir := "./uploads"
	os.MkdirAll(uploadDir, 0755)
	router.Static("/uploads", uploadDir)
	router.POST("/api/upload", middleware.AuthMiddleware(), handleUpload(uploadDir))
	router.POST("/api/fix-fields", middleware.AuthMiddleware(), handleFixFields)

	// 初始化 Handler
	authHandler := handlers.NewAuthHandler()
	userHandler := handlers.NewUserHandler()
	roleHandler := handlers.NewRoleHandler()
	modelHandler := handlers.NewModelHandler()
	dataHandler := handlers.NewDataHandler(engine)
	automationHandler := handlers.NewAutomationHandler(engine)
	pageHandler := handlers.NewPageHandler()
	workflowHandler := handlers.NewWorkflowHandler()
	commentHandler := handlers.NewCommentHandler(utils.DB)
	historyHandler := handlers.NewHistoryHandler(utils.DB)
	viewConfigHandler := handlers.NewViewConfigHandler(utils.DB)
	dictionaryHandler := handlers.NewDictionaryHandler()

	// API 路由组
	api := router.Group("/api/v1")
	{
		// 认证相关路由(无需认证)
		auth := api.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.POST("/register", authHandler.Register)
			auth.POST("/refresh", authHandler.Refresh)
		}

		// 公开 webhook 触发路由（无需 JWT）
		api.POST("/webhooks/automation/:token", automationHandler.WebhookTrigger)

		// 需要认证的路由
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// 当前用户信息
			protected.GET("/auth/me", authHandler.Me)
			protected.PUT("/auth/email-address", authHandler.UpdateEmailAddress)

			// 用户管理
			users := protected.Group("/users")
			{
				users.GET("", userHandler.ListUsers)
				users.POST("", userHandler.CreateUser)
				users.GET("/:id", userHandler.GetUser)
				users.PUT("/:id", userHandler.UpdateUser)
				users.DELETE("/:id", userHandler.DeleteUser)
				users.POST("/:id/roles", userHandler.AssignRoles)
			}

			// 角色管理
			roles := protected.Group("/roles")
			{
				roles.GET("", roleHandler.ListRoles)
				roles.POST("", roleHandler.CreateRole)
				roles.PUT("/:id", roleHandler.UpdateRole)
				roles.DELETE("/:id", roleHandler.DeleteRole)
				roles.POST("/:id/permissions", roleHandler.AssignPermissions)
			}

			// 权限管理
			permissions := protected.Group("/permissions")
			{
				permissions.GET("", roleHandler.ListPermissions)
			}

			// 模型管理
			models := protected.Group("/models")
			{
				models.GET("", modelHandler.ListModels)
				models.POST("", modelHandler.CreateModel)
				models.GET("/:id", modelHandler.GetModel)
				models.PUT("/:id", modelHandler.UpdateModel)
				models.DELETE("/:id", modelHandler.DeleteModel)
				models.POST("/:id/apply", modelHandler.ApplyModel)
				models.GET("/:id/versions", modelHandler.GetModelVersions)
				models.POST("/:id/rollback", modelHandler.RollbackModel)

				// 字段管理
				models.GET("/:id/fields", func(c *gin.Context) {
					c.JSON(200, gin.H{"message": "fields endpoint"})
				})
				models.POST("/:id/fields", modelHandler.AddField)
				models.PUT("/:id/fields/:fieldId", modelHandler.UpdateField)
				models.DELETE("/:id/fields/:fieldId", modelHandler.DeleteField)

				// 关联关系管理
				models.GET("/:id/relations", func(c *gin.Context) {
					c.JSON(200, gin.H{"message": "relations endpoint"})
				})
				models.POST("/:id/relations", modelHandler.AddRelation)
				models.PUT("/:id/relations/:relationId", modelHandler.UpdateRelation)
				models.DELETE("/:id/relations/:relationId", modelHandler.DeleteRelation)
			}

			// 字典管理
			dictionaries := protected.Group("/dictionaries")
			{
				dictionaries.GET("", dictionaryHandler.List)
				dictionaries.GET("/:type", dictionaryHandler.List)
				dictionaries.POST("", dictionaryHandler.Create)
				dictionaries.PUT("/:id", dictionaryHandler.Update)
				dictionaries.DELETE("/:id", dictionaryHandler.Delete)
			}

			// 动态数据管理
			data := protected.Group("/data")
			{
				data.GET("/:modelName/aggregate", dataHandler.AggregateData)
				data.GET("/:modelName", dataHandler.ListData)
				data.GET("/:modelName/:id", dataHandler.GetData)
				data.POST("/:modelName", dataHandler.CreateData)
				data.PUT("/:modelName/:id", dataHandler.UpdateData)
				data.DELETE("/:modelName/:id", dataHandler.DeleteData)
				data.POST("/:modelName/batch", dataHandler.BatchOperation)
			}

			// 自动化管理
			automations := protected.Group("/automations")
			{
				automations.GET("/model/:modelId", automationHandler.List)
				automations.GET("/:id", automationHandler.GetByID)
				automations.POST("", automationHandler.Create)
				automations.PUT("/:id", automationHandler.Update)
				automations.DELETE("/:id", automationHandler.Delete)
				automations.PUT("/:id/toggle", automationHandler.ToggleEnable)
				automations.GET("/:id/runs", automationHandler.ListRuns)
				automations.GET("/:id/webhook-logs", automationHandler.ListWebhookLogs)
				automations.GET("/:id/stats", automationHandler.GetStats)
				automations.POST("/:id/webhook-token", automationHandler.RegenerateWebhookToken)
			}

			// 页面管理
			pages := protected.Group("/pages")
			{
				pages.GET("", pageHandler.ListPages)
				pages.POST("", pageHandler.CreatePage)
				pages.GET("/:id", pageHandler.GetPage)
				pages.PUT("/:id", pageHandler.UpdatePage)
				pages.DELETE("/:id", pageHandler.DeletePage)
				pages.GET("/route/:route", pageHandler.GetPageByRoute)
			}

			// 工作流管理
			workflows := protected.Group("/workflows")
			{
				workflows.GET("", workflowHandler.ListWorkflows)
				workflows.POST("", workflowHandler.CreateWorkflow)
				workflows.GET("/:id", workflowHandler.GetWorkflow)
				workflows.PUT("/:id", workflowHandler.UpdateWorkflow)
				workflows.DELETE("/:id", workflowHandler.DeleteWorkflow)
				workflows.POST("/:id/nodes", workflowHandler.AddNode)
				workflows.POST("/:id/edges", workflowHandler.AddEdge)
				workflows.POST("/:id/validate", workflowHandler.ValidateWorkflow)
				workflows.POST("/:id/start", workflowHandler.StartWorkflow)
			}

			// 工作流实例管理
			instances := protected.Group("/instances")
			{
				instances.POST("/:instanceId/tasks/:taskId/complete", workflowHandler.CompleteTask)
				instances.POST("/:instanceId/cancel", workflowHandler.CancelWorkflow)
			}

			// 评论管理
			comments := protected.Group("/comments")
			{
				comments.GET("/:model_name/:record_id", commentHandler.GetComments)
				comments.GET("/counts", commentHandler.GetCommentCounts)
				comments.POST("", commentHandler.CreateComment)
				comments.DELETE("/:id", commentHandler.DeleteComment)
			}

			// 历史记录管理
			history := protected.Group("/history")
			{
				history.GET("/:model_name/:record_id", historyHandler.GetHistory)
			}

			// 视图配置
			viewConfigs := protected.Group("/view-configs")
			{
				viewConfigs.GET("", viewConfigHandler.GetViewConfig)
				viewConfigs.POST("", viewConfigHandler.SaveViewConfig)
			}

			// 邮件管理
			emails := protected.Group("/emails")
			{
				emails.POST("/send", handlers.NewEmailHandler().SendEmail)
				emails.GET("/inbox", handlers.NewEmailHandler().GetInbox)
				emails.GET("/sent", handlers.NewEmailHandler().GetSent)
				emails.GET("/unread-count", handlers.NewEmailHandler().GetUnreadCount)
				emails.PUT("/:id/read", handlers.NewEmailHandler().MarkAsRead)
				emails.DELETE("/:id", handlers.NewEmailHandler().DeleteEmail)
			}

			// 仪表盘管理
			dashboards := protected.Group("/dashboards")
			{
				dashboards.GET("", handlers.NewDashboardHandler(utils.DB).GetDashboard)
				dashboards.POST("", handlers.NewDashboardHandler(utils.DB).SaveDashboard)
			}
		}
	}

	// 启动 HTTP 服务器
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	// 优雅关闭
	go func() {
		utils.Logger.Info(fmt.Sprintf("Server starting on port %d", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			utils.Logger.Fatal(fmt.Sprintf("Failed to start server: %v", err))
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	utils.Logger.Info("Shutting down server...")

	engine.Stop()

	// 给5秒钟时间完成正在处理的请求
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		utils.Logger.Fatal(fmt.Sprintf("Server forced to shutdown: %v", err))
	}

	utils.Logger.Info("Server exited")
}

func handleUpload(uploadDir string) gin.HandlerFunc {
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".pdf": true, ".txt": true, ".csv": true, ".xlsx": true, ".docx": true, ".zip": true,
	}
	const maxUploadSize = 10 << 20

	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded or file too large"})
			return
		}
		if file.Size > maxUploadSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File exceeds 10MB limit"})
			return
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		if !allowedExts[ext] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file type"})
			return
		}

		filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
		if err := c.SaveUploadedFile(file, filepath.Join(uploadDir, filename)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"url": "/uploads/" + filename, "filename": file.Filename})
	}
}

func handleFixFields(c *gin.Context) {
	var tables []string
	if err := utils.DB.Raw(`
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public' AND tablename LIKE 'data\_%' ESCAPE '\'
	`).Scan(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fixed := 0
	for _, table := range tables {
		quotedTable, err := utils.QuoteSQLIdentifier(table)
		if err != nil {
			utils.Logger.Error(fmt.Sprintf("Invalid table identifier %s: %v", table, err))
			continue
		}

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
			utils.Logger.Error(fmt.Sprintf("Failed to inspect table %s: %v", table, err))
			continue
		}

		for _, col := range columns {
			if isSystemField(col.ColumnName) || col.ColumnDefault != nil || col.IsNullable != "NO" {
				continue
			}
			quotedColumn, err := utils.QuoteSQLIdentifier(col.ColumnName)
			if err != nil {
				utils.Logger.Error(fmt.Sprintf("Invalid column identifier %s.%s: %v", table, col.ColumnName, err))
				continue
			}

			alterSQL := fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP NOT NULL", quotedTable, quotedColumn)
			if err := utils.DB.Exec(alterSQL).Error; err != nil {
				utils.Logger.Error(fmt.Sprintf("Failed to fix column %s.%s: %v", table, col.ColumnName, err))
			} else {
				fixed++
				utils.Logger.Info(fmt.Sprintf("Fixed column %s.%s", table, col.ColumnName))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fields fixed", "count": fixed})
}

func isSystemField(field string) bool {
	switch field {
	case "id", "created_at", "updated_at", "created_by", "updated_by":
		return true
	default:
		return false
	}
}
