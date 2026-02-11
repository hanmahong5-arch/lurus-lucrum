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
