# lurus-lucrum

AI quantitative trading platform with two sub-projects:

| Sub-project | Stack | Responsibility |
|-------------|-------|----------------|
| `lucrum-web/` | Next.js 14 + TypeScript + Bun | Frontend + API routes + backtest engine |
| `lurus-ai-qtrd/` | Python 3.11 + FastAPI + vnpy | Quantitative engine backend (vnpy framework) |

- Domain: `https://lucrum.lurus.cn`
- Namespace: `lucrum`
- Web image: `ghcr.io/hanmahong5-arch/lucrum-web:main` (GitOps, push to main auto-syncs)
- API image: `ghcr.io/hanmahong5-arch/lurus-ai-qtrd:main` (GitOps, push to main auto-syncs)

---

## lucrum-web Directory Structure

```
lucrum-web/
├── src/
│   ├── app/
│   │   ├── api/                    # Next.js API routes
│   │   │   ├── backtest/           # Single-stock, multi-stock, portfolio, sector, unified
│   │   │   ├── agent/              # LangGraph agent (backtest/scanner)
│   │   │   ├── agent-protocol/     # Agent protocol (threads, runs, store)
│   │   │   ├── advisor/            # AI advisor (chat/debate)
│   │   │   ├── auth/               # NextAuth.js + email verify + password reset
│   │   │   ├── data/               # Market data proxy (fetch/freshness/institutional/status)
│   │   │   ├── history/            # Backtest history API
│   │   │   ├── lurus/              # lurus-api proxy (billing, marketplace, referral)
│   │   │   ├── market/             # Market status, flow, indices, kline, quote
│   │   │   ├── stocks/             # Stock list, search, favorites, date-range
│   │   │   ├── strategies/         # Popular, mine, trending
│   │   │   ├── strategy/           # AI strategy generate/optimize
│   │   │   ├── usage/              # Usage status
│   │   │   ├── workflow/           # Guided workflow sessions
│   │   │   └── cron/               # Crawl strategies, init
│   │   ├── auth/                   # Auth pages (login/register/callback/forgot/reset/verify)
│   │   ├── dashboard/              # Main trading UI (7 modules + settings)
│   │   │   ├── page.tsx            # Strategy workbench (main page)
│   │   │   ├── advisor/            # AI investment advisor chat
│   │   │   ├── history/            # Backtest history & comparison
│   │   │   ├── marketplace/        # Strategy marketplace + publish
│   │   │   ├── strategy-validation/ # Multi-stock validation
│   │   │   ├── trading/            # Paper trading panel
│   │   │   ├── settings/           # Unified settings (profile/subscription/referral/account)
│   │   │   ├── validation/         # Portfolio validation
│   │   │   ├── agents/             # Custom agent management
│   │   │   ├── analysis/           # Strategy analysis
│   │   │   ├── diagnostics/        # System diagnostics
│   │   │   ├── insights/           # Institutional insights
│   │   │   ├── paper-trading/      # Paper trading (extended)
│   │   │   ├── strategy-scanner/   # Sector scanner
│   │   │   └── strategies/         # Strategy library + discovery
│   │   └── backtest-agent/         # Standalone AI backtest agent page
│   │
│   ├── components/
│   │   ├── onboarding/             # Welcome flow overlay + tiered demo selector
│   │   ├── portfolio/              # Portfolio UI (config, results, sector import)
│   │   ├── history/                # History components (timeline, comparison, versions)
│   │   ├── providers/              # Error boundary, store rehydrator, hydration gate
│   │   ├── strategy-editor/        # Code editor, parameters, backtest panel, templates
│   │   ├── strategy-validation/    # Multi-stock validation UI
│   │   ├── advisor/                # AI advisor chat UI
│   │   ├── agent/                  # LangGraph agent panels
│   │   ├── charts/                 # K-line charts (lightweight-charts)
│   │   ├── dashboard/              # Header, shell, status bar
│   │   ├── discovery/              # Strategy discovery page
│   │   ├── marketplace/            # Strategy marketplace
│   │   ├── watchlist/              # Watchlist slide-out panel
│   │   ├── settings/               # Profile, security, notification, subscription, onboarding reset
│   │   ├── workflow/               # Guided workflow UI
│   │   ├── trading/                # Symbol selector
│   │   ├── financial/              # Financial data display
│   │   ├── feedback/               # User feedback
│   │   ├── paywall/                # Upgrade gates
│   │   ├── i18n/                   # Locale switcher
│   │   ├── command-palette/        # Global command palette
│   │   ├── accessibility/          # A11y components
│   │   ├── layout/                 # Layout primitives
│   │   ├── pages/                  # Extracted page content (account, referral)
│   │   ├── task/                   # Task notification bell
│   │   ├── pwa/                    # PWA install prompt
│   │   └── ui/                     # Radix UI primitives + design system
│   │
│   ├── hooks/                      # 35 custom hooks (safety, data, state)
│   │   ├── use-onboarding.ts       # First-time welcome flow state
│   │   ├── use-onboarding-import.ts # Tiered demo import actions
│   │   ├── use-abort-controller.ts # Safe abort for async ops
│   │   ├── use-operation-guard.ts  # Prevent concurrent operations
│   │   ├── use-stale-guard.ts      # Guard stale results after re-renders
│   │   ├── use-safe-action.ts      # Debounced actions
│   │   ├── use-hydration-safe.ts   # SSR hydration safety
│   │   ├── use-batch-backtest.ts   # Multi-stock batch backtest
│   │   ├── use-kline-data.ts       # K-line data fetching
│   │   └── ...                     # 25+ more hooks
│   │
│   └── lib/
│       ├── backtest/               # Financial-grade backtest engine
│       │   ├── core/               # Interfaces, validators, errors (BT1XX-BT9XX)
│       │   ├── portfolio/          # Portfolio engine (shared capital, 4 sizing methods)
│       │   ├── parallel/           # Batch & chunked execution
│       │   ├── score/              # Strategy scoring system
│       │   ├── workers/            # Web Worker parallelism
│       │   ├── engine.ts           # Main backtest engine
│       │   └── statistics.ts       # 30+ financial metrics
│       │
│       ├── repositories/           # Repository pattern (5 interfaces + 5 Drizzle impls)
│       │   ├── interfaces.ts       # IStockRepo, IKlineRepo, IBacktestRepo, ISectorRepo, IStrategyRepo
│       │   └── drizzle/            # Drizzle ORM implementations
│       │
│       ├── infra/                  # Infrastructure layer
│       │   ├── circuit-breaker.ts  # Per-source circuit breakers (eastmoney, sina)
│       │   ├── request-dedup.ts    # Request deduplication
│       │   └── external-apis.ts    # Protected external API wrappers
│       │
│       ├── errors/                 # Unified error system
│       │   ├── error-catalog.ts    # Error code catalog (all known errors)
│       │   ├── error-types.ts      # AppError type, toAppError(), recovery actions
│       │   └── index.ts
│       │
│       ├── stores/                 # Zustand stores (14 persisted + factory)
│       │   ├── create-persisted-store.ts  # Factory with immer + persist + hydration
│       │   ├── strategy-workspace-store.ts # Editor state (3-tier persistence)
│       │   ├── user-preferences-store.ts   # Theme, defaults, onboarding state
│       │   ├── validation-store.ts         # Multi-stock validation state
│       │   ├── watchlist-store.ts          # Watchlist state
│       │   └── ...                         # 10 more domain stores
│       │
│       ├── advisor/                # Multi-agent AI advisor (11 agents, 7 schools)
│       ├── agent/                  # LangGraph agent (graphs, tools, stores)
│       ├── workflow/               # Guided workflow engine
│       ├── strategy/               # Strategy code gen, parameter parser
│       ├── strategy-templates/     # Builtin templates (5+) + academic/practitioner
│       ├── data-service/           # Market data with retry, circuit breaker, cache
│       ├── db/                     # Drizzle ORM (schema, queries, index)
│       ├── auth/                   # NextAuth.js, email verification, reset tokens
│       ├── redis/                  # IORedis client
│       ├── i18n/                   # Internationalization (zh/en dictionaries)
│       ├── config/                 # Plan limits, feature flags
│       ├── cache/                  # Hybrid cache (Redis + in-memory)
│       ├── middleware/             # Quota check
│       └── ...                     # risk, report, trading, broker, crawler, etc.
│
├── drizzle/                        # Generated SQL migrations
├── scripts/                        # Data import scripts
├── Dockerfile                      # Multi-stage Bun build
├── deploy/k8s/                     # K8s manifests (ArgoCD managed)
└── drizzle.config.ts
```

