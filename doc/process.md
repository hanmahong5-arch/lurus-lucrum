# Process Log | 变更日志

Previous entries archived to `doc/archive/process_v2026-02-06.md`.

---

## 2026-02-06: Story legacy-1-3 — Real Stock Target Selection
Removed mock default fallback, added pinyin search (pinyin-pro), search result grouping/highlighting, recent stocks (localStorage, max 5), DataSourceBadge (3 variants), SimulatedDataBanner (session-scoped), getKLineDateRange DB query + date range display + date picker constraints. Updated pre-existing backtest-panel tests to match new behavior.
Verification: `bunx tsc --noEmit → 0 errors` | `bun run test -- --run → 1352 passed, 1 failed (pre-existing in backtest-basis-panel.test.tsx, unrelated)`
Status: review. 63 tests in 4 Story-related files all pass.

---

## 2026-02-06: Code Review — Epic 1 + Epic 2 (9 stories)
Adversarial code review across all stories (1-1 through 1-6, legacy-1-3, 2-1, 2-2). 32 findings: 4 CRITICAL, 8 HIGH, 12 MEDIUM, 8 LOW.

**Fixes applied:**
1. StatusBar not in layout.tsx → added `<StatusBar />` to root layout + `useNetworkStatusListener()` call (Story 1.3)
2. `toDecimal()` NaN/Infinity guard → degrades to `Decimal(0)` (Story 1.6)
3. `SimpleFinancialValue` sign regex broken for price type → fixed `([¥]?)[+-]` (Story 1.6)
4. ScoreCard missing AC-5 comparison mode → added `state="comparison"` + `previousScore` prop + side-by-side UI (Story 2.2)

**Reclassified as non-issues after deeper analysis:**
- Empty symbol default in backtest-panel (run button disabled, handler validates)
- ai-bg/ai-border hardcoded opacity (intentional semantic tokens, validated by tests)
- localStorage SSR guard (inside useEffect, SSR-safe by design)
- aria-disabled on div[role=listitem] (valid per WAI-ARIA spec with event handlers)

Verification: `bun run typecheck → 0 errors` | `bun run test -- --run src/lib/financial src/components/financial → 96 passed` | `bun run test -- --run score-card.test → 37 passed`

---

## 2026-02-11: Code Review — Epic 1 + Epic 2 + legacy-1-3 (12 stories)
Full adversarial code review of all done stories. 605 tests across 12 stories, 0 failures.

**Fixes applied (Stories 1.1–1.3):**
1. Story 1.1: WCAG step-pending color #4b5563→#64748b (failed 3:1 contrast). Added 34 WCAG contrast ratio tests (59 total).
2. Story 1.2: Removed dead TOAST_ICONS code. Fixed options spread order bug. Added 11 behavioral spy tests (43 total).
3. Story 1.3: Added `md:pb-7` to body (StatusBar hid content). Fixed TS strict noUncheckedIndexedAccess in WCAG helper.

**Stories 1.4–2.5: No code changes needed.** All approved. Review records added to each story file.

**Cross-cutting action items:** (1) `git add` all untracked new files across all stories, (2) integrate unused components into actual pages (EmptyState, WorkflowStepper, FinancialValue).
Verification: `bun run test -- --run [per-story files]` → 605 passed, 0 failed across all 12 stories.

---

