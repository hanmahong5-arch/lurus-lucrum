# Lucrum A-Share Data Ingest Pipeline — Design

> **Status**: design only — DO NOT implement until §"Open Questions" are resolved.
> **Owner**: TBD · **Author**: 2026-04-30 · **Target service**: `2c-svc-lucrum/lucrum-web`

## Executive Summary

Lucrum 当前只装了 CSI300 一行 index k-line（725 行），无法支撑产品宣称的 "对 5000 只 A 股做策略回测"。本计划在不引入新组件的前提下，复用 `lucrum-web` 已有的 EastMoney source + `incremental-updater` + `node-cron` 架构，补齐 (1) 全市场 master list 抓取、(2) 一次性 N 年历史 backfill 脚本（in-pod，类似 `ingest-csi300.sh`）、(3) 每日 17:30 CST 增量刷新（已部分实现，需完成 wiring）、(4) 最小可行的质量检查与告警。我们刻意不在第一版引入复权因子流、行业映射或财报披露日历；它们在 schema 已留位置，但实现按 Karpathy "Simplicity First" 原则推迟到有实际策略需要时再做。

## Current State (≤10 lines)

- DB: 仅 `stocks` 1 行（000300）+ `kline_daily` 725 行（CSI300 三年日 K）。
- Code 已就位（但**没有真实数据驱动**）:
  - `src/lib/cron/incremental-updater.ts` — 全量股票增量刷新，batchSize=50, 1s delay, 3 retry exp-backoff。
  - `src/lib/cron/daily-updater.ts` — `node-cron` 注册 15:30 + 18:00 CST 两个 job，但**只在 `process.env.NODE_ENV==='production'` 启动后**有效，且必须外部 `GET /api/cron/init` 手动触发一次（Next.js 无 startup hook）。
  - `src/lib/data-service/sources/eastmoney.ts` — EastMoney quote/kline/index/flow 客户端（已包含 `fetchWithTimeout`、circuit-breaker、cache）。
  - `scripts/ingest-csi300.{ts,sh}` — 已产品化的 in-pod 单 symbol 脚手架。
  - `scripts/import-initial-data.ts` — 旧版批量导入器，含**stocks list 抓取**（`m:1+t:2,m:1+t:23` 等过滤），逻辑可复用但用 drizzle（pod 无 drizzle 运行时）。
- 部署：R6 单节点 K3s，pod limits **500m CPU / 512Mi memory**, `readOnlyRootFilesystem: true`，仅 `/tmp` 可写。

## Target State (≤10 lines)

- `stocks`: ~5,000 行（SH 主板 + 科创 + SZ 主板 + 创业 + BJ），含 symbol/name/exchange/industry/isST/listingDate/status，每周日凌晨刷新。
- `kline_daily`: ~1.25M 行/年（5000 × ~250 trading days），首批 backfill **3 年**（≈ 3.75M 行 ≈ 750MB），forward-adjusted (`fqt=1`)。
- 每日 17:30 CST 增量刷新成功率 ≥ 99%，结构化日志可在 `data_update_log` 表追溯。
- `pack_run_performance.benchmark_return / excess_mean_return` 不再因为 universe 缺失而 NULL。
- 失败模式 well-defined：EastMoney 宕机 → 用 stale data 跑回测 + UI 黄色 banner；schema 漂移 → fast-fail + 单一告警。

---

## Design

### 1. Master List Discovery — Stock Universe

**Endpoint**: `https://push2.eastmoney.com/api/qt/clist/get` （已在 `import-initial-data.ts` 验证可用）

**关键参数**:

| Param | Value | 说明 |
|-------|-------|------|
| `pn` | 1 | page number |
| `pz` | 5000 | page size — 一次拉满，避免分页 |
| `po` | 1 | 排序 desc |
| `np` | 1 | 必填 magic |
| `fltt` | 2 | 价格小数位 |
| `invt` | 2 | 必填 magic |
| `fid` | f3 | 排序字段（涨跌幅，无关紧要） |
| `fs` | 见下 | **市场过滤** |
| `fields` | f12,f14,f100,f20 | code, name, industry, market_cap |
| `ut` | bd1d9ddb04089700cf9c27f6f7426281 | 公开 token |

