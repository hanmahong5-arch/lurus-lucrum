# Lucrum Database Maintenance Guide
> 最后更新: 2026-01-22
# 数据库维护指南

## Overview | 概述

This document provides comprehensive guidance for maintaining the Lucrum PostgreSQL database, including backup, restore, performance tuning, and troubleshooting.

本文档提供Lucrum PostgreSQL数据库维护的全面指南，包括备份、恢复、性能调优和故障排查。

---

## Database Architecture | 数据库架构

### Connection Information | 连接信息

```bash
# Production / 生产环境
Host: postgres-service (K3s内部DNS)
Port: 5432
Database: lucrum
User: postgres
Connection String: postgresql://postgres:password@postgres-service:5432/lucrum

# Development / 开发环境
Host: localhost
Port: 5432
Database: lucrum
User: postgres
Connection String: postgresql://postgres:postgres@localhost:5432/lucrum
```

### Tables | 表结构

The database consists of 7 main tables:
数据库包含7个主要表：

1. **stocks** - Stock basic information (股票基本信息)
   - ~5,000 records
   - Indexes: symbol (unique), status, isST, name

2. **sectors** - Industry sectors (行业板块)
   - ~150 records
   - Indexes: code (unique)

3. **stock_sector_mapping** - Stock-sector relationships (股票-板块映射)
   - ~10,000 records
   - Indexes: stockId, sectorId, unique(stockId, sectorId)

4. **kline_daily** - Daily K-line data (日K线数据) ⭐ **Largest table**
   - ~2,500,000 records (2 years)
   - ~300MB data size
   - Indexes: (stockId, date) unique, date

5. **data_update_log** - Data update logs (数据更新日志)
   - Growing table (每日增长)
   - Indexes: updateDate, status

6. **validation_cache** - Validation result cache (验证结果缓存)
   - Temporary data (24h TTL)
   - Indexes: cacheKey (unique), expiresAt

7. **validation_presets** - User validation presets (用户验证预设)
   - User-specific data (用户数据)
   - Indexes: name, isFavorite

---

## Daily Operations | 日常运维

### Automated Daily Updates | 自动每日更新

The system automatically updates K-line data daily at **15:30 CST (Mon-Fri)**.
系统每日**15:30 CST（周一至周五）**自动更新K线数据。

**Monitoring / 监控:**
```bash
# Check if cron job is running
# 检查定时任务是否运行
curl http://localhost:3000/api/data/status

# Manual trigger (for testing)
# 手动触发（用于测试）
curl -X POST http://localhost:3000/api/data/update \
  -H "Content-Type: application/json" \
  -d '{"updateType": "daily"}'
```

**Logs / 日志:**
- Check update logs in database: `SELECT * FROM data_update_log ORDER BY created_at DESC LIMIT 10;`
- Check application logs: `kubectl logs -f <pod-name> -n lucrum` (K3s)

### Manual Data Import | 手动数据导入

**Initial Import (First time setup) / 初始导入（首次设置）:**

```bash
# 1. Generate database schema
# 1. 生成数据库结构
bun run db:generate  # or: npm run db:generate

# 2. Push schema to database
# 2. 推送结构到数据库
bun run db:push  # or: npm run db:push

# 3. Import stocks and sectors (fast, ~1 minute)
# 3. 导入股票和板块（快速，约1分钟）
bun run db:import:stocks  # or: npm run db:import:stocks

# 4. Import 2 years K-line data (slow, 3-6 hours)
# 4. 导入2年K线数据（慢，3-6小时）
bun run db:import:klines  # or: npm run db:import:klines

# OR import everything at once
# 或一次性导入全部
bun run db:import  # or: npm run db:import
```

**Incremental Update / 增量更新:**

```bash
# Update today's data only
# 仅更新今日数据
curl -X POST http://localhost:3000/api/data/update \
  -H "Content-Type: application/json" \
  -d '{
    "updateType": "daily",
    "date": "2024-01-15",
    "force": false
  }'

# Force update (overwrite existing data)
# 强制更新（覆盖已有数据）
curl -X POST http://localhost:3000/api/data/update \
  -H "Content-Type: application/json" \
  -d '{
    "updateType": "daily",
    "date": "2024-01-15",
    "force": true
  }'
```

---

## Backup and Restore | 备份与恢复

### Database Backup | 数据库备份

**Full Backup / 全量备份:**

```bash
# Backup entire database
# 备份整个数据库
pg_dump -h postgres-service -U postgres -d lucrum -F c -f lucrum-backup-$(date +%Y%m%d).dump

# With compression
# 压缩备份
pg_dump -h postgres-service -U postgres -d lucrum | gzip > lucrum-backup-$(date +%Y%m%d).sql.gz
```

**Table-specific Backup / 指定表备份:**

