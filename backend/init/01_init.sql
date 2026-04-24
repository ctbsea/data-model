-- PostgreSQL 初始化脚本
-- 数据库已通过环境变量 POSTGRES_DB 创建,无需手动创建

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    nickname VARCHAR(64),
    avatar VARCHAR(256),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);

-- 创建权限表
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    display_name VARCHAR(128),
    resource VARCHAR(64),
    action VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
    user_id VARCHAR(64) NOT NULL,
    role_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(64) NOT NULL,
    permission_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 插入默认管理员角色
INSERT INTO roles (id, name, display_name) VALUES
('role_admin', 'admin', '系统管理员'),
('role_user', 'user', '普通用户')
ON CONFLICT (id) DO NOTHING;

-- 插入默认权限
INSERT INTO permissions (id, name, display_name, resource, action) VALUES
('perm_model_create', 'model:create', '创建模型', 'model', 'create'),
('perm_model_read', 'model:read', '查看模型', 'model', 'read'),
('perm_model_update', 'model:update', '更新模型', 'model', 'update'),
('perm_model_delete', 'model:delete', '删除模型', 'model', 'delete'),
('perm_data_create', 'data:create', '创建数据', 'data', 'create'),
('perm_data_read', 'data:read', '查看数据', 'data', 'read'),
('perm_data_update', 'data:update', '更新数据', 'data', 'update'),
('perm_data_delete', 'data:delete', '删除数据', 'data', 'delete')
ON CONFLICT (id) DO NOTHING;

-- 为管理员角色分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_admin', id FROM permissions
ON CONFLICT DO NOTHING;
