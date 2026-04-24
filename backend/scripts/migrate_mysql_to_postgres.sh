#!/bin/bash

# MySQL 到 PostgreSQL 数据迁移脚本
# 使用 pgloader 进行数据迁移

set -e

echo "========================================="
echo "MySQL to PostgreSQL Migration Script"
echo "========================================="

# 配置信息
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-root123}"
MYSQL_DATABASE="${MYSQL_DATABASE:-dmdp}"

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-dmdp}"
PG_PASSWORD="${PG_PASSWORD:-dmdp123}"
PG_DATABASE="${PG_DATABASE:-dmdp}"

# 检查 pgloader 是否安装
if ! command -v pgloader &> /dev/null; then
    echo "Error: pgloader is not installed."
    echo "Please install pgloader first:"
    echo "  Ubuntu/Debian: sudo apt-get install pgloader"
    echo "  macOS: brew install pgloader"
    echo "  Windows: Use Docker or WSL"
    exit 1
fi

# 创建 pgloader 配置文件
cat > /tmp/migration.load <<EOF
LOAD DATABASE
     FROM mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
     INTO postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}

WITH include drop, create tables, create indexes, reset sequences

SET maintenance_work_mem to '128MB', work_mem to '12MB'

CAST type datetime to timestamptz drop default using zero-dates-to-null

BEFORE LOAD DO
\$\$ BEGIN
     -- 确保目标数据库存在
     PERFORM 1;
   END;
\$\$;

AFTER LOAD DO
\$\$ BEGIN
     -- 更新序列
     PERFORM setval('users_id_seq', (SELECT COALESCE(MAX(CAST(id AS bigint)), 0) + 1 FROM users));
     PERFORM setval('roles_id_seq', (SELECT COALESCE(MAX(CAST(id AS bigint)), 0) + 1 FROM roles));
     PERFORM setval('permissions_id_seq', (SELECT COALESCE(MAX(CAST(id AS bigint)), 0) + 1 FROM permissions));
   END;
\$\$;
EOF

echo "Migration configuration created."
echo "Source: MySQL ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"
echo "Target: PostgreSQL ${PG_HOST}:${PG_PORT}/${PG_DATABASE}"
echo ""

# 执行迁移
echo "Starting migration..."
pgloader /tmp/migration.load

# 检查迁移结果
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "Migration completed successfully!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "1. Verify data in PostgreSQL"
    echo "2. Update application configuration"
    echo "3. Test application functionality"
    echo "4. Backup MySQL data (optional)"
    echo "5. Decommission MySQL (optional)"
else
    echo ""
    echo "Migration failed. Please check the error messages above."
    exit 1
fi