**fs 过滤串**（已在 `import-initial-data.ts:96-105` 验证）:
- SH 主板 + 科创：`m:1+t:2,m:1+t:23`
- SZ 主板 + 中小板 + 创业：`m:0+t:6,m:0+t:13,m:0+t:80`
- BJ：`m:0+t:81`

**Response shape**:
```json
{ "data": { "diff": [ { "f12": "600519", "f14": "贵州茅台", "f100": "白酒", "f20": 218000000000 } ] } }
```

**Rate / 限制**:
- 单次 `pz=5000` 调用 ≈ 200 KB JSON，约 1-2s 返回，未观察过 429。
- Headers 必须带 `User-Agent` 与 `Referer: https://quote.eastmoney.com/`，否则会被拒。
- 三个市场分 3 个调用，间隔 500ms（沿用 `import-initial-data.ts:403` sleep）。

**写库**: upsert by `symbol`，保留旧行业/上市日，增量更新 name/marketCap/isST。

**频率**: **周日 03:00 CST**（一次/周 已足够，新股上市频率 < 1/天且策略对新股不敏感）。

### 2. Bulk Historical Backfill — 一次性脚本

**模式**: 复制 `ingest-csi300.{ts,sh}` 的"in-pod via stdin"模式 → 新建 `scripts/backfill-all-stocks.ts` + `.sh` wrapper。

**为什么不是 K8s Job**：现 pod 已有 `pg`、`node`/`bun` 与 `DATABASE_URL` secret 挂载；新建 Job 需要复制 secret + image + ServiceAccount，与 Karpathy③"surgical changes"冲突。

**算法**:
```
1. fetchStockList() → ~5000 stocks (复用 §1)
2. for each stock (concurrency=8, NOT 50 — pod 只有 500m CPU):
     for date_chunk in [3y window split into 1y chunks]:
       fetchKLine(secid, klt=101, fqt=1, beg, end, lmt=10000)
       upsert into kline_daily ON CONFLICT (stock_id, date) DO UPDATE
       sleep 200ms (rate limit headroom)
3. Resume on failure: 跑前 SELECT max(date) per stock，从下一天开始
```

**容量估算**:
- API 调用：5000 stocks × 1 chunk（lmt=10000 一次拉满 3 年）≈ **5,000 calls**
- 网络：5000 × ~50 KB ≈ 250 MB 下载
- DB 写：~3.75M rows × ~80 B = ~300 MB 净增（实际 PG 表 + 索引 ≈ 750 MB）
- **耗时估算**: 5000 / concurrency=8 × 0.5s/call ≈ **5 分钟纯拉取** + DB 写入 ≈ 15-20 分钟整体。
- **峰值内存**: 单 chunk ≈ 50 KB JSON × 8 并发 ≈ < 5 MB；pod 512Mi 充裕，无需调 limits。
- **CPU**: 解析 + drizzle/pg 序列化是 IO-bound，500m CPU 够用。

**幂等**: `kline_daily.uniqueStockDate` 已在 schema 上 (line 209)，`ON CONFLICT DO UPDATE` 即可。重跑等价。

**Resume**: 启动时按 `(stock_id, max(date))` 分组判断，每只 stock 独立断点；任一失败不影响其他。

### 3. Daily Incremental Refresh

**已实现**: `runIncrementalUpdate()` (incremental-updater.ts:315) + `node-cron` 18:00 CST job (daily-updater.ts:168)。

