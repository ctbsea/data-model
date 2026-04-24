#!/usr/bin/env python3
"""
MySQL 到 PostgreSQL 手动迁移脚本
当 pgloader 不可用时使用此脚本
"""

import pymysql
import psycopg2
from psycopg2.extras import execute_batch
import json
from datetime import datetime

# 数据库配置
MYSQL_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root123',
    'database': 'dmdp',
    'charset': 'utf8mb4'
}

PG_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'dmdp',
    'password': 'dmdp123',
    'database': 'dmdp'
}

def get_mysql_connection():
    return pymysql.connect(**MYSQL_CONFIG)

def get_pg_connection():
    return psycopg2.connect(**PG_CONFIG)

def migrate_table(mysql_conn, pg_conn, table_name, columns, batch_size=1000):
    """迁移单个表"""
    print(f"Migrating table: {table_name}")

    mysql_cursor = mysql_conn.cursor(pymysql.cursors.SSCursor)
    pg_cursor = pg_conn.cursor()

    # 获取 MySQL 数据
    column_list = ', '.join(columns)
    mysql_cursor.execute(f"SELECT {column_list} FROM {table_name}")

    # 批量插入到 PostgreSQL
    placeholders = ', '.join(['%s'] * len(columns))
    insert_sql = f"INSERT INTO {table_name} ({column_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    batch = []
    count = 0
    for row in mysql_cursor:
        # 转换数据类型
        converted_row = []
        for value in row:
            if isinstance(value, bytes):
                value = value.decode('utf-8')
            converted_row.append(value)

        batch.append(tuple(converted_row))
        count += 1

        if len(batch) >= batch_size:
            execute_batch(pg_cursor, insert_sql, batch)
            pg_conn.commit()
            batch = []

    # 插入剩余数据
    if batch:
        execute_batch(pg_cursor, insert_sql, batch)
        pg_conn.commit()

    mysql_cursor.close()
    pg_cursor.close()

    print(f"  Migrated {count} rows")
    return count

def main():
    print("=" * 50)
    print("MySQL to PostgreSQL Manual Migration")
    print("=" * 50)
    print()

    try:
        mysql_conn = get_mysql_connection()
        pg_conn = get_pg_connection()

        print("Connected to both databases")
        print()

        # 定义迁移顺序(考虑外键依赖)
        tables = [
            ('users', ['id', 'username', 'email', 'password_hash', 'nickname', 'avatar', 'status', 'created_at', 'updated_at', 'deleted_at']),
            ('roles', ['id', 'name', 'display_name', 'created_at', 'updated_at', 'deleted_at']),
            ('permissions', ['id', 'name', 'display_name', 'resource', 'action', 'created_at']),
            ('user_roles', ['user_id', 'role_id']),
            ('role_permissions', ['role_id', 'permission_id']),
        ]

        total_rows = 0
        for table_name, columns in tables:
            try:
                rows = migrate_table(mysql_conn, pg_conn, table_name, columns)
                total_rows += rows
            except Exception as e:
                print(f"  Error migrating {table_name}: {e}")

        print()
        print("=" * 50)
        print(f"Migration completed! Total rows: {total_rows}")
        print("=" * 50)

    except Exception as e:
        print(f"Migration failed: {e}")
        raise
    finally:
        if 'mysql_conn' in locals():
            mysql_conn.close()
        if 'pg_conn' in locals():
            pg_conn.close()

if __name__ == '__main__':
    main()
