# Lucrum Database Deployment Guide
# Lucrum数据库部署指南

> 最后更新: 2026-01-22

## Prerequisites | 前置条件

- K3s cluster with PostgreSQL running
- kubectl access to the cluster
- **Bun 1.0+** installed on deployment server (推荐) or Node.js 18+

## Step 1: Database Schema Deployment | 数据库Schema部署

### Option A: Deploy from Master Node (Recommended) | 从主节点部署（推荐）

**1. Upload source code to master node:**

```bash
# From local Windows machine
cd lucrum-web
tar --exclude='node_modules' --exclude='.next' --exclude='.git' \
    --exclude='test-*' -czvf lucrum-db-setup.tar.gz .

scp lucrum-db-setup.tar.gz root@100.98.57.55:/root/
```

**2. SSH to master node and extract:**

```bash
ssh root@100.98.57.55

cd /root
mkdir -p lucrum-db-setup
tar -xzf lucrum-db-setup.tar.gz -C lucrum-db-setup
cd lucrum-db-setup
```

**3. Install dependencies:**

```bash
# Using Bun (recommended, 10-20x faster)
bun install

# Or using npm
npm install
```

**4. Configure environment variables:**

```bash
# Create .env.local
cat > .env.local << EOF
DATABASE_URL=postgresql://postgres:password@postgres-service:5432/lucrum
NODE_ENV=production
EOF
```

**5. Push database schema:**

```bash
bun run db:push  # or: npm run db:push
```

Expected output:
```
✅ Your database is now in sync with your Drizzle schema
✓ Tables created: 7
  - stocks
  - sectors
  - stock_sector_mapping
  - kline_daily
  - data_update_log
  - validation_cache
  - validation_presets
```

### Option B: Port Forwarding from Local Machine | 本地端口转发

**1. Set up kubectl port forward:**

```bash
kubectl port-forward -n ai-qtrd svc/postgres-service 5432:5432
```

**2. Update .env.local:**

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/lucrum
```

**3. Run db:push:**

```bash
bun run db:push  # or: npm run db:push
```

## Step 2: Initial Data Import | 初始数据导入

**Warning:** This process will take 3-6 hours due to API rate limits.
**警告：** 由于API速率限制，此过程需要3-6小时。

### Import Stocks and Sectors Only (Fast, ~1-2 minutes) | 仅导入股票和板块（快速，约1-2分钟）

```bash
bun run db:import:stocks  # or: npm run db:import:stocks
```

Expected output:
```
========================================
[Import] Starting stock import...
========================================

[Import] Fetching all A-share stocks...
[Import] Found 5247 stocks
[Import] Imported 5247/5247 stocks
[Import] ✅ Stock import complete. Total: 5247 stocks

========================================
[Import] Starting sector import...
========================================

[Import] Fetching all industry sectors...
[Import] Found 152 sectors
[Import] ✅ Imported 152 sectors

[Import] Building stock-sector mappings...
[Import] Mapped sector BK0478: 215 stocks
...
[Import] ✅ Stock-sector mapping complete. Total: 9847 mappings

✅ Import completed successfully!
```

### Import K-line Data (Slow, 3-6 hours) | 导入K线数据（慢，3-6小时）

```bash
# Full import (stocks + sectors + K-lines)
bun run db:import  # or: npm run db:import

# Or just K-lines if stocks already imported
bun run db:import:klines  # or: npm run db:import:klines
```

**Progress monitoring:**
```
[Import] Progress: 1000/5247 (19.1%) - Total records: 487354 - Failed: 23
[Import] Progress: 2000/5247 (38.1%) - Total records: 981207 - Failed: 51
...
```

**Run in background (tmux/screen recommended):**
```bash
# Start tmux session
tmux new -s db-import

# Run import
bun run db:import:klines  # or: npm run db:import:klines