**改动**（最小化）:
- **改时间到 17:30 CST**：A 股 15:00 收盘后，EastMoney 通常 16:30-17:00 出盘后数据。18:00 偏保守。改 `'30 17 * * 1-5'`。
- **保留 15:30 旧 `runUpdate()`** 还是删？决策：**删除** `daily-updater.ts` 内的旧 `runUpdate` 路径（仅保留 cron 调用 `runIncrementalUpdate`），因为它跟 incremental 重复，违反 CLAUDE.md "单一执行路径"。
- `targetStocks = stocks.status='active'` — incremental-updater.ts:340 已正确处理。**Halts/suspended** 在 EastMoney 返回 `klines: []`，updater 跳过（行 429-431 已处理），无需额外逻辑。
- **on-demand staleness**：用户在前端选股时，`useDataFreshness(symbol)` 已经存在；但 AC-5 中"自动触发更新"目前未接通，**第一版不接** — 在线更新 5000 stocks 跨域用户体验差，让 cron 处理。

**Idempotency**: 同 §2，`ON CONFLICT DO UPDATE`。

**A-share 数据可用时点**:
- 收盘 15:00 → 盘后整理 ~16:30 → EastMoney quote API 17:00 左右更新 → **保险线 17:30**。
- 节假日/周末跳过：`isTradingDay()` (daily-updater.ts:63) 已实现。
- 半日市（如除夕）：当前 `tradingCalendar` 表存在但**无数据**——本期暂用周一-周五硬过滤 + China holiday 静态表（data-freshness.ts:66）。**已知缺陷**：农历春节、清明、端午、中秋公历日期每年偏移，需手动维护。开放问题见 §"Open Questions"。

### 4. Quality Checks

第一版只做**便宜的、能在 ingest 当时立即检测的 4 条**，输出到现有 `data_update_log` 表的 `error_message` 字段（per-update aggregate）+ stdout JSON 日志：

| Check | 规则 | 失败处理 |
|-------|------|----------|
| OHLC self-consistency | `low ≤ min(open,close) ≤ max(open,close) ≤ high` 且 `low > 0` | **拒绝写入**该行，记 `recordsFailed++` |
| Daily limit | `abs(close/prev_close - 1) ≤ 0.21` （21% 容忍 ST 20% 限+滑点） | **写入**但打 warning，UI 不拒展示 |
| Zero-volume halted day | `volume==0 && date is trading day` | **写入**（合法，停牌当日有 quote 没成交），但写 `stock_halt_calendar` |
| Missing trading day | DB 缺当周某交易日数据，但 stock 状态 active | 记入 `data_update_log.error_message`，下次 cron 自动补 |

**不做的事**（推迟）：跨数据源对账（Sina vs EastMoney）、ST/退市状态自动检测（已有 `stockStatusHistory` 表但不在 ingest 关键路径上）、复权因子重算（forward-adjusted 由 EastMoney `fqt=1` 提供，足够 v1）。

**告警通道**: 第一版**不接 NATS**。`/api/cron/init` 返回值 + UI dashboard 上的 "Last update: 17:33 CST · 4923/5012 stocks updated" StatusBar 行（StatusBar 组件已存在，story 1-3-status-bar）。如果 `recordsFailed > 5%` 或 `success=false`，加红色 badge。

### 5. Schedule Mechanism — 沿用 `node-cron`

**决策：扩展现有 `node-cron + /api/cron/init` 模式**。

| Option | 评估 |
|--------|------|
| **A. 现有 node-cron + /api/cron/init**（选） | ✅ 已部署、已验证（CSI300 alpha 路径）、零新组件。⚠️ 仅在单 pod 时安全；HPA 起 N pod 会触发 N 次 cron — 当前 hpa.yaml 是 `minReplicas: 1, maxReplicas: 1` 故无问题，但日后扩容需加 leader-election 或迁 K8s CronJob。 |
| B. K8s CronJob | ❌ 需要复制 secret + image + RBAC，违反 surgical change |
| C. 新内部调度器 | ❌ 重新发明轮子 |

**约束**: 不在 ingest 内**等待** `init` — 若 `/api/cron/init` 30 分钟内没有外部触发（CD 流程已包含），冷启动 pod 不跑 cron。这是已知 trade-off（lucrum-monitoring §3 已记录）。

