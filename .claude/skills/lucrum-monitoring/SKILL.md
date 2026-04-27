---
name: lucrum-monitoring
description: "Lucrum 监控/Alpha-decay 子系统的运维与扩展手册（Phase 7.7 蓝图）。涵盖 forward-return + 基准超额 alpha 计算正确性规则、定时调度器、CSI300 入库 playbook、E2E 排错决策。当用户提到 monitoring/alpha/forward-return/CSI300/pack_run_performance/scheduler 时自动启用。"
---

# Lucrum Monitoring — Phase 7 Alpha-Decay Stack

**目的**: 为 `/dashboard/monitoring` 的 forward-return + 基准超额 α 子系统提供**正确性宪法 + 运维 playbook**。看到本 skill 之前必读 `troubleshoot` skill 的 Cluster Context 段（lucrum 生产在 R6）。

## When to Use

- 用户提到 `monitoring` / `alpha` / `α 衰减` / `forward return` / `回看` / `CSI300` / `基准`
- DB 表 `pack_run_performance` / `pack_runs` 改动
- 调度器 `PackRunPerformanceScheduler` 行为异常
- 计算口径质疑（"我的 alpha 怎么算出来的？"）

---

## 1. 架构鸟瞰

```
pack_runs (success runs)                         users
   │                                                │
   │ run_id (FK CASCADE)                            │ user_id (FK CASCADE)
   ▼                                                ▼
pack_run_performance ─── PackRunPerformanceScheduler ──┐
   │ horizonDays × topN                                 │ 07:00 CST Mon-Fri
   │ benchmark_symbol/return/excess_mean_return         │ initialized via /api/cron/init
   │                                                    │
   ▼                                                    ▼
GET /api/monitoring/alpha-trend ───→ /dashboard/monitoring (SVG sparkline)
GET /api/monitoring/pack-run-performance/[runId]
```

**单一事实源**:
- 行情：`kline_daily.close × COALESCE(adj_factor, 1.0)` （前复权口径）
- 基准：`kline_daily WHERE symbol = $BENCHMARK_SYMBOL`（默认 `000300` CSI300）
- 个股池：`stocks.status = 'active'`（survivorship filter — 强制）
- 退市/停牌：当日 `kline_daily` 没行 → 该 symbol 被自动剔除（implicit halt-day exclusion）

---

## 2. 计算正确性宪法（不可违反）

任何对 `lucrum-web/src/lib/strategy-packs/pack-run-performance.ts` 的改动必须保留：

### 2.1 复权 — adj_factor

```sql
-- ✅ 正确
SELECT k.symbol, k.trade_date, k.close * COALESCE(k.adj_factor, 1.0) AS price ...
-- ❌ 错误：直接用 close → 拆分/分红日跳变 → 假高/假低 forward return
SELECT k.symbol, k.trade_date, k.close ...
```

### 2.2 幸存者偏差 — survivorship

```sql
-- ✅ 个股 series 必须 join stocks 过滤
INNER JOIN stocks s ON s.symbol = k.symbol
WHERE s.status = 'active' ...
-- ❌ 不过滤 → 退市股会被算进 forward return（已退市股价格停在最后一天，看似稳定）
```

但 **基准 series 不能过滤** `status='active'`（CSI300 是伪股票，但即使加了 active 也允许；真正风险是**未来某天加 status='listed' 之类**会把基准过滤掉）。`fetchBenchmarkSeries()` 故意不 join `stocks`。

### 2.3 超额 α — 不要静默 0

```typescript
// ✅ 正确：任一为 NULL 就 NULL
const excessMean = mean !== null && benchReturn !== null
  ? mean - benchReturn
  : null;

// ❌ 错误：把 NULL 当 0 → 当 CSI300 缺失时 alpha 直接 = mean，骗用户
const excessMean = (mean ?? 0) - (benchReturn ?? 0);
```

UI 必须把 NULL 渲染成 `—`，不是 `0.00%`。

### 2.4 Halt-day 隐式剔除

`kline_daily` 只入交易日数据，停牌日没有行。`fetchPriceGrid` 用 `ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date)` 取相对偏移 N，等价于"忽略停牌日"。这是**正确**且**简单**的口径。不要改成日历日 join。

### 2.5 样本量 confidence

UI 在 `evaluatedCount < MIN_SAMPLE_FOR_SIGNAL`(=10) 时挂 `n<10` badge + 半透明，提示样本量不足。改阈值要同步改 `dashboard/monitoring/page.tsx` 的常量。

---

## 3. 数据库 schema 速查

```sql
-- pack_run_performance（Phase 7.7 后 16 列）
run_id              text     PK, FK pack_runs(run_id) ON DELETE CASCADE
horizon_days        int      PK
top_n               int      PK
evaluated_count     int      ≥ 0
mean_return         real     可 NULL
median_return       real     可 NULL
hit_rate            real     可 NULL
benchmark_symbol    varchar(20)   '000300' 或 NULL
benchmark_return    real     CSI300 不在则 NULL
excess_mean_return  real     mean - benchmark_return; 任一 NULL 则 NULL
computed_at         timestamptz
... (其他统计列)

-- 关键约束（migration 0008）
CONSTRAINT fk_pack_run_perf_run_id
  FOREIGN KEY (run_id) REFERENCES pack_runs(run_id)
  ON DELETE CASCADE ON UPDATE CASCADE;
```

完整 schema 看 `lucrum-web/src/lib/db/schema.ts` + `lucrum-web/drizzle/0008_pack_run_alpha.sql`。

---

## 4. 调度器（PackRunPerformanceScheduler）

