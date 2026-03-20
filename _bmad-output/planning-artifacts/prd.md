---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
inputDocuments: ['product-brief.md', 'architecture.md', 'project-context.md', 'lucrum-web/CLAUDE.md', 'lucrum-web/package.json']
date: 2026-02-02
regenerated: 2026-02-02
author: Anita (via BMAD PRD Workflow)
projectType: web-application
domainComplexity: high
---

# PRD: Lucrum AI Quantitative Trading Platform
# 产品需求文档：股神 AI 量化交易平台

---

## 1. Product Overview / 产品概述

### 1.1 Purpose / 目的

Lucrum is a web-based AI quantitative trading platform that enables users to design, backtest, and validate trading strategies using natural language and AI assistance. It provides financial-grade calculations, multi-stock validation, automated strategy discovery, and AI-powered investment advisory.

股神是一个基于 Web 的 AI 量化交易平台，使用户能够使用自然语言和 AI 辅助来设计、回测和验证交易策略。提供金融级计算精度、多股验证、自动策略发现和 AI 投资咨询服务。

### 1.2 Problem Statement / 问题陈述

Quantitative trading tools are currently inaccessible to non-programmers and expensive for individual investors. Users need:
1. A way to describe strategies in natural language and get executable code
2. Financial-grade backtesting with precise calculations (Decimal.js, not floating point)
3. Multi-stock validation to assess strategy robustness across sectors
4. AI-powered investment analysis from multiple perspectives
5. Automated discovery of proven strategies from open-source communities
6. Workflow-driven strategy development with caching and step management

### 1.3 Target Users / 目标用户

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Strategy Designer** | Investor with trading ideas but limited coding skills | Natural language → code, parameter tuning, workflow guidance |
| **Quantitative Analyst** | Technical user who writes strategy code directly | Accurate backtest engine, multi-metric analysis, batch validation |
| **Investment Learner** | Beginner exploring quantitative methods | AI advisor, strategy templates, popular strategy browsing |

---

## 2. User Journeys / 用户旅程

### Journey 1: Strategy Creation & Backtest (Core Flow)

```
User describes strategy in Chinese
    → "当KDJ在20以下金叉时买入，在80以上死叉时卖出，仓位50%"
    ↓
AI generates Python strategy code (vnpy CtaTemplate)
    ↓
User adjusts parameters via visual editor
    → KDJ周期=9, slow=3, smooth=3
    ↓
User selects target stock (NOT mock data)
    → 600519 贵州茅台 or sector: 申万食品饮料
    ↓
User runs backtest
    ↓
System fetches K-line data (DB → API → simulated fallback)
    ↓
Engine executes backtest with Decimal.js precision
    ↓
Results displayed: 30+ metrics, equity curve, trade list, signal details
    ↓
User exports report or iterates
```

**Acceptance Criteria / 验收标准**:
- AC-1.1: User can describe strategy in Chinese natural language (≤ 1000 chars)
- AC-1.2: AI generates valid Python strategy code within 10 seconds
- AC-1.3: Parameter editor displays all strategy parameters with type-appropriate controls
- AC-1.4: User can select real stock, sector, or portfolio as backtest target
- AC-1.5: Backtest uses real DB data when available (NOT mock by default)
- AC-1.6: Results include: total return, annualized return, max drawdown, Sharpe ratio, win rate, trade count (minimum)
- AC-1.7: All financial calculations use Decimal.js (no floating point)
- AC-1.8: Data source type (real/simulated) is clearly indicated in results

### Journey 2: Multi-Stock Validation

```
User completes single-stock backtest (Journey 1)
    ↓
User navigates to "多股验证" (Multi-Stock Validation)
    ↓
User selects validation mode:
    → Sector-based (e.g., 申万银行)
    → Custom stock list (manual selection)
    ↓
User selects strategy:
    → Built-in strategy (8+ available)
    → User custom strategy (from DB)
    ↓
System runs backtest across all stocks in selection
    ↓
Results:
    → Summary metrics (win rate, avg return, Sharpe)
    → Stock ranking table with sorting
    → Return distribution histogram
    → Signal timeline chart
    ↓
User clicks a stock row → Signal details filtered
    ↓
User exports CSV ranking report or JSON data
```

