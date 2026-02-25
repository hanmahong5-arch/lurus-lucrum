# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands | 核心命令

**⚠️ CRITICAL: This project uses `bun`, NOT `npm`.** | **⚠️ 重要：本项目使用 `bun`，而不是 `npm`**

```bash
# Development | 开发
bun run dev              # Start Next.js dev server at localhost:3000
bun run typecheck        # Fast type checking (use this before committing)
bun run lint             # Lint all files
bun run build            # Production build

# Testing | 测试
bun run test             # Run all tests with Vitest
bun run test:coverage    # Generate coverage report

# Database | 数据库
bun run db:generate      # Generate Drizzle migrations from schema
bun run db:push          # Push schema changes to PostgreSQL
bun run db:studio        # Open Drizzle Studio GUI
bun run db:import        # Import initial data (stocks + klines)
bun run db:import:stocks # Import stock list only
bun run db:import:klines # Import K-line data only
```

## Design & UI Guidelines | 设计与UI指南

**⚠️ CRITICAL: You MUST follow the Design System for ALL UI changes.**
**⚠️ 重要：所有 UI 变更必须遵循设计系统。**

Before writing any frontend code, read: `docs/DESIGN_SYSTEM.md`

### Core Rules | 核心规则

1.  **Dark Mode Only**: Use `bg-void` (not black) and `bg-surface`.
2.  **Financial Data**: MUST use `font-mono` and `tabular-nums`.
3.  **Colors**: Use semantic classes (`text-profit`, `text-loss`) instead of raw colors.
4.  **Interaction**: Add `btn-tactile` to buttons and `glow-active` to active states.

### Workflow for UI Tasks | UI 任务工作流

1.  **Check**: Does this component exist in the Design System?
2.  **Style**: Apply `docs/DESIGN_SYSTEM.md` classes.
3.  **Verify**: Ensure `tabular-nums` is used for all numbers.

## High-Level Architecture | 高层架构

### Technology Stack | 技术栈

- **Runtime**: Bun (10-20x faster than npm/Node.js)
- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: TypeScript 5.x (strict mode enabled)
- **Styling**: TailwindCSS + Radix UI
- **State**: Zustand (global state) + React Query (server state)
- **Database**: PostgreSQL + Drizzle ORM
- **Cache**: Redis (IORedis client)
- **Testing**: Vitest
- **Deployment**: Docker + K3s

### Project Structure | 项目结构

