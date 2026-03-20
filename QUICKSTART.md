# 数据模型驱动平台 - 运行指南

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- Go 1.21+ (用于本地开发)
- Node.js 18+ 和 npm (用于本地开发)

### 方式一: 使用 Docker Compose (推荐)

#### 1. 启动数据库服务

```bash
# 在项目根目录执行
docker-compose up -d
```

这将启动 MySQL 和 Redis 服务。

#### 2. 等待数据库就绪

```bash
# 检查 MySQL 是否就绪
docker-compose logs mysql

# 看到 "ready for connections" 表示数据库已就绪
```

#### 3. 启动后端服务

```bash
cd backend

# 下载依赖
go mod download

# 运行服务
go run cmd/server/main.go
```

后端服务将在 http://localhost:8080 启动

#### 4. 启动前端服务 (新终端窗口)

```bash
cd frontend

# 安装依赖
npm install

# 运行开发服务器
npm run dev
```

前端服务将在 http://localhost:3000 启动

#### 5. 访问应用

打开浏览器访问: http://localhost:3000

### 方式二: 本地开发环境

#### 1. 安装 MySQL 和 Redis

确保本地已安装:
- MySQL 8.0+
- Redis 7+

#### 2. 创建数据库

```sql
CREATE DATABASE dmdp DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 3. 配置环境变量

复制配置文件:
```bash
cp .env.example .env
```

编辑 `.env` 文件,修改数据库连接信息:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=dmdp
DB_USER=root
DB_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379
```

#### 4. 修改后端配置

编辑 `backend/config/config.yaml`:
```yaml
database:
  host: localhost
  port: 3306
  name: dmdp
  user: root
  password: your_password

redis:
  host: localhost
  port: 6379
```

#### 5. 启动服务

按照方式一的步骤3-5执行。

## 验证安装

### 1. 检查后端服务

访问健康检查接口:
```bash
curl http://localhost:8080/health
```

应该返回:
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

### 2. 检查前端服务

访问 http://localhost:3000,应该看到登录页面。

### 3. 注册第一个用户

1. 在登录页面点击"注册"标签
2. 填写用户名、邮箱和密码
3. 点击"注册"按钮
4. 注册成功后,使用该账号登录

## 使用流程

### 1. 创建数据模型

1. 登录后,点击左侧菜单"模型管理"
2. 点击"创建模型"按钮
3. 填写模型信息:
   - 模型名称: 例如 "products"
   - 显示名称: 例如 "产品"
   - 描述: 例如 "产品信息管理"
4. 点击"保存"

### 2. 添加字段

1. 在模型详情页,切换到"字段管理"标签
2. 点击"添加字段"
3. 配置字段属性:
   - 字段名: 例如 "name"
   - 显示名称: 例如 "产品名称"
   - 字段类型: 选择 "文本"
   - 是否必填: 勾选
4. 点击"确定"保存
5. 重复以上步骤添加更多字段(如价格、描述等)

### 3. 应用模型

1. 在模型列表页,找到刚创建的模型
2. 点击"应用"按钮
3. 系统将自动创建数据库表

### 4. 管理数据

1. 点击左侧菜单的"数据管理"(需要手动输入URL: /data/products)
2. 点击"新增数据"添加数据
3. 在表格中查看、编辑、删除数据

## 常见问题

### 1. 数据库连接失败

检查:
- MySQL 服务是否启动
- 数据库配置是否正确
- 防火墙是否阻止连接

### 2. 前端无法访问后端API

检查:
- 后端服务是否正常运行
- CORS 配置是否正确
- 前端代理配置是否正确

### 3. Docker 容器启动失败

检查:
- Docker 是否正常运行
- 端口是否被占用(3306, 6379, 8080, 3000)
- 查看容器日志: `docker-compose logs`

## 开发命令

### 后端

```bash
# 运行服务
go run cmd/server/main.go

# 编译
go build -o bin/server cmd/server/main.go

# 运行测试
go test ./...

# 代码格式化
go fmt ./...
```

### 前端

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 代码检查
npm run lint
```

## 停止服务

### 停止 Docker 服务

```bash
docker-compose down

# 删除数据卷(清除所有数据)
docker-compose down -v
```

### 停止本地服务

- 后端: Ctrl+C
- 前端: Ctrl+C

## 技术支持

如遇问题,请检查:
1. 服务日志
2. 浏览器控制台
3. 数据库连接状态
4. 网络配置

更多信息请参考 README.md