**Acceptance Criteria / 验收标准**:
- AC-2.1: Sector selection provides Shenwan industries + hot concepts
- AC-2.2: Batch backtest runs across all stocks in selected sector
- AC-2.3: Stock ranking table supports sortable columns (rank, signals, win rate, avg return, total return, Sharpe)
- AC-2.4: Virtual scrolling activates for 50+ stocks
- AC-2.5: Row click filters signal details to selected stock
- AC-2.6: CSV export includes BOM for Excel Chinese compatibility
- AC-2.7: Mobile responsive card view below 768px
- AC-2.8: Strategy selector shows grouped strategies (builtin vs user custom)
- AC-2.9: Request cancellation via AbortController prevents duplicate submissions

### Journey 3: AI Investment Advisor Consultation

```
User has questions about a strategy or market situation
    ↓
User opens AI advisor panel
    ↓
User selects advisor mode:
    → Single agent (e.g., Buffett perspective)
    → Debate mode (bull vs bear)
    → Committee (multiple agents)
    ↓
AI agents analyze strategy/market from their perspective
    ↓
Response includes: analysis, recommendations, risk warnings
```

**Acceptance Criteria / 验收标准**:
- AC-3.1: 11 agent personas available (4 analysts + 3 researchers + 4 masters)
- AC-3.2: Debate mode presents bull and bear arguments
- AC-3.3: Token budget management prevents context overflow
- AC-3.4: Responses stream in real-time (SSE)

### Journey 4: Strategy Workspace Management

```
User creates/edits strategy
    ↓
Auto-save triggers after 3 seconds of inactivity
    ↓
User navigates away → state preserved in Zustand + localStorage
    ↓
User returns → workspace restored exactly as left
    ↓
User can undo/redo changes
    ↓
User saves strategy to database
```

**Acceptance Criteria / 验收标准**:
- AC-4.1: Auto-save within 3 seconds of last edit
- AC-4.2: Survives page refresh (localStorage hydration)
- AC-4.3: Undo/redo support via Zustand temporal middleware
- AC-4.4: Save status indicator (saved/saving/unsaved/error)
- AC-4.5: 10 most recent drafts maintained

### Journey 5: Workflow-Based Strategy Development (NEW)

```
User starts strategy development workflow
    ↓
Step 1: Input - User describes strategy goal in natural language
    ↓
Step 2: Generate - System generates strategy code via AI
    → Results cached (hash-based input matching)
    ↓
Step 3: Backtest - System runs backtest with generated code
    → Results cached per step with TTL
    ↓
Step 4: Validate - System validates strategy across multiple stocks
    ↓
User reviews workflow progress at any time
    → Can re-run individual steps with modified inputs
    → Previous step results preserved unless inputs change
```

**Acceptance Criteria / 验收标准**:
- AC-5.1: Workflow session persists across page navigation
- AC-5.2: Each step result is cached by input hash (avoid re-computation)
- AC-5.3: Step results have configurable TTL-based expiration
- AC-5.4: User can re-execute any step without losing other step results
- AC-5.5: Workflow status visible in strategy guide card on dashboard

### Journey 6: Popular Strategy Discovery (NEW)

```
User browses popular/trending strategies
    ↓
System shows strategies crawled from GitHub
    → Sorted by popularity score (stars, forks, freshness)
    → Filtered by strategy type / indicator
    ↓
User selects a strategy
    ↓
System converts to platform format (vnpy CtaTemplate)
    ↓
User previews converted code and parameters
    ↓
User imports into workspace for backtesting
```

**Acceptance Criteria / 验收标准**:
- AC-6.1: Crawler discovers strategies from GitHub with quality scoring
- AC-6.2: Popularity score considers: stars, forks, code quality, freshness
- AC-6.3: Strategy converter outputs valid vnpy CtaTemplate code
- AC-6.4: Crawling runs on schedule with rate limiting
- AC-6.5: Imported strategies appear in user's strategy list

---

## 3. Functional Requirements / 功能需求

