<!-- 归档: doc/archive/process_v20260225.md (2026-02-25 之前的所有条目) -->

## 2026-02-26: 回测引擎 A 股交易规范合规修正
印花税 0.1%→0.05%（2023-08-28新规）、最低佣金5元、过户费0.001%双向、涨跌停按板块动态（主板±10%/科创创业±20%/北交所±30%/ST±5%）、科创板200股/手。
修改: engine.ts, types.ts, financial-math.ts, transaction-costs.ts, lot-size.ts, backtest-panel.tsx
测试更新: transaction-costs.test.ts, financial-math.test.ts（期望值同步修正）
Verification: `bun run typecheck → 0 errors` | `vitest run → 1021/1028 passed (7 pre-existing cache-badge failures)`

---

## 2026-02-25: 回测引擎精准化 + UI 全面按钮化
1. engine.ts: 修复前瞻偏差（pending order，成交用 open 价）、T+1/涨跌停规则、正确Sharpe/Sortino(CHINA_RISK_FREE_RATE=0.02)、MDD时间、印花税、WFO分割、基准对比
2. statistics.ts: buildRiskMetrics/calculateRiskAdjustedReturns Sortino 改用全序列 min(r,0)；复利年化替换线性年化
3. types.ts: 新增 enableT1/enableCircuitBreaker/stampDuty/wfSplitRatio/benchmarkKlines 配置；新增 benchmarkReturn/alpha/beta/IR/WFO 输出
4. backtest-panel.tsx: 资金/时间颗粒度/日期区间/手续费/滑点全改为按钮组；新增 T+1/涨跌停 Toggle、WFO 三段按钮
5. parameter-editor.tsx: Number 参数 range≤200 自动改用 Slider + 快捷刻度
6. follow-up-chips.tsx + advisor-chat.tsx: AI 回复后追加后续问题芯片；首屏添加零打字开场问题组
7. advisor chat/route.ts: 解析 <!--QUESTIONS:[...]→> 标记，返回 suggestedQuestions
Verification: `bun run typecheck → 0 errors` | `bun run test → 2478/2485 passed (7 pre-existing cache-badge failures, 不相关)`

## 2026-02-25: 股神平台三项改造 (Auth + RealBacktest + BacktestAgent)
1. auth.ts: 替换 lurus-sso CredentialsProvider → ZitadelProvider (OIDC/PKCE)
2. unified/route.ts: 接入 getKLineFromDatabase + runBacktest 真实引擎
3. 新建 backtest-agent.ts LangGraph 5 节点 + SSE 端点 + BacktestAgentPanel UI
4. dashboard-header.tsx: 添加"AI 回测"导航项
Verification: `bun run typecheck → 无错误 (PASS)`
Remaining: ⏳ 需配置 Zitadel Client ID 后验证 OIDC 登录流程

---

## 2026-02-25: Phase 2 — 策略缓存池 + 行为计费 + 并行扫描 Agent
Story 1: popularStrategies 缓存池（MD5 key），generate 路由命中缓存返回 cached:true+savedTokens
Story 2: userEvents 表 + recordUserEvent 火忘记录；quota-check.ts 500ms fail-open 配额中间件
Story 3: scanner-agent.ts LangGraph 4 节点；/api/agent/scanner SSE 端点；ScannerPanel + /dashboard/strategy-scanner 页
Story 4: CLAUDE.md 项目结构更新；epics.md FR-1.5/FR-2.10 标 Done；process.md 归档
Commit: 4281818 (18 files, 1877 insertions)
Verification: `bun run typecheck → 0 errors (PASS)`

## 2026-02-25: Phase 2 DB 迁移 + 部署验证
DB migration applied via kubectl exec peer auth (postgres superuser):
- popular_strategies: added cache_key, author_id, avg_return, usage_count + unique index
- user_events: created table with 3 indexes (user_id, event_type, created_at)
ArgoCD synced to commit 4281818 (Kustomize image override: main tag). Pod restarted, Running 1/1.
Verification: GET /api/advisor/chat → 200 OK; GET /api/agent/scanner → 405 (route registered ✓)
Remaining: ⏳ 端到端验证（缓存命中、配额执行、Scanner SSE 流）需在 https://lucrum.lurus.cn 手动测试
