<!-- 归档: doc/archive/process_v20260225.md (2026-02-25 之前的所有条目) -->

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
Remaining: ⏳ 端到端验证（缓存命中、配额执行、Scanner SSE 流）需在 https://gushen.lurus.cn 手动测试