### FR-1: Strategy Editor / 策略编辑器

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-1.1 | Natural language strategy description input (Chinese) | P0 | ✅ Done |
| FR-1.2 | AI code generation (vnpy CtaTemplate format) | P0 | ✅ Done |
| FR-1.3 | Python syntax highlighting code editor | P0 | ✅ Done |
| FR-1.4 | Visual parameter editor with type controls | P0 | ✅ Done |
| FR-1.5 | Strategy template library (≥ 5 templates) | P1 | Pending |
| FR-1.6 | Code validation before backtest | P1 | ✅ Done |
| FR-1.7 | Strategy versioning | P2 | Pending |

### FR-2: Backtest Engine / 回测引擎

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-2.1 | K-line data provider (DB → API → simulated) | P0 | ✅ Done |
| FR-2.2 | Trade execution modeling (slippage, commission, stamp duty) | P0 | ✅ Done |
| FR-2.3 | 30+ financial metrics calculation | P0 | ✅ Done |
| FR-2.4 | Position management (cash, holdings, orders) | P0 | ✅ Done |
| FR-2.5 | China A-share 100-lot constraint enforcement | P0 | ✅ Done |
| FR-2.6 | K-line data quality validation | P0 | ✅ Done |
| FR-2.7 | Real stock target selection (not mock default) | P0 | In Progress |
| FR-2.8 | Backtest progress event streaming | P1 | ✅ Done |
| FR-2.9 | Result caching (Redis + in-memory hybrid) | P1 | ✅ Done |
| FR-2.10 | Parallel batch backtest for multi-stock | P1 | Pending |
| FR-2.11 | Interface-driven engine architecture (IDataProvider, IBacktestEngine) | P0 | ✅ Done |
| FR-2.12 | Comprehensive test coverage (≥ 85%, 680+ tests) | P0 | ✅ Done |

### FR-3: Results & Visualization / 结果与可视化

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-3.1 | Summary metrics panel (return, Sharpe, MDD, win rate) | P0 | ✅ Done |
| FR-3.2 | Equity curve chart | P0 | ✅ Done |
| FR-3.3 | Trade list with entry/exit details | P0 | ✅ Done |
| FR-3.4 | Signal details (date, price, type, return) | P0 | ✅ Done |
| FR-3.5 | Backtest basis panel (data source transparency) | P0 | ✅ Done |
| FR-3.6 | PDF/CSV report export | P1 | Partial (CSV done) |
| FR-3.7 | Strategy comparison view | P2 | Pending |
| FR-3.8 | Return distribution histogram | P1 | ✅ Done |
| FR-3.9 | Signal timeline chart | P1 | ✅ Done |

### FR-4: Multi-Stock Validation / 多股验证

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-4.1 | Sector selector (Shenwan industry + concepts) | P0 | ✅ Done |
| FR-4.2 | Stock ranking table with sortable columns | P0 | ✅ Done |
| FR-4.3 | Virtual scrolling for 50+ stocks | P0 | ✅ Done |
| FR-4.4 | Return range visualization bar | P0 | ✅ Done |
| FR-4.5 | Row click → signal filtering | P0 | ✅ Done |
| FR-4.6 | CSV export with BOM | P0 | ✅ Done |
| FR-4.7 | Loading skeleton and error states | P1 | ✅ Done |
| FR-4.8 | Keyboard navigation (arrow keys, Enter, Escape) | P1 | ✅ Done |
| FR-4.9 | Mobile responsive card view | P1 | ✅ Done |
| FR-4.10 | ARIA accessibility labels | P1 | ✅ Done |
| FR-4.11 | Grouped strategy selector (builtin vs user) | P0 | ✅ Done |
| FR-4.12 | Custom stock list selection mode | P0 | ✅ Done |
| FR-4.13 | Request cancellation (AbortController) | P1 | ✅ Done |
| FR-4.14 | Per-stock Sharpe ratio display | P1 | ✅ Done |
| FR-4.15 | JSON export capability | P1 | ✅ Done |

### FR-5: AI Advisor / AI 投资顾问

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-5.1 | 11 specialized agent personas | P0 | ✅ Done |
| FR-5.2 | 7 investment school philosophies | P0 | ✅ Done |
| FR-5.3 | Debate mode (bull vs bear) | P1 | ✅ Done |
| FR-5.4 | Token budget management | P1 | ✅ Done |
| FR-5.5 | Streaming responses (SSE) | P1 | ✅ Done |
| FR-5.6 | Conversation history persistence | P2 | Pending |

