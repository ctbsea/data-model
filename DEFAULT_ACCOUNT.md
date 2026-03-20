# 默认账号信息

## 管理员账号

系统在首次启动时会自动创建默认管理员账号:

- **用户名**: `admin`
- **密码**: `admin123`
- **邮箱**: `admin@dmdp.com`
- **角色**: 超级管理员

## 默认角色

系统会自动创建以下默认角色:

1. **超级管理员** (super_admin)
   - 拥有系统所有权限
   - 可以管理所有用户、角色、模型和数据

2. **管理员** (admin)
   - 拥有系统管理权限
   - 可以管理用户和数据

3. **普通用户** (user)
   - 基础用户权限
   - 只能访问被授权的功能

## 默认权限

系统会自动创建以下权限模块:

### 用户管理
- `user:list` - 查看用户列表
- `user:create` - 创建用户
- `user:update` - 编辑用户
- `user:delete` - 删除用户

### 角色管理
- `role:list` - 查看角色列表
- `role:create` - 创建角色
- `role:update` - 编辑角色
- `role:delete` - 删除角色

### 模型管理
- `model:list` - 查看模型列表
- `model:create` - 创建模型
- `model:update` - 编辑模型
- `model:delete` - 删除模型
- `model:apply` - 应用模型

### 数据管理
- `data:list` - 查看数据列表
- `data:create` - 创建数据
- `data:update` - 编辑数据
- `data:delete` - 删除数据

### 页面管理
- `page:list` - 查看页面列表
- `page:create` - 创建页面
- `page:update` - 编辑页面
- `page:delete` - 删除页面

## 安全建议

⚠️ **重要**: 在生产环境中,请务必:

1. 修改默认管理员密码
2. 根据实际需求调整角色权限
3. 删除或禁用不需要的默认账号
4. 定期审查用户权限

## 修改密码

登录后,可以通过以下方式修改密码:

1. 进入"设置"页面
2. 点击"修改密码"
3. 输入旧密码和新密码
4. 保存更改

或者通过API修改:

```bash
curl -X PUT http://localhost:8080/api/v1/auth/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "admin123",
    "new_password": "your_new_password"
  }'
```