### Key Subsystems

**Portfolio Backtest Engine** (`src/lib/backtest/portfolio/`):
Shared-capital multi-stock backtesting. 4 position sizing methods (equal-weight, capital-proportional, signal-rank, risk-parity). Signal prioritization across stocks. Produces per-stock + aggregate results.

**Error System** (`src/lib/errors/`):
Unified `AppError` type with error catalog, severity levels, and user-facing recovery actions (retry, fallback, navigate). All API routes and UI components share the same error contract.

**Safety Hooks** (`src/hooks/`):
- `use-abort-controller`: Auto-abort on unmount or re-trigger
- `use-safe-action`: Debounced async actions
- `use-stale-guard`: Prevents displaying stale async results
- `use-operation-guard`: Prevents concurrent operations

**State Management** (14 persisted Zustand stores):
All built with `createPersistedStore` factory (immer + persist + hydration tracking). `StoreRehydrator` triggers rehydration client-side. `StoreHydrationGate` blocks rendering until hydrated. Prevents SSR/client mismatch.

**Repository Pattern** (`src/lib/repositories/`):
5 interfaces (`IStockRepo`, `IKlineRepo`, `IBacktestRepo`, `ISectorRepo`, `IStrategyRepo`) with Drizzle ORM implementations. Decouples business logic from database.