### FR-6: Data Management / 数据管理

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-6.1 | Stock metadata import (code, name, market, industry) | P0 | ✅ Done |
| FR-6.2 | K-line historical data import (OHLCV) | P0 | ✅ Done |
| FR-6.3 | Data import scripts (bun run db:import) | P0 | ✅ Done |
| FR-6.4 | Real-time market data integration | P2 | Pending |
| FR-6.5 | Scheduled data update automation (cron) | P2 | Pending |

### FR-7: Workflow System / 工作流系统 (NEW)

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-7.1 | Multi-step workflow session management | P1 | ✅ Done |
| FR-7.2 | Step execution with deterministic caching | P1 | ✅ Done |
| FR-7.3 | Hash-based input matching for cache hits | P1 | ✅ Done |
| FR-7.4 | TTL-based per-step result expiration | P1 | ✅ Done |
| FR-7.5 | Strategy development 4-step workflow | P1 | ✅ Done |
| FR-7.6 | Workflow progress indicator on dashboard | P1 | ✅ Done |
| FR-7.7 | API endpoints: create session, execute step, get status | P1 | ✅ Done |

### FR-8: Strategy Discovery / 策略发现 (NEW)

| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| FR-8.1 | GitHub strategy crawler | P1 | ✅ Done |
| FR-8.2 | Popularity scoring (stars, forks, quality, freshness) | P1 | ✅ Done |
| FR-8.3 | Strategy format converter (→ vnpy CtaTemplate) | P1 | ✅ Done |
| FR-8.4 | Scheduled crawling with rate limiting | P1 | ✅ Done |
| FR-8.5 | Popular strategies API endpoint | P1 | ✅ Done |
| FR-8.6 | Trending strategies API endpoint | P1 | ✅ Done |

---

## 4. Non-Functional Requirements / 非功能需求

### NFR-1: Performance / 性能

| ID | Requirement | Target |
|----|------------|--------|
| NFR-1.1 | Single stock backtest (1yr data) | < 3 seconds |
| NFR-1.2 | Multi-stock backtest (20 stocks, 1yr each) | < 30 seconds |
| NFR-1.3 | First contentful paint (dashboard) | < 1.5 seconds |
| NFR-1.4 | Stock ranking table render (100 rows) | < 100ms |
| NFR-1.5 | AI code generation response | < 10 seconds |
| NFR-1.6 | Workflow step cache hit response | < 50ms |
| NFR-1.7 | Market data API (cached) | < 200ms |

### NFR-2: Reliability / 可靠性

| ID | Requirement | Target |
|----|------------|--------|
| NFR-2.1 | Monthly uptime | ≥ 99.5% |
| NFR-2.2 | Data loss prevention (auto-save) | Zero data loss on navigation |
| NFR-2.3 | Graceful degradation (no DB data) | Fall back to simulated data |
| NFR-2.4 | Error recovery (backtest failure) | Clear error message with code (BT1XX-BT9XX) |
| NFR-2.5 | Workflow session recovery | Resume from last completed step |

### NFR-3: Security / 安全

| ID | Requirement | Target |
|----|------------|--------|
| NFR-3.1 | Authentication | NextAuth.js with session management |
| NFR-3.2 | API route protection | Server-side session validation |
| NFR-3.3 | No credential exposure | All secrets in K8s Secrets / .env |
| NFR-3.4 | Input sanitization | Zod validation on all API inputs |

### NFR-4: Accessibility / 无障碍

| ID | Requirement | Target |
|----|------------|--------|
| NFR-4.1 | WCAG 2.1 Level AA | 90%+ compliance |
| NFR-4.2 | Keyboard navigation | All interactive elements reachable |
| NFR-4.3 | Screen reader support | ARIA labels on all data tables |
| NFR-4.4 | Color contrast (dark mode) | 4.5:1 minimum ratio |

### NFR-5: Testing / 测试

| ID | Requirement | Target | Current |
|----|------------|--------|---------|
| NFR-5.1 | Business logic (lib/backtest/) | ≥ 80% coverage | **85%+ (680 tests)** |
| NFR-5.2 | Data layer (lib/db/) | ≥ 60% coverage | ~30% |
| NFR-5.3 | Components | ≥ 50% coverage | ~25% |
| NFR-5.4 | Critical path E2E | Key user journeys automated | Pending |