```
gushen-web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes (backend proxy layer)
│   │   │   ├── advisor/        # AI investment advisor endpoints
│   │   │   ├── agent/          # LangGraph agent endpoints
│   │   │   │   ├── backtest/   # AI-driven backtest agent (SSE)
│   │   │   │   └── scanner/    # Parallel sector scanner agent (SSE)
│   │   │   ├── auth/           # NextAuth.js authentication
│   │   │   ├── backtest/       # Backtest execution API
│   │   │   │   ├── unified/    # Unified multi-mode backtest
│   │   │   │   ├── sector/     # Sector backtest
│   │   │   │   └── multi-stocks/stream/  # Batch SSE stream
│   │   │   ├── data/           # Market data proxy
│   │   │   ├── lurus/          # lurus-api proxy (billing, AI)
│   │   │   ├── stocks/         # Stock list & K-line data
│   │   │   └── strategies/     # Popular strategies pool API
│   │   ├── backtest-agent/     # AI backtest agent page
│   │   └── dashboard/          # Dashboard pages
│   │       ├── page.tsx        # Strategy editor (main trading UI)
│   │       ├── advisor/        # Investment advisor chat
│   │       ├── history/        # Backtest history
│   │       ├── insights/       # Institutional insights
│   │       ├── strategy-scanner/  # Parallel sector scanner
│   │       ├── strategy-validation/  # Multi-stock validation
│   │       └── trading/        # Trading panel
│   │
│   ├── components/             # React components
│   │   ├── agent/              # LangGraph agent UIs
│   │   │   ├── BacktestAgentPanel.tsx
│   │   │   └── ScannerPanel.tsx
│   │   ├── advisor/            # AI advisor chat UI
│   │   ├── charts/             # K-line charts (lightweight-charts)
│   │   ├── dashboard/          # Shared dashboard components
│   │   │   └── dashboard-header.tsx
│   │   ├── design-system/      # Design system components
│   │   ├── financial/          # Financial data display
│   │   ├── report/             # Report generation
│   │   ├── risk/               # Risk metrics display
│   │   ├── strategy-editor/    # Strategy code editor & parameters
│   │   └── ui/                 # Radix UI primitives
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useBilling.ts       # Subscription & billing
│   │   ├── use-quota-status.ts # AI token quota display
│   │   └── use-user-workspace.ts
│   │
│   └── lib/                    # Core business logic
│       ├── agent/              # ⭐ LangGraph agent implementations
│       │   ├── backtest-agent.ts   # AI-driven backtest (5-node graph)
│       │   └── scanner-agent.ts    # Parallel sector scanner
│       │
│       ├── backtest/           # ⭐ Financial-grade backtest engine
│       │   ├── core/           # Interfaces, validators, errors
│       │   ├── parallel/       # Batch & chunked execution
│       │   ├── engine.ts       # Main backtest engine
│       │   ├── statistics.ts   # 30+ financial metrics
│       │   └── types.ts        # Comprehensive type definitions
│       │
│       ├── advisor/            # ⭐ Multi-agent AI advisor
│       │   ├── agents/         # 11 specialized agents
│       │   ├── schools/        # 7 investment schools
│       │   └── token-budget.ts # Token management
│       │
│       ├── auth/               # NextAuth.js configuration
│       ├── db/                 # Drizzle ORM schemas
│       │   ├── schema.ts       # Database schema definitions
│       │   ├── queries.ts      # Query functions (cache pool, events)
│       │   └── index.ts        # DB client & connection
│       │
│       ├── middleware/         # Server-side middleware
│       │   └── quota-check.ts  # AI token quota enforcement
│       │
│       ├── redis/              # Redis client & caching
│       ├── data-service/       # Market data fetching
│       ├── strategy/           # Strategy code generation
│       └── stores/             # Zustand global stores
│           └── strategy-workspace-store.ts  # Editor state
│
├── scripts/                    # Utility scripts
│   └── import-initial-data.ts  # Stock & K-line data importer
│
├── drizzle/                    # Generated SQL migrations
├── drizzle.config.ts           # Drizzle Kit configuration
└── tsconfig.json               # TypeScript config (strict mode)
```

### Core Subsystems | 核心子系统

#### 1. Backtest Engine (Phase 9 - Financial-Grade) | 回测引擎

**Location**: `src/lib/backtest/`

**Key Design Patterns**:

- **Interface-Driven Architecture**: Decoupled via `IDataProvider`, `IBacktestEngine`, `IMetricsCalculator`, `IStorage`
- **Error Handling**: 30+ error codes (BT1XX-BT9XX) with structured error context
- **Financial Precision**: Uses `Decimal.js` for all monetary calculations (避免浮点精度问题)
- **Quality Checks**: K-line data validation (missing data, halts, price limits, anomalies)
- **Event System**: Type-safe event emitter for backtest progress tracking

**Key Files**:

- `core/interfaces.ts` - Core abstractions (IDataProvider, IBacktestEngine, etc.)
- `core/errors.ts` - Comprehensive error types with error codes
- `core/financial-math.ts` - Decimal.js-based financial calculations
- `engine.ts` - Main backtest execution engine (32KB, 900+ lines)
- `statistics.ts` - 30+ financial metrics (Sharpe, Max Drawdown, Win Rate, etc.)

**Critical Implementation Details**:

- **Trade Execution**: Models slippage, price limits, transaction costs
- **Position Management**: Tracks holdings, cash, order history
- **Validation**: Zod schemas for input validation before execution
- **Lot Size**: Enforces China A-share 100-share lot constraints

#### 2. Multi-Agent AI Advisor (Phase 8.5) | 多Agent投资顾问

**Location**: `src/lib/advisor/`

**Architecture**:

- **11 Specialized Agents**: 4 analysts + 3 researchers + 4 master personas (Buffett, Lynch, Livermore, Simons)
- **7 Investment Schools**: Value, Growth, Technical, Quantitative, Macro, Contrarian, Momentum
- **Debate Mode**: Bull vs Bear multi-turn argument system
- **Token Budget Management**: Dynamic context construction with token limits

**Key Files**:

- `agents/` - Individual agent implementations
- `schools/` - Investment philosophy definitions
- `token-budget.ts` - Context size management