**Code Splitting**:
All heavy components (`BacktestPanel`, `ParameterEditor`, `CodePreview`, etc.) loaded via `next/dynamic` with skeleton fallbacks. Reduces initial bundle by ~60%.

**Onboarding** (`src/components/onboarding/`):
4-step welcome flow overlay for first-time users. Persisted in `user-preferences-store.hasCompletedOnboarding`. Re-triggerable from settings page.

---

## lurus-ai-qtrd Directory Structure

```
lurus-ai-qtrd/
├── vnpy/                   # vnpy 4.x framework source (modified)
├── vnpy_ai_trader/
│   ├── src/
│   │   ├── ai_core/        # LLM integration (DeepSeek)
│   │   ├── datafeed/       # Market data (adata A-share)
│   │   ├── gateway/        # Trading gateway
│   │   ├── strategy/       # Quantitative strategies
│   │   ├── utils/
│   │   └── web/            # FastAPI app (port 8000)
│   ├── config/
│   └── requirements.txt
├── k8s/ai-qtrd/            # K8s manifests (local image, not GitOps)
└── Dockerfile
```

---

## Commands

### lucrum-web (run in `lucrum-web/` directory)

```bash
# Development
bun run dev              # localhost:3000
bun run typecheck        # Must run before commit
bun run lint

# Testing
bun run test                          # Vitest unit tests
bun run test -- -t "pattern"          # Filter by name
bun run test -- src/lib/backtest      # Specific directory
bun run test:coverage                 # Coverage report (target: statements>=85%, functions>=90%)
bun run test:e2e                      # Playwright E2E (4 viewports)
bun run test:e2e:headed               # Headed mode (visible browser)

# Database
bun run db:generate      # Generate Drizzle migration from schema.ts
bun run db:push          # Push schema changes to PostgreSQL
bun run db:studio        # Drizzle Studio GUI
bun run db:import        # Import initial data (stocks + klines)

# Build
bun run build
```