---

## 5. Domain Model / 领域模型

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Lucrum Domain Model                            │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Strategy  │───→│ Backtest Run │───→│ Backtest      │              │
│  │           │    │              │    │ Result        │              │
│  │ - code    │    │ - config     │    │ - metrics     │              │
│  │ - params  │    │ - target     │    │ - trades      │              │
│  │ - desc    │    │ - dataSource │    │ - signals     │              │
│  │ - source  │    │ - userId     │    │ - equityCurve │              │
│  │   (builtin│    └──────────────┘    └───────────────┘              │
│  │    /user/ │                                                       │
│  │    crawled)│   ┌──────────────┐                                   │
│  └──────────┘    │ AI Advisor   │                                    │
│       │      └──→│ Session      │                                    │
│       │          │ - agents[]   │                                    │
│       │          │ - messages[] │                                    │
│       │          │ - mode       │                                    │
│       │          └──────────────┘                                    │
│       │                                                              │
│       │          ┌──────────────┐                                    │
│       └─────────→│ Workflow     │                                    │
│                  │ Session      │                                    │
│                  │ - steps[]    │                                    │
│                  │ - cache      │                                    │
│                  │ - status     │                                    │
│                  └──────────────┘                                    │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │  Stock    │───→│  K-line Data │    │ Crawled       │              │
│  │           │    │              │    │ Strategy      │              │
│  │ - symbol  │    │ - date       │    │               │              │
│  │ - name    │    │ - OHLCV      │    │ - source_url  │              │
│  │ - market  │    │ - volume     │    │ - score       │              │
│  │ - sector  │    │ - turnover   │    │ - converted   │              │
│  └──────────┘    └──────────────┘    └───────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Surface / API 接口

### Strategy Generation
- `POST /api/strategy/generate` - Generate code from prompt
- `POST /api/strategy/optimize` - Suggest parameter optimizations

### Backtest
- `POST /api/backtest` - Single symbol backtest
- `POST /api/backtest/sector` - Sector-wide backtest
- `POST /api/backtest/multi-stocks` - Custom stock list backtest
- `GET /api/backtest/sector` - Available strategies (builtin + user) & sectors

### Workflow
- `POST /api/workflow` - Create workflow session
- `POST /api/workflow/[sessionId]/step/[stepNumber]` - Execute step
- `GET /api/workflow/[sessionId]` - Get session status

### Strategy Discovery
- `GET /api/strategies/popular` - Trending strategies
- `GET /api/strategies/trending` - Recently trending
- `POST /api/cron/crawl-strategies` - Manual trigger

### Market Data
- `GET /api/market/kline` - K-line data
- `GET /api/market/quote` - Stock quotes
- `GET /api/market/status` - Market hours
- `GET /api/stocks/list` - Stock universe
- `GET /api/stocks/search` - Stock search

### Advisor
- `POST /api/advisor/chat` - Chat with advisor
- `POST /api/advisor/debate` - Bull vs bear debate

---

## 7. Success Metrics / 成功指标

| Metric | Baseline (Feb 2) | Current | Q1 Target | Q2 Target |
|--------|-------------------|---------|-----------|-----------|
| Active strategies | ~5 | 8+ builtin + user | 15 | 20+ |
| Backtest runs/week | ~20 | ~30 | 50 | 100+ |
| Test coverage (backtest/) | ~15% | **85%+ (680 tests)** | ≥ 85% | ≥ 90% |
| Real data backtest ratio | ~10% | ~40% | 70% | 90%+ |
| Multi-stock validation usage | New feature | ~20% of sessions | 30% | 50% |
| First backtest time (new user) | ~5 min | ~3 min | < 3 min | < 2 min |
| Workflow completion rate | N/A | New feature | 50% | 70% |
| Crawled strategies imported | N/A | New feature | 10 | 50+ |

---

## 8. Out of Scope / 不在范围内

1. Real-money automated trading execution
2. Mobile native applications
3. Third-party broker integration (planned for Q3+)
4. Real-time tick data (only daily K-line)
5. Options/futures trading strategies
6. Social features (public strategy sharing)
7. Multi-language UI (Chinese-only for now)