# Detach: Ctrl+B, then D
# Re-attach: tmux attach -t db-import
```

## Step 3: Verify Import | 验证导入

**1. Check table counts:**

```bash
kubectl exec -n ai-qtrd -it $(kubectl get pod -n ai-qtrd -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -d lucrum -c "
SELECT
  'stocks' AS table_name, COUNT(*) AS row_count FROM stocks
UNION ALL SELECT 'sectors', COUNT(*) FROM sectors
UNION ALL SELECT 'stock_sector_mapping', COUNT(*) FROM stock_sector_mapping
UNION ALL SELECT 'kline_daily', COUNT(*) FROM kline_daily
UNION ALL SELECT 'data_update_log', COUNT(*) FROM data_update_log
UNION ALL SELECT 'validation_cache', COUNT(*) FROM validation_cache
UNION ALL SELECT 'validation_presets', COUNT(*) FROM validation_presets;
"
```

Expected output:
```
     table_name        | row_count
-----------------------+-----------
 stocks                |      5247
 sectors               |       152
 stock_sector_mapping  |      9847
 kline_daily           |   2618750  (2.6M records for 2 years)
 data_update_log       |         0  (empty initially)
 validation_cache      |         0  (empty initially)
 validation_presets    |         0  (empty initially)
```

**2. Check database size:**

```bash
kubectl exec -n ai-qtrd -it $(kubectl get pod -n ai-qtrd -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -d lucrum -c "
SELECT pg_size_pretty(pg_database_size('lucrum')) AS db_size;
"
```

Expected: ~300MB for 2 years of data

**3. Sample data query:**

```bash
kubectl exec -n ai-qtrd -it $(kubectl get pod -n ai-qtrd -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -d lucrum -c "
SELECT s.symbol, s.name, COUNT(k.id) AS kline_count
FROM stocks s
LEFT JOIN kline_daily k ON k.stock_id = s.id
WHERE s.symbol IN ('600519', '600036', '000858')
GROUP BY s.symbol, s.name;
"
```

Expected output:
```
 symbol | name     | kline_count
--------|----------|------------
 600519 | 贵州茅台 | 488
 600036 | 招商银行 | 492
 000858 | 五粮液   | 491
```

## Step 4: Enable Daily Auto-Update | 启用每日自动更新

**The cron job is automatically initialized when the application starts.**

Verify cron job is running:

```bash
curl https://lucrum.lurus.cn/api/cron/init
```

Expected response:
```json
{
  "success": true,
  "message": "Cron jobs initialized successfully",
  "jobs": {
    "dailyDataUpdater": {
      "enabled": true,
      "schedule": "15:30 CST (Mon-Fri)"
    }
  },
  "timestamp": "2026-01-21T08:30:00.000Z"
}
```

## Step 5: Monitor Daily Updates | 监控每日更新

**Admin dashboard:**

Navigate to: https://lucrum.lurus.cn/admin/data-updates

**Manual trigger (if needed):**

```bash
curl -X POST https://lucrum.lurus.cn/api/data/update \
  -H "Content-Type: application/json" \
  -d '{"updateType": "daily", "force": false}'
```

**Check update logs:**

```bash
kubectl exec -n ai-qtrd -it $(kubectl get pod -n ai-qtrd -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -d lucrum -c "
SELECT * FROM data_update_log ORDER BY created_at DESC LIMIT 10;
"
```

## Troubleshooting | 故障排查

### Issue 1: Connection Refused

**Symptoms:**
```
Error: connect ECONNREFUSED
```

**Solutions:**
1. Check PostgreSQL pod status:
   ```bash
   kubectl get pods -n ai-qtrd | grep postgres
   ```
2. Check service:
   ```bash
   kubectl get svc -n ai-qtrd postgres-service
   ```
3. Test connection from within cluster:
   ```bash
   kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
     psql -h postgres-service -U postgres -d lucrum
   ```

### Issue 2: Schema Push Fails

**Symptoms:**
```
Error: relation "stocks" already exists
```

**Solutions:**
1. This is expected if tables already exist
2. Use `bun run db:push  # or: npm run db:push` again - it will show "Database is in sync"
3. Or manually drop and recreate:
   ```bash
   kubectl exec -n ai-qtrd -it <postgres-pod> -- \
     psql -U postgres -d lucrum -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```

### Issue 3: Import Takes Too Long

**Symptoms:**
- Import running for >12 hours

**Solutions:**
1. Check network connectivity
2. Reduce BATCH_SIZE in import script
3. Import in stages:
   - First: `bun run db:import:stocks  # or: npm run db:import:stocks`
   - Then: `bun run db:import:klines  # or: npm run db:import:klines` (run overnight)

### Issue 4: Out of Memory During Import

**Symptoms:**
```
JavaScript heap out of memory
```

**Solutions:**
1. Increase Node.js memory:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 bun run db:import:klines  # or: npm run db:import:klines
   ```
2. Reduce batch size in script

## Next Steps | 后续步骤

After successful deployment:

1. ✅ Database schema created (7 tables)
2. ✅ Initial data imported (2.6M records)
3. ✅ Daily auto-update enabled (15:30 CST)
4. ⏭️ Deploy updated application (v15) with Phase 14 features
5. ⏭️ Test individual stock multi-selector
6. ⏭️ Test 100-stock backtest performance (<10s)

## Reference | 参考

- Database Maintenance Guide: `doc/database-maintenance.md`
- Phase 14 Completion Report: `doc/process.md` (Phase 14 section)
- Drizzle ORM Docs: https://orm.drizzle.team/