```
lucrum-web/src/lib/cron/pack-run-performance-scheduler.ts
  • cron '0 7 * * 1-5' Asia/Shanghai
  • REFRESH_LOOKBACK_DAYS = 200
  • MAX_RUNS_PER_TICK    = 500
  • DEFAULT_HORIZONS     = [1, 5, 20]
  • DEFAULT_TOP_N        = 10
  • singleton 进程内（每个 replica 都跑 — 幂等 upsert 但浪费 CPU；副本 > 1 需 leader 选举）
```

**启动模式**: Next.js 没有 startup hook。**必须**外部触发一次 `GET /api/cron/init`。建议：
- `kubectl rollout status` 完成后立刻 `kubectl exec ... wget /api/cron/init`
- 或在 web-deployment.yaml 加 `postStart` lifecycle hook 调本地 3000 端口

**手动 backfill**:
```bash
# 强制立刻刷一轮（响应里看 refreshedRuns / errors）
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=120 http://localhost:3000/api/cron/init"
```

---

## 5. CSI300 Ingest Playbook（**当前未做的关键 follow-up**）

**为什么重要**: CSI300 不入库 → benchmark_return / excess_mean_return 永远 NULL → 监控的"alpha 衰减"图退化为"绝对收益"图。

**步骤**（在 R6 lucrum DB 内）:

### 5.1 注册 000300 为伪 stock 行

```sql
-- 通过 R6 peer-auth 执行
INSERT INTO stocks (symbol, name, exchange, status, listed_at)
VALUES ('000300', '沪深300', 'SH', 'active', '2005-04-08')
ON CONFLICT (symbol) DO UPDATE
  SET name = EXCLUDED.name,
      exchange = EXCLUDED.exchange,
      status = EXCLUDED.status;
```

### 5.2 拉取并写入 kline_daily

复用 `lucrum-web/scripts/import-initial-data.ts` 的 EastMoney fetch 模式，传入 `symbol='000300', exchange='SH', code='1.000300'`（EastMoney secid 格式：交易所代码 1=SH 0=SZ）。回填范围建议 **3 年**（覆盖最长 horizon 120 + 缓冲）。

最小化产品化命令（拟）：
```bash
cd lucrum-web
bun run scripts/import-initial-data.ts --symbol 000300 --years 3
```
（如该参数化未实现，需要先扩 `import-initial-data.ts` 接受 symbol/years 参数。）

### 5.3 验证 + 触发计算

```bash
# 行数检查
ssh root@100.122.83.20 "kubectl exec -n database lurus-pg-0 -- psql -U postgres -d lucrum -c \
  \"SELECT count(*), min(trade_date), max(trade_date) FROM kline_daily WHERE symbol='000300';\""
# 期望: count > 700, max ≈ 今天

# 触发刷新
ssh root@100.122.83.20 "kubectl -n lucrum exec deploy/lucrum-web -- \
  wget -q -O- --timeout=120 http://localhost:3000/api/cron/init"

# 验 alpha 写入
ssh root@100.122.83.20 "kubectl exec -n database lurus-pg-0 -- psql -U postgres -d lucrum -c \
  \"SELECT count(*) FILTER (WHERE benchmark_return IS NOT NULL) AS with_alpha, \
           count(*) AS total \
    FROM pack_run_performance;\""
# 期望: with_alpha > 0
```

### 5.4 切换基准（如需）

如果将来要用 CSI500 / 中证全指：
- 部署设 `PACK_RUN_BENCHMARK_SYMBOL=000905`
- 入库对应 symbol
- 既有行不会回填 — 需手动 truncate 重算或写迁移

---

## 6. SSE + withUser 不兼容（架构经验）

**坑**: `withUser` 包装器返回 `NextResponse<T>`，但 SSE 端点 (`POST /api/funnel/run`) 必须返回 `Response { body: ReadableStream }`。typescript 报错 `Type 'Response' is not assignable to NextResponse<...>`.

**修复模式**: 在路由内**内联**鉴权解析：

```typescript
async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const claims = await verifyZitadelJWT(auth.slice(7));
    return claims?.sub ?? null;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await resolveUserId(request);
  if (!userId) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: 'unauthorized' })}\n\n`,
      { status: 401, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
  // ... stream ...
}
```

**安全约束**: 永远**不**接受请求体里的 `userId` 字段。Body 上的 userId 等于让用户自己声明身份 = 越权。

---

## 7. 端点 cheatsheet

```
GET  /api/monitoring/pack-run-performance/[runId]
        Auth: session 或 Bearer JWT
        Returns: { runId, asOfDate, packId, packName, status, performance: [...] }

GET  /api/monitoring/alpha-trend?horizon=20&topN=10&limit=20
        Auth: session 或 Bearer JWT
        Returns: { horizon, topN, items: TrendPoint[] }
        items 按 asOfDate 升序（左→右 chronological）

GET  /api/cron/init
        无需鉴权（启动护士），返回各 scheduler 状态
        副作用: 启动 3 个 scheduler singleton（dailyDataUpdater / incrementalUpdater / packRunPerformanceScheduler）
```

---

## 8. Roadmap（已开但未做）

按用户已认可的优先级：

1. **CSI300 ingest** — see §5（最高优先级，所有 alpha 数据依赖）
2. 每个 symbol 下钻（用户点单只票看 forward-return 分布）
3. Sharpe / Max-DD 每篮子（Phase 7 当前只有 mean/median/hit-rate）
4. CSV export 监控页表格
5. Prometheus SLO 指标（pack-run latency / scheduler tick freshness）

---

## 9. 扩展本 Skill

遇到新坑/新规则：
- **正确性** → §2 加一条
- **新坑** → 新章节，附 `症状 → 排查命令 → 根因 → 修复` 四件套
- **新端点 / scheduler** → §4 / §7 同步更新
- **保持 < 250 行**。超出就把详情挪 `references/`。