**未来迁移路径**：当 lucrum-web 扩容到 ≥ 2 replica，立即拆出 K8s CronJob（独立 pod，跑 `bun scripts/run-incremental.ts`，避开 leader 问题）。在 plan 中**不实现**，但 schema/code 不阻塞这条路。

### 6. Resource Budget

**Pod 现状（web-deployment.yaml:154-160）**:
```yaml
requests: { cpu: 100m, memory: 256Mi }
limits:   { cpu: 500m, memory: 512Mi }
```

**ai-qtrd 已饱和（2cpu/3Gi）— 整个 ingest 留在 lucrum-web，不碰 ai-qtrd。**

| Phase | CPU 占用 | 内存峰值 | 持续 |
|-------|---------|---------|------|
| Bulk backfill (5000 stocks × 3y) | ~300m（IO bound） | < 50 MB working set | 15-20 min |
| 每日 17:30 cron | ~250m for 30s spikes | < 30 MB | ≈ 5-10 min |
| Master list 周抓 | < 100m | < 5 MB | < 30s |

**结论**: pod limits 不需调整。但需监控：backfill 期间 pod 仍在响应 web request，CPU 抢占可能导致用户页面卡顿。**建议 backfill 窗口选 02:00-03:00 CST**（用户低峰），并在脚本里加 `--concurrency` flag 默认 8、可调到 4。

### 7. Migration Order

**严格按以下序，每步有验证 gate；任一 gate 失败 → 不进下一步。**

```
Step 0  schema 确认 — 跑 bun run db:push（无 diff，schema 已对齐）
        Gate: drizzle-kit 报告 0 changes
        
Step 1  Master list bootstrap (一次性)
        bash scripts/bootstrap-stock-list.sh   # 新增（仿 ingest-csi300.sh）
        Gate: SELECT count(*) FROM stocks WHERE status='active' >= 4500
        
Step 2  Historical backfill (一次性)  
        YEARS=3 CONCURRENCY=8 bash scripts/backfill-all-stocks.sh
        Gate: SELECT count(distinct stock_id) FROM kline_daily >= 4500
              AND SELECT min(date), max(date) FROM kline_daily 显示 ~3 年跨度
        
Step 3  Daily incremental — 改时间到 17:30 + 删除旧 runUpdate
        修改 daily-updater.ts，部署，外部触发 /api/cron/init
        Gate: 一个交易日后跑 SELECT * FROM data_update_log 
              WHERE update_type='incremental' AND status='success' 
              ORDER BY id DESC LIMIT 1
              
Step 4  Quality checks — 加 OHLC validator + warning 路径
        Gate: 单元测试 4 条，bun run test 全绿
        
Step 5  ✅ ONLY NOW 打开 monitoring (Phase 7.7 alpha-decay) 在全 universe 上跑
        Gate: pack_run_performance.benchmark_return 不再 NULL
              且 excess_mean_return 落在 [-30%, +30%] 区间
        
Step 6  Master list 周日刷 — node-cron 加 '0 3 * * 0' 跑 fetchStockList
        Gate: 一周后跑 SELECT max(updated_at) FROM stocks 在最近 7 天内
```

**Rollback**:
- Step 1-2 失败：`DELETE FROM kline_daily WHERE stock_id != <CSI300>; DELETE FROM stocks WHERE symbol != '000300';` — 回到当前状态。
- Step 3 失败：revert daily-updater.ts 那个 commit；旧 15:30 + 18:00 双 cron 模式比新 17:30 单 cron 更稳（虽然冗余）。
- Step 5 失败：把 pack_run_performance scheduler 关掉（注释 `initializePackRunPerformanceScheduler()`），不影响其他。

### 8. Failure Modes & Ops