```bash
# Backup K-line data only (largest table)
# 仅备份K线数据（最大表）
pg_dump -h postgres-service -U postgres -d lucrum -t kline_daily -F c -f kline_daily-$(date +%Y%m%d).dump
```

**Automated Backup Schedule / 自动备份计划:**

Create a cron job (运行在K3s集群外的备份服务器上):

```bash
# /etc/cron.daily/lucrum-backup.sh

#!/bin/bash
BACKUP_DIR="/backups/lucrum"
RETENTION_DAYS=7

# Create backup
pg_dump -h postgres-service -U postgres -d lucrum -F c -f $BACKUP_DIR/lucrum-$(date +%Y%m%d).dump

# Delete old backups
find $BACKUP_DIR -name "lucrum-*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
```

### Database Restore | 数据库恢复

**Full Restore / 全量恢复:**

```bash
# Restore from dump file
# 从dump文件恢复
pg_restore -h postgres-service -U postgres -d lucrum -c lucrum-backup-20240115.dump

# Restore from SQL file
# 从SQL文件恢复
gunzip < lucrum-backup-20240115.sql.gz | psql -h postgres-service -U postgres -d lucrum
```

**Table-specific Restore / 指定表恢复:**

```bash
# Restore K-line data only
# 仅恢复K线数据
pg_restore -h postgres-service -U postgres -d lucrum -t kline_daily kline_daily-20240115.dump
```

---

## Performance Tuning | 性能调优

### Query Performance Analysis | 查询性能分析

**Slow Query Identification / 慢查询识别:**

```sql
-- Enable query logging (if not already enabled)
-- 启用查询日志
ALTER DATABASE lucrum SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Find slow queries in logs
-- 在日志中查找慢查询
-- Check PostgreSQL logs

-- Analyze query execution plan
-- 分析查询执行计划
EXPLAIN ANALYZE
SELECT * FROM kline_daily
WHERE stock_id = 1 AND date >= '2023-01-01' AND date <= '2024-01-01';
```

### Index Optimization | 索引优化

**Check Index Usage / 检查索引使用情况:**

```sql
-- List all indexes
-- 列出所有索引
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
-- 查找未使用的索引
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%pkey%';
```

**Add Missing Indexes / 添加缺失索引:**

```sql
-- Example: Add index if query is slow
-- 示例：如果查询慢则添加索引
CREATE INDEX CONCURRENTLY idx_kline_daily_date ON kline_daily(date);

-- Composite index for common queries
-- 常用查询的复合索引
CREATE INDEX CONCURRENTLY idx_kline_stock_date ON kline_daily(stock_id, date);
```

### Database Maintenance | 数据库维护

**Vacuum and Analyze / 清理和分析:**

```sql
-- Vacuum to reclaim storage
-- 清理以回收存储空间
VACUUM VERBOSE kline_daily;

-- Analyze to update statistics
-- 分析以更新统计信息
ANALYZE kline_daily;

-- Full vacuum (requires exclusive lock, do during maintenance window)
-- 完全清理（需要排他锁，在维护窗口执行）
VACUUM FULL kline_daily;
```

**Auto-vacuum Configuration / 自动清理配置:**

```sql
-- Check auto-vacuum settings
-- 检查自动清理设置
SHOW autovacuum;
SHOW autovacuum_naptime;

-- Enable auto-vacuum for specific table
-- 为指定表启用自动清理
ALTER TABLE kline_daily SET (autovacuum_enabled = true);
```

---

## Monitoring | 监控

### Database Size | 数据库大小

```sql
-- Database size
-- 数据库大小
SELECT pg_size_pretty(pg_database_size('lucrum'));

-- Table sizes
-- 表大小
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size,
  pg_size_pretty(pg_relation_size(quote_ident(table_name))) AS table_size,
  pg_size_pretty(pg_indexes_size(quote_ident(table_name))) AS indexes_size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```

### Connection Monitoring | 连接监控

```sql
-- Active connections
-- 活动连接
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE datname = 'lucrum'
ORDER BY query_start DESC;

-- Connection count by state
-- 按状态统计连接数
SELECT state, COUNT(*)
FROM pg_stat_activity
WHERE datname = 'lucrum'
GROUP BY state;

-- Kill long-running query
-- 终止长时间运行的查询
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <pid_number>;
```

### Cache Hit Ratio | 缓存命中率

```sql
-- Buffer cache hit ratio (should be > 99%)
-- 缓冲区缓存命中率（应 > 99%）
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

---

## Troubleshooting | 故障排查

### Issue 1: Database Connection Failed | 数据库连接失败

**Symptoms / 症状:**
- Application cannot connect to database
- Error: "connection refused" or "timeout"

**Diagnosis / 诊断:**

```bash
# Check if PostgreSQL is running in K3s
# 检查PostgreSQL是否在K3s中运行
kubectl get pods -n lucrum | grep postgres