#### 3. Strategy Workspace (Phase 11) | 策略工作区

**Location**: `src/lib/stores/strategy-workspace-store.ts`

**Features**:

- **3-Tier Persistence**: Auto-draft (3s) → Zustand state → localStorage
- **Undo/Redo**: Via Zustand temporal middleware
- **Multi-Tab Sync**: localStorage events for cross-tab synchronization
- **Auto-Save Status**: Real-time UI feedback (saved/saving/unsaved/error)

**Why This Approach**:

- Prevents data loss during page navigation
- Survives browser refreshes
- Maintains 10 most recent drafts

#### 4. Database Layer | 数据库层

**Location**: `src/lib/db/`

**Schema Overview**:

- `users` - User accounts (NextAuth.js compatible)
- `stocks` - Stock metadata (name, code, market, industry)
- `klines` - Historical price data (OHLCV + volume, turnover)
- `strategies` - User-saved strategy templates
- `backtest_results` - Cached backtest outputs

**Key Characteristics**:

- PostgreSQL with Drizzle ORM (type-safe SQL builder)
- Migrations in `drizzle/` folder
- Connection pooling via `pg` library
- Indexes on `stock_code`, `date` for query performance

#### 5. Redis Caching | Redis缓存

**Location**: `src/lib/redis/`

**Use Cases**:

- **Market Data**: Cache K-line data for 1 hour (reduces API calls)
- **Backtest Results**: Cache recent backtest runs (avoid re-computation)
- **Session State**: Temporary storage for long-running operations

**Configuration**:

- Host: Defined in K8s Secret
- Client: IORedis with reconnection logic

### API Design Patterns | API设计模式

#### API Routes (Next.js App Router)

**Location**: `src/app/api/`

**Routing Strategy**:

- `/api/auth/*` - Handled by frontend (NextAuth.js)
- `/api/advisor/*` - Frontend AI advisor logic
- `/api/backtest/run` - Proxied to backend (FastAPI)
- `/api/data/*` - Proxied to backend or third-party (Eastmoney/Sina)
- `/api/stocks/*` - Frontend database queries

**CORS Handling**:

- Backend API calls use server-side proxy to avoid CORS
- Frontend never directly calls third-party APIs (except as fallback)

### State Management Philosophy | 状态管理理念

**When to Use What**:

- **Zustand**: Global UI state that persists across pages (strategy editor, user preferences)
- **React Query**: Server state with caching/revalidation (market data, backtest results)
- **useState**: Local component state (form inputs, modals)
- **URL Params**: Shareable state (stock selection, date ranges)

**Example - Strategy Editor State Flow**:

1. User edits code → `workspace.updateCode()` (Zustand action)
2. Auto-save triggers after 3s → `saveDraft()` persists to localStorage
3. User navigates away → State retained in Zustand store
4. User returns → Hydrate from localStorage on mount

### Critical Development Practices | 关键开发实践

#### Financial Calculations

**NEVER use JavaScript numbers for money**:

```typescript
// ❌ WRONG - Floating point precision issues
const total = 100.1 + 100.2; // 200.30000000000004

// ✅ CORRECT - Use Decimal.js via FinancialAmount
import { FinancialAmount } from "@/lib/backtest/core/financial-math";
const price = new FinancialAmount("100.10");
const total = price.add("100.20"); // '200.30'
```

#### Type Safety

- **Strict Mode**: `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`
- **Zod Validation**: Validate all external inputs (API requests, user forms)
- **Never use `any`**: Use `unknown` and narrow with type guards

#### Error Handling Pattern

```typescript
// All backtest errors extend BacktestError with error codes
try {
  await runBacktest(params);
} catch (error) {
  if (error instanceof BacktestError) {
    console.error(`[${error.code}] ${error.message}`, error.context);
  }
}
```

#### Component Design

- **Server Components by default**: Only use 'use client' when needed (hooks, events)
- **Radix UI primitives**: Use `@/components/ui/*` for consistent styling
- **Accessibility**: All interactive components have ARIA labels

### Environment Variables | 环境变量

**Required in `.env.local`**:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/gushen

# Redis (optional, falls back to in-memory)
REDIS_URL=redis://host:6379

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>

# Backend API (for proxying)
BACKEND_API_URL=http://localhost:8000