| 故障 | 表现 | Ops 第一手命令 | 缓解 |
|------|------|---------------|------|
| EastMoney 全宕 24h | `incremental_update_complete` 日志 `recordsInserted=0`, `failedSymbols=5000` | `kubectl logs -n lucrum -l app=lucrum-web --tail=200 \| grep incremental` | 回测仍可跑（用 stale data）；UI banner 红色 "Data 24h+ stale"（StatusBar） |
| 部分 day 拿到 partial（盘中宕） | 部分 stock klines=[] 部分有 | `SELECT count(*) FROM kline_daily WHERE date=...` | 下一次 cron 自动补；可手动 `bash scripts/backfill-all-stocks.sh --since=2026-04-30` |
| EastMoney response shape 改 | 解析失败、`fetchKLineRange` 返回 null、`failedSymbols` ↑↑ | 同上 + 看日志里 stack trace | 改 `eastmoney.ts:269` parser，发紧急 PR；fallback 用 `sina.ts` source（已存在但未集成） |
| pod CPU throttling 致 ingest 卡 | `durationMs > 3 min` for incremental | `kubectl top pod -n lucrum` | 暂时将 `concurrency` 降到 4；考虑临时 `kubectl set resources` 抬 CPU limit（注意三铁律：不做永久 patch） |
| DB 连接耗尽 | `too many connections` | `SELECT count(*) FROM pg_stat_activity` | `pg.Pool` max 当前 4 (csi300 脚本) / drizzle 池 (cron) 各算；总 < 20 应安全 |
| 周末手动跑 cron | `incremental` 跑了但拿到 0 行 | 看日志 "Not a trading day, skipping" | 已被 `isTradingDay()` 屏蔽，无需处理 |

**Ops dashboard 入口**：
1. `data_update_log` 表 — 最近 30 条 update 记录
2. `kubectl logs -n lucrum -l app=lucrum-web` 抓 `event=incremental_update_complete`
3. UI StatusBar — 普通用户看 freshness badge

---

## Migration Plan — Concrete Sequence

| # | Action | Who | Verify |
|---|--------|-----|--------|
| 0 | review + approve this plan, 决定 §"Open Questions" | Maintainer | sign-off |
| 1 | 写 `scripts/bootstrap-stock-list.{ts,sh}`（仿 csi300 形态，用 pg only） | Dev | unit test parser；dry-run --limit=10 |
| 2 | 跑 step 1 in pod | Dev | gate: stocks count ≥ 4500 |
| 3 | 写 `scripts/backfill-all-stocks.{ts,sh}` + concurrency control + resume | Dev | unit test missing-range detector；dry-run 单 stock |
| 4 | 跑 step 2 在 R6 凌晨 02:00 窗口 | Dev | gate: kline_daily distinct stock_id ≥ 4500 |
| 5 | 改 daily-updater.ts: 删旧 `runUpdate` 路径，cron 改 17:30 | Dev | bun run test + bun run typecheck |
| 6 | 部署，外部触发 `/api/cron/init` | Dev | gate: 下个交易日 17:35 看 data_update_log |
| 7 | 加 OHLC validator + 4 条 quality checks（incremental-updater.ts 写入前） | Dev | 4 个新 vitest case |
| 8 | 部署，验证 Step 5 alpha 路径 | Dev | gate: pack_run_performance.benchmark_return 非 NULL |
| 9 | 加周日 03:00 master list 刷新 cron | Dev | gate: 一周后 stocks.updated_at 最近 7 天 |

每步独立 commit，失败可单独 revert。

---

## Open Questions / Risks

> **以下问题必须 maintainer 决定，否则 implementation 无法启动。**

