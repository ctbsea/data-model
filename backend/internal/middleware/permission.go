package middleware

import (
	"net/http"

	"github.com/dmdp/platform/internal/repositories"
	"github.com/gin-gonic/gin"
)

func PermissionMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		roles, exists := c.Get("roles")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "权限不足"})
			c.Abort()
			return
		}

		// 检查是否有管理员角色
		roleList := roles.([]string)
		for _, role := range roleList {
			if role == "admin" {
				c.Next()
				return
			}
		}

		// 检查具体权限
		hasPermission := checkUserPermission(userID.(string), roleList, resource, action)
		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{"error": "权限不足"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func checkUserPermission(userID string, roles []string, resource, action string) bool {
	// 获取用户的所有权限
	permissionMap := make(map[string]bool)
	
	userRepo := repositories.NewUserRepository()
	user, err := userRepo.GetByID(userID)
	if err != nil {
		return false
	}

	// 收集所有权限
	for _, role := range user.Roles {
		for _, perm := range role.Permissions {
			permissionName := perm.Resource + ":" + perm.Action
			permissionMap[permissionName] = true
		}
	}

	// 检查是否有对应权限
	requiredPermission := resource + ":" + action
	return permissionMap[requiredPermission]
}