# AI (for strategy generation)
LURUS_API_URL=https://api.lurus.cn
LURUS_API_KEY=<api-key>
```

### Testing Strategy | 测试策略

**Test Files**:

- Place tests alongside source: `src/lib/backtest/__tests__/engine.test.ts`
- Use Vitest for fast, ESM-native testing
- **Critical test areas**:
  1. Financial calculations (ensure Decimal.js correctness)
  2. K-line data validation (edge cases: halts, limits)
  3. Trade execution logic (order matching, position updates)
  4. API error handling (network failures, invalid responses)

**Running Specific Tests**:

```bash
bun run test -- -t "backtest engine"  # Run tests matching pattern
bun run test -- src/lib/backtest     # Run tests in specific directory
```

### Common Pitfalls | 常见陷阱

1. **Using npm instead of bun** → Dependency conflicts, slower installs
2. **Direct floating-point math** → Use `FinancialAmount` for all money
3. **Ignoring K-line validation** → Bad data corrupts backtest results
4. **Forgetting 'use client'** → Server Component errors when using hooks
5. **Hardcoding market hours** → Use `isMarketOpen()` from `market-status.ts`
6. **Not handling database connection errors** → Always wrap DB calls in try/catch

### Deployment Notes | 部署说明

**Lurus Hybrid Cloud Cluster (K3s)**:

- **Cluster**: K3s v1.34.3+ on Hybrid Cloud (Ubuntu/Debian nodes)
- **GitOps**: ArgoCD manages deployment from `deploy/k8s` in this repo.
- **CI/CD**: GitHub Actions builds image -> GHCR (`ghcr.io/hanmahong5-arch/gushen-web`) -> ArgoCD Sync.
- **Namespace**: `ai-qtrd`
- **Domain**: `https://gushen.lurus.cn`
- **Service Port**: 3000 (NodePort available but use Ingress)

**Server Roles**:

- **Master**: `cloud-ubuntu-1` (100.98.57.55) - Traefik Gateway, ArgoCD
- **Database**: `cloud-ubuntu-2` (100.94.177.10) - PostgreSQL (CNPG)
- **Worker**: `cloud-ubuntu-3` (100.113.79.77) - Runs `gushen-web` pods
- **Messaging**: `office-debian-2` (100.120.110.73) - NATS, Redis

**Operations**:

- **Logs**: `kubectl logs -n ai-qtrd -l app=gushen-web`
- **Restart**: `kubectl rollout restart deployment/gushen-web -n ai-qtrd`
- **Database**: Connect via `lurus-pg-1` service in `database` namespace.

**Important**:

- Do NOT manually apply K8s manifests. Push changes to `main` branch or modify `deploy/k8s` and let ArgoCD sync.
- Production uses `ghcr.io` images. Local dev uses `bun run dev`.

### Key File Locations for Common Tasks | 常见任务的关键文件

**Adding a new strategy parameter**:

1. Update `src/lib/strategy/enhanced-parameter-info.ts` (parameter definitions)
2. Update `src/components/strategy-editor/parameter-editor.tsx` (UI)
3. Update strategy template in `src/lib/strategy-templates/`

**Adding a new backtest metric**:

1. Add calculation in `src/lib/backtest/statistics.ts`
2. Update `BacktestResult` type in `src/lib/backtest/types.ts`
3. Update UI in `src/components/backtest/results-panel.tsx`

**Adding a new AI agent**:

1. Create agent in `src/lib/advisor/agents/`
2. Register in `src/lib/advisor/agent-registry.ts`
3. Add UI selector in `src/components/advisor/agent-selector.tsx`

**Adding a new database table**:

1. Define schema in `src/lib/db/schema.ts`
2. Run `bun run db:generate` to create migration
3. Run `bun run db:push` to apply to database
4. Add TypeScript types from Drizzle schema

---

**Last Updated**: 2026-02-25

---

## BMAD Integration

Subsystem of **lurus-gushen**. BMAD artifacts in parent service dir.

- PRD: `../_bmad-output/planning-artifacts/prd.md`
- Architecture: `../_bmad-output/planning-artifacts/architecture.md`
- Epics: `../_bmad-output/planning-artifacts/epics.md`
- Sprint Status: `../_bmad-output/implementation-artifacts/sprint-status.yaml`