## 2026-02-11: SSO + 计费集成 Phase 1 — Bug Fixes + Deploy
Fixed 4 critical SSO issues discovered during manual testing:
1. TENANT_SLUG `gushen`→`lurus` (lurus-api only has `lurus` tenant, gushen is a product not a tenant)
2. Session endpoint `/api/v1/auth/session`→`/api/v2/auth/session-info` (old endpoint doesn't exist)
3. Response parsing `data.user`→`data` (session-info returns flat structure, no nested user)
4. OAuth redirect_url: relative `/dashboard`→full `https://gushen.lurus.cn/auth/callback?callbackUrl=/dashboard`
Also: register page mock→SSO redirect, callback page added Suspense, Dockerfile added NEXT_PUBLIC_* build args, K8s deployment added SSO env vars + NEXTAUTH_SECRET secret.
Verification: `bun run typecheck → 0 errors` | `bun run test → 1502 passed, 0 failed`
Status: 🔧 Deployed to main, ⏳ waiting CI build + ArgoCD sync for E2E verification on gushen.lurus.cn.

---

## 2026-02-11: K8s Deployment — gushen-web Ingress + SSO Env Vars
Created Ingress (gushen.lurus.cn → ai-qtrd-web:3000) + SSL certificate. Updated running deployment with missing SSO env vars (LURUS_API_URL, TENANT_SLUG, NEXTAUTH_URL). Pod rolled out successfully (Next.js Ready in 201ms).
Verification: `kubectl -n ai-qtrd get ingress → Load Balancer IPs assigned (80, 443)` | `curl http://10.43.116.107:3000 → HTTP 200 OK (24682 bytes)`
Status: ✅ K8s config complete, ⏳ external HTTPS access blocked (external load balancer 43.226.46.164 needs gushen.lurus.cn routing rule). Internal cluster tests pass, HTTP routing works (308 redirect), TLS cert valid. Detailed report: `k8s-deployment-update-gushen-2026-02-11.md`.

---

## 2026-02-13: SSO Phase 1 — Docker Image Deploy to K8s
CI/CD pipeline builds but doesn't push images to GHCR. Built Docker image locally on master (100.98.57.55) with `--provenance=false` to avoid OCI index format incompatibility with K3s containerd CRI.
Key fix: K3s uses `/run/k3s/containerd/containerd.sock` not `/run/containerd/containerd.sock` — must specify `--address` when using nerdctl/ctr to load images into K3s.
Also fixed: billing test page prerender error (split into server wrapper + client component), disabled ArgoCD auto-sync during manual deploy then re-enabled.
Verification: `curl https://gushen.lurus.cn/ → 200` | `/api/lurus/billing/plans → {"success":false,"error":"未授权"}` (401, not 404) | `/api/auth/providers → ["lurus-sso","credentials"]`
Status: ✅ SSO routes deployed. ⏳ E2E SSO login flow pending manual verification.

---

## 2026-02-13: Story 3-3 -- Strategy Detail Panel & Quick Preview
Implemented StrategyDetailPanel (Radix Dialog side panel, 40% desktop / full-screen mobile), QuickPreviewResult, useStrategyDetail hook, useQuickPreview hook. Integrated into DiscoveryPageContent.
New files: strategy-detail-panel.tsx, quick-preview-result.tsx, use-strategy-detail.ts, use-quick-preview.ts + 2 test files.
Verification: bun run typecheck -> 0 errors | bun run test discovery -> 5 files, 59 passed (26 new)
Status: Done. sprint-status.yaml updated (3-3: done).

---

## 2026-02-14: Story 7-4 -- Test Coverage Improvement
Added 6 test files (134 tests) for untested lib/ modules: utils, strategy/parameter-parser, comparison/metric-diff, comparison/winner-resolver, risk/risk-manager, trading/kline-validator.
Verification: `bun run test -- --run → 2439 passed, 2 failed (pre-existing in accessibility/, unrelated to 7-4)`
Remaining: 2 pre-existing failures in color-contrast.test.ts and live-region.test.ts (Story 7-3 scope).
Status: Done. sprint-status.yaml updated (7-4: done).

---

## 2026-02-27: UI 三项改进 — 工作台合并、代码框修复、K线标记
1. 新建 `strategy-workbench-panel.tsx`：合并 AIStrategyAssistant + BuiltinTemplateGrid + StrategyTemplateList，Tab 智能切换（无代码→模板库，生成代码后→AI 助手）。
2. `page.tsx`：右列替换为 StrategyWorkbenchPanel，移除底部独立模板区块。
3. `code-preview.tsx`：外层容器移除 `h-full`，代码滚动区加 `min-h-[160px]`，修复短代码时黑色残留。
4. `kline-chart.tsx`：新增 `TradeMarkerInfo` 接口与 `tradeMarkers` prop，`setMarkers()` 渲染买卖箭头，crosshairMove hover 展示交易详情 Tooltip。
5. `backtest-panel.tsx`：新增"K线分析"按钮，点击展示 KLineChart（含交易标记 + 统计摘要）。
Verification: `bunx tsc --noEmit → 0 errors`
Status: ⏳ 待 bun run dev 手动验证。

---

## 2026-02-27: DB 连接修复 — /api/agent/custom 500 错误
根因：`web-deployment.yaml` 缺少 `DATABASE_URL`，应用回退到 `localhost:5432` 导致所有 DB 查询失败。
次因：migration 0002 的 4 张表由 `postgres` 拥有，`lurus` 用户无权限。
修复：① patch `ai-qtrd-secrets` 添加 `DATABASE_URL=postgresql://lurus:...@lurus-pg-rw.database.svc.cluster.local:5432/gushen`；② `web-deployment.yaml` 引用该 secret；③ GRANT ALL ON custom_agents/custom_agent_runs/strategy_versions/user_events TO lurus；④ kubectl apply 触发滚动重启。
Verification: `curl https://gushen.lurus.cn/api/agent/custom → 401`（非 500）| Pod 日志显示 `[Database] Connecting to: postgresql://lurus:****@lurus-pg-rw.database.svc.cluster.local:5432/gushen`
Status: 🔧 已部署。⏳ 需用户登录后手动验证"创建并运行" Agent 流程。
⚠️ 注意：`web-deployment.yaml` 已改动，需 git push 到 main 使 ArgoCD 同步持久化（当前为直接 apply 临时生效）。