### lurus-ai-qtrd (run in `lurus-ai-qtrd/` directory)

```bash
# Local dev
python -m uvicorn src.web.app:app --host 0.0.0.0 --port 8000 --reload

# Build image (GitOps: push to main triggers CI/CD automatically)
docker build -t lurus-ai-qtrd:latest .
```

### K8s Operations

```bash
ssh root@100.98.57.55 "kubectl -n lucrum get pods"
ssh root@100.98.57.55 "kubectl -n lucrum logs -l app=lucrum-web --tail=100"
ssh root@100.98.57.55 "kubectl -n lucrum rollout restart deployment/lucrum-web"
ssh root@100.98.57.55 "kubectl -n lucrum rollout restart deployment/lucrum-api"
```

### API Endpoints (lucrum-web)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/backtest/unified` | POST | Unified multi-mode backtest |
| `/api/backtest/portfolio` | POST | Portfolio backtest (multi-stock, shared capital) |
| `/api/backtest/sector` | POST | Sector backtest |
| `/api/backtest/multi-stocks/stream` | POST | Batch SSE stream |
| `/api/strategy/generate` | POST | AI strategy code generation |
| `/api/strategy/optimize` | POST | Strategy optimization |
| `/api/history` | GET/POST | Backtest history CRUD |
| `/api/stocks/list` | GET | Stock list |
| `/api/market/kline` | GET | K-line data |

---

## Environment Variables

### lucrum-web (`.env.local`)

| Variable | Description |
|----------|-------------|
| `LURUS_API_URL` | lurus-api service URL |
| `NEXT_PUBLIC_LURUS_API_URL` | Client-visible API URL |
| `TENANT_SLUG` | Tenant identifier |
| `NEXTAUTH_URL` | NextAuth callback base URL |
| `NEXTAUTH_SECRET` | NextAuth signing key |
| `ZITADEL_ISSUER` | Zitadel OIDC issuer |
| `ZITADEL_CLIENT_ID` | Zitadel application Client ID |
| `ZITADEL_CLIENT_SECRET` | PKCE mode: leave empty |
| `DATABASE_URL` | PostgreSQL DSN |
| `REDIS_ENABLED` | Enable Redis (`true`/`false`) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | Redis connection |
| `DEEPSEEK_API_KEY` | DeepSeek API Key (Agent features) |
| `DEEPSEEK_API_BASE` | DeepSeek API Base URL |

### lurus-ai-qtrd (K8s ConfigMap + Secret)

| Variable | Description |
|----------|-------------|
| `WEB_HOST` / `WEB_PORT` | FastAPI listen address (`0.0.0.0:8000`) |
| `DEEPSEEK_API_KEY` | DeepSeek Key (K8s Secret: `lucrum-secrets`) |
| `DEEPSEEK_API_BASE` | `https://api.lurus.cn/v1` (via lurus-api gateway) |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `DATA_DIR` / `LOG_DIR` | `/app/data` / `/app/logs` |

---

## UI Development Rules (lucrum-web)

Read `lucrum-web/docs/DESIGN_SYSTEM.md` before writing any UI. Key rules:

- Dark-first: backgrounds use `bg-void` (not black) and `bg-surface`
- Financial numbers: must use `font-mono tabular-nums`
- Semantic colors: use `text-profit` / `text-loss`, not raw colors
- Financial calculations: must use `FinancialAmount` (Decimal.js wrapper), no floating-point

---

## BMAD

| Resource | Path |
|----------|------|
| PRD | `./_bmad-output/planning-artifacts/prd.md` |
| Epics | `./_bmad-output/planning-artifacts/epics.md` |
| Architecture | `./_bmad-output/planning-artifacts/architecture.md` |
| UX Design | `./_bmad-output/planning-artifacts/ux-design-specification.md` |
| Sprint Status | `./_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Dev Stories | `./_bmad-output/implementation-artifacts/<story-id>.md` |
