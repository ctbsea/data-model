# MySQL 到 PostgreSQL 迁移指南

## 迁移步骤

### 1. 准备工作

#### 安装迁移工具

**方式一: 使用 pgloader (推荐)**
```bash
# Ubuntu/Debian
sudo apt-get install pgloader

# macOS
brew install pgloader

# Windows (使用 Docker)
docker run -it --rm dimitri/pgloader pgloader --help
```

**方式二: 使用 Python 脚本**
```bash
pip install pymysql psycopg2-binary
```

### 2. 启动 PostgreSQL

```bash
# 启动 PostgreSQL 容器
docker-compose up -d postgres

# 等待 PostgreSQL 就绪
docker-compose logs postgres
```

### 3. 执行迁移

**方式一: 使用 pgloader**
```bash
cd backend/scripts
chmod +x migrate_mysql_to_postgres.sh
./migrate_mysql_to_postgres.sh
```

**方式二: 使用 Python 脚本**
```bash
cd backend/scripts
python3 migrate_mysql_to_postgres.py
```

### 4. 验证迁移

```bash
# 连接到 PostgreSQL
docker exec -it dmdp-postgres psql -U dmdp -d dmdp

# 检查表数量
\dt

# 检查数据
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM roles;
SELECT COUNT(*) FROM permissions;

# 退出
\q
```

### 5. 更新应用配置

配置文件已自动更新,确认以下配置:

**backend/config/config.yaml**
```yaml
database:
  host: localhost  # 或 PostgreSQL 服务器地址
  port: 5432
  name: dmdp
  user: dmdp
  password: dmdp123
```

### 6. 测试应用

```bash
# 更新 Go 依赖
cd backend
go mod tidy
go mod download

# 启动后端
go run cmd/server/main.go

# 测试 API
curl http://localhost:8080/health
```

## 数据类型映射

| MySQL | PostgreSQL |
|-------|------------|
| VARCHAR | VARCHAR |
| TEXT | TEXT |
| INT | INTEGER |
| BIGINT | BIGINT |
| DATETIME | TIMESTAMP |
| TIMESTAMP | TIMESTAMP |
| TINYINT(1) | BOOLEAN |
| JSON | JSONB |

## 常见问题

### 1. 字符编码问题

PostgreSQL 默认使用 UTF-8,无需额外配置。

### 2. 自增主键

PostgreSQL 使用 SEQUENCE,迁移后需要重置:
```sql
SELECT setval('users_id_seq', (SELECT MAX(CAST(id AS bigint)) + 1 FROM users));
```

### 3. 布尔类型

MySQL 的 TINYINT(1) 会自动映射为 PostgreSQL 的 BOOLEAN。

### 4. JSON 类型

PostgreSQL 的 JSONB 性能更好,建议使用 JSONB。

## 回滚方案

如果迁移失败,可以:

1. 停止 PostgreSQL: `docker-compose down`
2. 恢复 MySQL 配置
3. 重新启动 MySQL: `docker-compose up -d mysql`

## 性能优化

迁移完成后,建议:

1. 分析表统计信息:
```sql
ANALYZE;
```

2. 重建索引:
```sql
REINDEX DATABASE dmdp;
```

3. 配置连接池(已在 config.yaml 中配置)