---

## 9. Strategy Scoring Algorithm / 策略评分算法

### 9.1 Overview / 概述

Each backtest result receives a composite score (S/A/B/C/D) computed from 4 scoring dimensions. The algorithm ensures consistent, reproducible ratings across all strategy evaluations. All calculations MUST use Decimal.js (ADR-006).

每次回测结果通过 4 个评分维度计算综合评级（S/A/B/C/D）。算法确保所有策略评估的一致性和可重复性。

### 9.2 Minimum Requirements / 最低要求

| Condition | Threshold | Effect |
|-----------|-----------|--------|
| Trade count | ≥ 5 trades | Below → automatic D rating |
| Backtest period | ≥ 60 trading days | Below → score marked as "provisional" |

### 9.3 Scoring Dimensions / 评分维度

| Dimension / 维度 | Weight | Input Metrics | Rationale |
|-------------------|--------|---------------|-----------|
| 收益能力 (Return) | 30% | Annualized return, Total return | Core profitability |
| 风险控制 (Risk Control) | 30% | Max drawdown, Sharpe ratio | Risk-adjusted performance |
| 稳定性 (Stability) | 25% | Sortino ratio, Calmar ratio | Consistency of returns |
| 交易效率 (Efficiency) | 15% | Win rate, Profit factor | Trade execution quality |

### 9.4 Dimension Thresholds / 维度阈值

**收益能力 (Return) — Weight: 30%**

| Grade | Annualized Return | Total Return |
|-------|-------------------|--------------|
| A | ≥ 25% | ≥ 40% |
| B | ≥ 10% | ≥ 15% |
| C | ≥ 0% | ≥ 0% |
| D | < 0% | < 0% |

**风险控制 (Risk Control) — Weight: 30%**

| Grade | Max Drawdown | Sharpe Ratio |
|-------|-------------|--------------|
| A | ≤ 10% | ≥ 1.5 |
| B | ≤ 20% | ≥ 0.8 |
| C | ≤ 35% | ≥ 0.3 |
| D | > 35% | < 0.3 |

**稳定性 (Stability) — Weight: 25%**

| Grade | Sortino Ratio | Calmar Ratio |
|-------|--------------|--------------|
| A | ≥ 2.0 | ≥ 2.0 |
| B | ≥ 1.0 | ≥ 1.0 |
| C | ≥ 0.3 | ≥ 0.3 |
| D | < 0.3 | < 0.3 |

**交易效率 (Efficiency) — Weight: 15%**

| Grade | Win Rate | Profit Factor |
|-------|----------|---------------|
| A | ≥ 60% | ≥ 2.0 |
| B | ≥ 45% | ≥ 1.5 |
| C | ≥ 30% | ≥ 1.0 |
| D | < 30% | < 1.0 |

### 9.5 Composite Score Calculation / 综合评分计算

1. Each dimension grade maps to numeric: A=4, B=3, C=2, D=1
2. Within each dimension, the two metrics are averaged (if one is N/A, use the other alone)
3. Weighted composite = Σ (dimension_score × weight)
4. Final grade mapping:

| Grade | Composite Range | Label | Color Token | Hex | Icon |
|-------|----------------|-------|-------------|-----|------|
| S | ≥ 3.7 | 卓越 | `--lucrum-color-score-s` | #fbbf24 | ★★★ |
| A | ≥ 3.0 | 优秀 | `--lucrum-color-score-a` | #22d3ee | ★★ |
| B | ≥ 2.3 | 良好 | `--lucrum-color-score-b` | #3b82f6 | ★ |
| C | ≥ 1.5 | 一般 | `--lucrum-color-score-c` | #6b7280 | ○ |
| D | < 1.5 | 需改进 | `--lucrum-color-score-d` | #fb923c | ✕ |

### 9.6 Display Rules / 展示规则

- Triple encoding for accessibility: letter + description text + icon (per UX spec §5.3)
- S grade frequency target: ≤ 5% of strategies to maintain scarcity and emotional impact
- Sub-dimension scores displayed on hover with contributing metrics and weights
- Benchmark comparison (vs CSI 300) shown alongside composite score
