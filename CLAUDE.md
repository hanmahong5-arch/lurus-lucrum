# Lucrum (2c-svc-lucrum)

AI 量化交易平台。Lucrum 产品组 (P1)。

- Namespace: `lucrum`
- Domain: `lucrum.lurus.cn`
- DB schema: `lucrum` · Redis DB: 1 · NATS stream: `LUCRUM_EVENTS`
- Port: 8870 (web) / 8000 (ai-qtrd FastAPI)
- Images: `ghcr.io/hanmahong5-arch/lucrum-web:main-<sha7>` · `ghcr.io/hanmahong5-arch/lurus-ai-qtrd:main-<sha7>`

## Tech Stack

| Sub-project | Stack | Responsibility |
|-------------|-------|----------------|
| `lucrum-web/` | Next.js 14 + TypeScript + Bun + Drizzle | Frontend + API routes + backtest engine |
| `lurus-ai-qtrd/` | Python 3.11 + FastAPI + vnpy 4.x | 量化引擎后端 |

## Directory

```
2c-svc-lucrum/
├── lucrum-web/        # Next.js (src/app, src/lib/{backtest,repositories,advisor,agent,platform})
├── lurus-ai-qtrd/     # vnpy + FastAPI (vnpy_ai_trader/src)
└── deploy/k8s/        # ArgoCD managed manifests
```

## Commands

```bash
# lucrum-web (in lucrum-web/)
bun run dev                         # localhost:3000
bun run typecheck && bun run lint   # required before commit
bun run test                        # Vitest
bun run test:e2e                    # Playwright (4 viewports)
bun run db:generate && bun run db:push
bun run build

# lurus-ai-qtrd (in lurus-ai-qtrd/)
python -m uvicorn src.web.app:app --host 0.0.0.0 --port 8000 --reload

# K8s
ssh root@100.98.57.55 "kubectl -n lucrum get pods"
ssh root@100.98.57.55 "kubectl -n lucrum rollout restart deployment/lucrum-web"
```

## Cross-service Dependencies

- **Auth**: Zitadel OIDC via NextAuth.js (PKCE, `ZITADEL_CLIENT_SECRET` empty)
- **Platform (2l-svc-platform)** via `src/lib/platform/client.ts`:
  - `POST /internal/v1/subscriptions/checkout` — wallet/Alipay/WeChat checkout
  - `GET /internal/v1/checkout/:order_no/status` — payment polling
  - Entitlement tier cached in Redis 60s; invalidate on subscription change
- **LLM gateway**: `DEEPSEEK_API_BASE=https://newapi.lurus.cn/v1` (routes via 2b-svc-newapi; 2b-svc-api Hub removed 2026-04-23)
- **Billing quota**: 3-layer (plan ceiling → Redis counter → wallet fallback)

## Gotchas

- **Dark-first UI**: `bg-void` / `bg-surface`; financial numbers use `font-mono tabular-nums`; `text-profit` / `text-loss` 语义色。
- **Financial math**: 必须用 `FinancialAmount` (Decimal.js wrapper)，禁用浮点。
- **Current blockers (2026-04-23)**: `lucrum-web` CreateContainerConfigError (secret missing); `ai-qtrd` quota saturated (2cpu/3Gi)。
- Read `lucrum-web/docs/DESIGN_SYSTEM.md` before touching UI.

## BMAD

| Resource | Path |
|----------|------|
| PRD | `./_bmad-output/planning-artifacts/prd.md` |
| Epics | `./_bmad-output/planning-artifacts/epics.md` |
| Architecture | `./_bmad-output/planning-artifacts/architecture.md` |
| UX Design | `./_bmad-output/planning-artifacts/ux-design-specification.md` |
| Sprint Status | `./_bmad-output/implementation-artifacts/sprint-status.yaml` |