# Check service
# 检查服务
kubectl get svc -n lucrum postgres-service

# Check logs
# 检查日志
kubectl logs -f <postgres-pod-name> -n lucrum

# Test connection from within cluster
# 从集群内测试连接
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- psql -h postgres-service -U postgres -d lucrum
```

**Solutions / 解决方案:**
1. Restart PostgreSQL pod: `kubectl delete pod <postgres-pod-name> -n lucrum`
2. Check DATABASE_URL in application environment
3. Verify network policies allow connection

### Issue 2: Slow Query Performance | 查询性能慢

**Symptoms / 症状:**
- API responses taking > 5 seconds
- Database CPU usage high

**Diagnosis / 诊断:**

```sql
-- Find slow queries
-- 查找慢查询
SELECT
  pid,
  now() - query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Check for missing indexes
-- 检查缺失索引
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan AS avg_seq_tup
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;
```

**Solutions / 解决方案:**
1. Add indexes for frequently queried columns
2. Run VACUUM ANALYZE
3. Optimize query (use EXPLAIN ANALYZE)
4. Increase PostgreSQL memory settings

### Issue 3: Disk Space Running Out | 磁盘空间不足

**Symptoms / 症状:**
- Database writes failing
- Error: "no space left on device"

**Diagnosis / 诊断:**

```bash
# Check disk usage in K3s
# 检查K3s中的磁盘使用
kubectl exec -it <postgres-pod-name> -n lucrum -- df -h

# Check database size
# 检查数据库大小
kubectl exec -it <postgres-pod-name> -n lucrum -- psql -U postgres -d lucrum -c "SELECT pg_size_pretty(pg_database_size('lucrum'));"
```

**Solutions / 解决方案:**
1. Delete old validation cache: `DELETE FROM validation_cache WHERE expires_at < NOW();`
2. Archive old K-line data (> 2 years)
3. Run VACUUM FULL during maintenance window
4. Increase persistent volume size

### Issue 4: Daily Update Failed | 每日更新失败

**Symptoms / 症状:**
- No new data after 15:30
- Update log shows "failed" status

**Diagnosis / 诊断:**

```bash
# Check update logs
# 检查更新日志
curl http://localhost:3000/api/data/status

# Check application logs
# 检查应用日志
kubectl logs -f <app-pod-name> -n lucrum | grep DailyUpdater

# Check if cron job is running
# 检查定时任务是否运行
curl http://localhost:3000/api/data/update
```

**Solutions / 解决方案:**
1. Manually trigger update: `POST /api/data/update`
2. Check EastMoney API availability (may be blocked or rate-limited)
3. Check network connectivity from cluster
4. Review error messages in data_update_log table

---

## Best Practices | 最佳实践

### 1. Regular Backups | 定期备份
- **Daily**: Automated backup at 2:00 AM
- **Weekly**: Full backup with compression
- **Monthly**: Archive backup to cold storage
- **Retention**: Keep 7 daily, 4 weekly, 12 monthly

### 2. Monitoring | 监控
- Set up alerts for:
  - Database size > 80% of allocated space
  - Connection count > 80% of max_connections
  - Query duration > 10 seconds
  - Cache hit ratio < 95%
  - Daily update failures

### 3. Maintenance Windows | 维护窗口
- **Weekly** (Sunday 2:00-4:00 AM):
  - VACUUM ANALYZE all tables
  - Check and rebuild indexes if needed
  - Review slow query logs

- **Monthly** (First Sunday 2:00-6:00 AM):
  - VACUUM FULL on large tables
  - Database integrity check
  - Performance baseline review

### 4. Data Archival | 数据归档
- Archive K-line data older than 2 years
- Move to separate archive table or export to file
- Maintains query performance on active data

### 5. Security | 安全性
- Use strong passwords (rotate every 90 days)
- Restrict database access to application only
- Enable SSL/TLS for connections
- Regular security audits

---

## Emergency Procedures | 应急程序

### Emergency Contact | 紧急联系

```
Database Administrator: [Your contact info]
DevOps Team: [Team contact]
On-call rotation: [Schedule link]
```

### Critical Failure Response | 严重故障响应

1. **Assess Impact** - How many users affected?
2. **Communicate** - Notify team and users
3. **Isolate** - Prevent further damage
4. **Restore** - From latest backup
5. **Investigate** - Root cause analysis
6. **Document** - Post-mortem report

---

## Changelog | 变更日志

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-21 | 1.0 | Initial version | System |

---

## References | 参考资料

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [K3s Documentation](https://docs.k3s.io/)
- Lucrum Internal Wiki: [Link to internal docs]
