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
│   │   ├── api/              # Next.js API routes (backtest, agent, advisor, auth, market, stocks, strategies…)
│   │   ├── auth/             # Auth pages (login/register/callback/forgot/reset/verify)
│   │   ├── dashboard/        # Main trading UI: 7 modules (workbench/marketplace/validation/trading/analysis/advisor/history) + settings
│   │   └── backtest-agent/   # Standalone AI backtest agent page
│   ├── components/           # 35+ component groups (strategy-editor, portfolio, advisor, charts, onboarding, watchlist, ui…)
│   ├── hooks/                # 35 custom hooks (safety: abort/guard/stale/dedup, data: kline/backtest, state: hydration)
│   └── lib/
│       ├── backtest/         # Financial-grade engine (portfolio 4 sizing methods, parallel, scoring, 30+ metrics)
│       ├── repositories/     # 5 interfaces + 5 Drizzle impls (Stock, Kline, Backtest, Sector, Strategy)
│       ├── infra/            # Circuit breaker (eastmoney/sina), request dedup, external API wrappers
│       ├── errors/           # Unified AppError + error catalog + recovery actions
│       ├── stores/           # 14 persisted Zustand stores (immer + persist + hydration gate)
│       ├── advisor/          # Multi-agent AI advisor (11 agents, 7 schools)
│       ├── agent/            # LangGraph agent (graphs, tools, stores)
│       └── ...               # db/, auth/, redis/, i18n/, config/, cache/, strategy/, workflow/
├── drizzle/                  # Generated SQL migrations
├── deploy/k8s/               # K8s manifests (ArgoCD managed)
└── Dockerfile                # Multi-stage Bun build
```

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