1. **❓ 中国节假日数据来源** — `data-freshness.ts:66` 用静态硬编码（春节日期写死 `1/28-2/6`），每年农历偏移会失准。选项：
   - (a) 引入 [chinese-calendar](https://www.npmjs.com/package/chinese-lunar-calendar) npm 包（+ 一次性维护）
   - (b) 启用 `tradingCalendar` 表 + 每年初手动 SQL 灌一次（最简单，但人工依赖）
   - (c) 抓上交所官网公告 API（最完整，工作量大）
   - **推荐 (b)**，但要确认 maintainer 接受"每年 12 月手动 INSERT"。

2. **❓ Backfill 是否要 2 年还是 3 年还是 5 年** — 多 1 年 = +1.25M 行 + ~250 MB。当前 PG (CNPG) 在 R6 上的可用磁盘？需查 `kubectl exec -it <pg-pod> -- df -h /var/lib/pgsql`。**不能**在不知 disk headroom 时盲选 5 年。

3. **❓ HPA 未来扩容**（risk） — 当前 `maxReplicas: 1`，cron 安全。但若运营要 HA，cron 会重复跑触发竞争。决策：(a) 加 leader-election 库（pg_advisory_lock 最廉价）；(b) 拆 K8s CronJob。**计划文档把决策延后到扩容时**，但记入风险登记。

4. **❓ EastMoney 单源 risk** — 如果哪天封了我们 IP 或 schema 改了，整个 ingest 死。`sina.ts` 已存在但未集成，做不做 multi-source fallback？做了 = 复杂度 +2x；不做 = 单点。**建议先不做**，但要在告警里特别处理 "连续 3 次 incremental 全失败" 触发邮件 / 飞书（暂未实现告警通道，又是一个 TODO）。

5. **❓ 复权因子单独表** — 当前 `kline_daily.adj_factor` 是 forward-adjusted 价格里的 redundant 字段（EastMoney `fqt=1` 直接给调整后价）。如果策略需要"还原原始价 + 单独复权流"，需新表 `corporate_actions(symbol, ex_date, type, ratio, ...)`。**v1 不做**，但 schema 上要不要预留？倾向"不预留，需要时再加 migration"——避免空表 noise。

6. **❓ Industry sector 数据流** — 我们抓了 `industry` 字段进 `stocks.industry`，但 schema 还有 `sectors` + `stockSectorMapping` + `sectorComponentSnapshots` 三张表（line 127, 155, 1417）。Phase 7.7 alpha-decay 是否依赖这些？如果不依赖 → 这次 ingest **完全不碰**这三张表。如果依赖 → 还要再加一条 ingest 流（EastMoney `BK0xxx` 板块 API）。**需 maintainer 确认 monitoring/Phase7 是否真的要 sector universe**——若要，工作量翻倍。

7. **❓ BMAD 已 mark "done" 的 stories 怎么办** — `7-1-realtime-market-data` 和 `legacy-6-1-stock-kline-data-import` 都标 done，但实际生产 DB 只有 1 只股票。这是**虚报完成**（违反 CLAUDE.md §2 honesty constraint）。决定 (a) 改 sprint-status.yaml 把它们改回 in-progress；(b) 新建 epic 8 "data ingest production rollout" 独立追踪。**推荐 (b)**——"已写代码"和"已上数据"是两件事，stories 描述的是前者。

---

## Appendix: Files Touched

**新增**:
- `lucrum-web/scripts/bootstrap-stock-list.ts` + `.sh`
- `lucrum-web/scripts/backfill-all-stocks.ts` + `.sh`
- `lucrum-web/src/lib/cron/__tests__/quality-checks.test.ts`
- `plans/data-ingest-pipeline.md`（本文件）

**修改**:
- `lucrum-web/src/lib/cron/daily-updater.ts` — 删旧 `runUpdate`，cron 改 17:30，加周日 master-list job
- `lucrum-web/src/lib/cron/incremental-updater.ts` — 写入前加 OHLC validator
- `lucrum-web/src/app/api/cron/init/route.ts` — 返回值加 stock-list-refresh job 描述
- `2c-svc-lucrum/_bmad-output/implementation-artifacts/sprint-status.yaml` — Open Q #7 决定后

**不动**:
- `deploy/k8s/web-deployment.yaml` — pod limits 够用
- DB schema — 已对齐，无 migration
- `ai-qtrd/` — 完全无关
