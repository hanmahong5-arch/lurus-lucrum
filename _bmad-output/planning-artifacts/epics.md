---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# lurus-lucrum - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for lurus-lucrum, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1.1: Natural language strategy description input (Chinese) [P0] ✅ Done
FR-1.2: AI code generation (vnpy CtaTemplate format) [P0] ✅ Done
FR-1.3: Python syntax highlighting code editor [P0] ✅ Done
FR-1.4: Visual parameter editor with type controls [P0] ✅ Done
FR-1.5: Strategy template library (≥ 5 templates) [P1] ✅ Done — `src/components/strategy-editor/` 内已实现策略模板选择器
FR-1.6: Code validation before backtest [P1] ✅ Done
FR-1.7: Strategy versioning [P2] Pending

FR-2.1: K-line data provider (DB → API → simulated) [P0] ✅ Done
FR-2.2: Trade execution modeling (slippage, commission, stamp duty) [P0] ✅ Done
FR-2.3: 30+ financial metrics calculation [P0] ✅ Done
FR-2.4: Position management (cash, holdings, orders) [P0] ✅ Done
FR-2.5: China A-share 100-lot constraint enforcement [P0] ✅ Done
FR-2.6: K-line data quality validation [P0] ✅ Done
FR-2.7: Real stock target selection (not mock default) [P0] In Progress
FR-2.8: Backtest progress event streaming [P1] ✅ Done
FR-2.9: Result caching (Redis + in-memory hybrid) [P1] ✅ Done
FR-2.10: Parallel batch backtest for multi-stock [P1] ✅ Done — `/api/backtest/multi-stocks/stream` + `executeBatchBacktest` 已实现，支持100只股票并行扫描
FR-2.11: Interface-driven engine architecture (IDataProvider, IBacktestEngine) [P0] ✅ Done
FR-2.12: Comprehensive test coverage (≥ 85%, 680+ tests) [P0] ✅ Done

FR-3.1: Summary metrics panel (return, Sharpe, MDD, win rate) [P0] ✅ Done
FR-3.2: Equity curve chart [P0] ✅ Done
FR-3.3: Trade list with entry/exit details [P0] ✅ Done
FR-3.4: Signal details (date, price, type, return) [P0] ✅ Done
FR-3.5: Backtest basis panel (data source transparency) [P0] ✅ Done
FR-3.6: PDF/CSV report export [P1] Partial (CSV done)
FR-3.7: Strategy comparison view [P2] Pending
FR-3.8: Return distribution histogram [P1] ✅ Done
FR-3.9: Signal timeline chart [P1] ✅ Done

FR-4.1: Sector selector (Shenwan industry + concepts) [P0] ✅ Done
FR-4.2: Stock ranking table with sortable columns [P0] ✅ Done
FR-4.3: Virtual scrolling for 50+ stocks [P0] ✅ Done
FR-4.4: Return range visualization bar [P0] ✅ Done
FR-4.5: Row click → signal filtering [P0] ✅ Done
FR-4.6: CSV export with BOM [P0] ✅ Done
FR-4.7: Loading skeleton and error states [P1] ✅ Done
FR-4.8: Keyboard navigation (arrow keys, Enter, Escape) [P1] ✅ Done
FR-4.9: Mobile responsive card view [P1] ✅ Done
FR-4.10: ARIA accessibility labels [P1] ✅ Done
FR-4.11: Grouped strategy selector (builtin vs user) [P0] ✅ Done
FR-4.12: Custom stock list selection mode [P0] ✅ Done
FR-4.13: Request cancellation (AbortController) [P1] ✅ Done
FR-4.14: Per-stock Sharpe ratio display [P1] ✅ Done
FR-4.15: JSON export capability [P1] ✅ Done

FR-5.1: 11 specialized agent personas [P0] ✅ Done
FR-5.2: 7 investment school philosophies [P0] ✅ Done
FR-5.3: Debate mode (bull vs bear) [P1] ✅ Done
FR-5.4: Token budget management [P1] ✅ Done
FR-5.5: Streaming responses (SSE) [P1] ✅ Done
FR-5.6: Conversation history persistence [P2] Pending

FR-6.1: Stock metadata import (code, name, market, industry) [P0] ✅ Done
FR-6.2: K-line historical data import (OHLCV) [P0] ✅ Done
FR-6.3: Data import scripts (bun run db:import) [P0] ✅ Done
FR-6.4: Real-time market data integration [P2] Pending
FR-6.5: Scheduled data update automation (cron) [P2] Pending

FR-7.1: Multi-step workflow session management [P1] ✅ Done
FR-7.2: Step execution with deterministic caching [P1] ✅ Done
FR-7.3: Hash-based input matching for cache hits [P1] ✅ Done
FR-7.4: TTL-based per-step result expiration [P1] ✅ Done
FR-7.5: Strategy development 4-step workflow [P1] ✅ Done
FR-7.6: Workflow progress indicator on dashboard [P1] ✅ Done
FR-7.7: API endpoints: create session, execute step, get status [P1] ✅ Done

FR-8.1: GitHub strategy crawler [P1] ✅ Done
FR-8.2: Popularity scoring (stars, forks, quality, freshness) [P1] ✅ Done
FR-8.3: Strategy format converter (→ vnpy CtaTemplate) [P1] ✅ Done
FR-8.4: Scheduled crawling with rate limiting [P1] ✅ Done
FR-8.5: Popular strategies API endpoint [P1] ✅ Done
FR-8.6: Trending strategies API endpoint [P1] ✅ Done

### NonFunctional Requirements

NFR-1.1: Single stock backtest (1yr data) < 3 seconds [Performance]
NFR-1.2: Multi-stock backtest (20 stocks, 1yr each) < 30 seconds [Performance]
NFR-1.3: First contentful paint (dashboard) < 1.5 seconds [Performance]
NFR-1.4: Stock ranking table render (100 rows) < 100ms [Performance]
NFR-1.5: AI code generation response < 10 seconds [Performance]
NFR-1.6: Workflow step cache hit response < 50ms [Performance]
NFR-1.7: Market data API (cached) < 200ms [Performance]

NFR-2.1: Monthly uptime ≥ 99.5% [Reliability]
NFR-2.2: Data loss prevention (auto-save) — Zero data loss on navigation [Reliability]
NFR-2.3: Graceful degradation (no DB data) — Fall back to simulated data [Reliability]
NFR-2.4: Error recovery (backtest failure) — Clear error message with code (BT1XX-BT9XX) [Reliability]
NFR-2.5: Workflow session recovery — Resume from last completed step [Reliability]

NFR-3.1: Authentication — NextAuth.js with session management [Security]
NFR-3.2: API route protection — Server-side session validation [Security]
NFR-3.3: No credential exposure — All secrets in K8s Secrets / .env [Security]
NFR-3.4: Input sanitization — Zod validation on all API inputs [Security]

NFR-4.1: WCAG 2.1 Level AA — 90%+ compliance [Accessibility]
NFR-4.2: Keyboard navigation — All interactive elements reachable [Accessibility]
NFR-4.3: Screen reader support — ARIA labels on all data tables [Accessibility]
NFR-4.4: Color contrast (dark mode) — 4.5:1 minimum ratio [Accessibility]

NFR-5.1: Business logic (lib/backtest/) ≥ 80% coverage — Current: 85%+ (680 tests) [Testing]
NFR-5.2: Data layer (lib/db/) ≥ 60% coverage — Current: ~30% [Testing]
NFR-5.3: Components ≥ 50% coverage — Current: ~25% [Testing]
NFR-5.4: Critical path E2E — Key user journeys automated [Testing]

### Additional Requirements

**Architecture Requirements:**
- ADR-006: ALL monetary calculations MUST use Decimal.js via FinancialAmount wrapper. JavaScript native numbers FORBIDDEN for financial values.
- ADR-009: Workflow orchestration via WorkflowManager + StepExecutor + CacheStrategy in src/lib/workflow/. SHA-256 hash-based cache, per-step TTL, automatic invalidation on upstream re-execution.
- ADR-010: Strategy crawler pipeline: GitHubCrawler → PopularityScorer → StrategyConverter → CrawlerScheduler. Rate-limited GitHub API usage.
- ADR-011: Staging environment in lucrum-staging namespace on master node with Redis db:3 isolation.
- GitOps deployment: GitHub Actions → GHCR → ArgoCD → K3s rolling update.
- Schema isolation: lucrum-web ONLY accesses lucrum schema. Cross-schema queries FORBIDDEN.
- Event streaming: NATS JetStream standard envelope for backtest/strategy/workflow/crawler events.
- Layer boundaries: Transport → Business Logic → Data → UI. Each layer has strict import rules.
- API response format: { success, data, error } wrapper for all TS endpoints.
- Error codes: BT prefix for backtest, GS prefix for other lucrum-web errors. Bilingual messages required.
- Naming patterns: snake_case DB, camelCase TS, kebab-case files/routes. Binding conventions per Architecture §8.1.
- No starter template — existing project with established codebase.

**UX Requirements:**
- Hybrid Adaptive Layout: WorkflowRouter switches layout by current workflow step (Dashboard/Wizard/IDE/Split/Conversation).
- Strategy scoring system (S/A/B/C/D): Triple encoding (letter + description + icon) for accessibility. S grade ≤5% frequency.
- Progressive disclosure: Score → 3 core metrics → 30+ full metrics → raw data. Code folded by default, logic summary shown.
- 30 custom components needed across 4 phases: Phase 1 (9 P0), Phase 2 (7 P1), Phase 3 (8 P2), Phase 4 (6 P3).
- P0 components: ToastSystem, StatusBar, EmptyState, ScoreCard, StrategyLogicSummary, PreCheckPanel, ThreeStageProgress, ErrorDiagnosisCard, WorkflowStepper.
- P1 components: SmartQuestionChips, ApplySuggestionButton, BatchProgressBar, GlobalCommandPalette, BacktestHistoryList, TokenBudgetIndicator, CacheBadge.
- Responsive design: Desktop-first (≥1280px multi-panel), Tablet (768-1279px single+tab), Mobile (<768px read-only cards).
- WCAG 2.1 AA: Color contrast 4.5:1, keyboard navigation, screen reader support, prefers-reduced-motion.
- AI visual language: Purple (#a78bfa) for AI elements, bg-ai, border-ai, ai-pulse animation.
- Data source badges: DB (blue), API (yellow), Simulated (gray). SimulatedDataBanner for global warning.
- Design token extensions: Score colors, source colors, step colors, AI colors, status lights.
- Cross-journey navigation: 10 context-passing connections between 6 user journeys.
- Cmd+K command palette for global quick navigation.
- Two-layer tooltips: Layman explanation + professional explanation for parameters.
- AI "one-click apply" for advisor suggestions that modify strategy parameters.
- Empty state design: Every panel/page must have guidance + examples + suggested actions. No blank states allowed.
- FinancialDisplayData adapter: Unified formatting + accessibility + color mapping for all financial data.
- Container Query for reusable components with fallback to media queries.
- Toast system: sonner library, right-bottom position, 4 variants (success/warning/error/info).
- Three-tier button hierarchy: Primary (1/screen max) / Secondary / Ghost.
- All buttons must have loading state + debounce. Disabled buttons must show tooltip explaining why.

### FR Coverage Map

| FR | Epic | 说明 |
|----|------|------|
| FR-2.7 | Epic 2 | 真实选股完善 |
| FR-1.5 | Epic 3 | 策略模板库 |
| FR-2.10 | Epic 4 | 并行批量回测 |
| FR-3.6 | Epic 4 | PDF 报告导出 |
| FR-3.7 | Epic 4 | 策略对比视图 |
| FR-5.6 | Epic 5 | 对话历史持久化 |
| FR-1.7 | Epic 6 | 策略版本管理 |
| FR-6.4 | Epic 7 | 实时行情集成 |
| FR-6.5 | Epic 7 | 定时数据更新 |

| NFR | Epic | 说明 |
|-----|------|------|
| NFR-5.2/5.3 | Epic 1-6 各内嵌 | 每个 Epic 的 Story 包含对应测试 |
| NFR-5.4 | Epic 7 | E2E 自动化测试专项 |
| NFR-4.1-4.4 | Epic 7 | WCAG AA 无障碍专项审计 |

| UX 组件 | Epic | 优先级 |
|---------|------|--------|
| Design token extensions (score/source/AI/step colors) | Epic 1 | P0 |
| ToastSystem (sonner) | Epic 1 | P0 |
| StatusBar | Epic 1 | P0 |
| EmptyState | Epic 1 | P0 |
| WorkflowStepper | Epic 1 | P0 |
| FinancialDisplayData adapter | Epic 1 | P0 |
| ScoreCard (S/A/B/C/D) | Epic 2 | P0 |
| StrategyLogicSummary | Epic 2 | P0 |
| DataSourceBadge + SimulatedDataBanner | Epic 2 | P0 |
| PreCheckPanel | Epic 2 | P0 |
| ThreeStageProgress | Epic 2 | P0 |
| ErrorDiagnosisCard | Epic 2 | P0 |
| StrategyDiscoveryCard, StrategyDetailPanel | Epic 3 | P2 |
| QuickPreviewResult, FilterBar | Epic 3 | P2 |
| BatchProgressBar | Epic 4 | P1 |
| BacktestHistoryList | Epic 4 | P1 |
| StrategyComparisonView | Epic 4 | P2 |
| SmartQuestionChips | Epic 5 | P1 |
| ApplySuggestionButton | Epic 5 | P1 |
| TokenBudgetIndicator | Epic 5 | P1 |
| GlobalCommandPalette (Cmd+K) | Epic 6 | P1 |
| CacheBadge | Epic 6 | P2 |
| TwoLayerTooltip | Epic 6 | P2 |
| WorkflowSummaryReport | Epic 6 | P2 |

## Epic List

### Epic 1: 专业体验基石 (Professional Experience Foundation)

用户能感受到平台从原型升级为专业金融工具：统一的通知反馈、全局状态感知、空状态引导、工作流步骤导航，以及所有金融数据的一致格式化。

这是所有后续 Epic 的横切基础设施，确保后续组件有统一的设计令牌、反馈通道和导航骨架可依赖。

**用户成果**: 平台具备专业金融工具的视觉语言和交互一致性，用户始终知道自己在哪一步、系统在做什么。

**FRs covered:** 无独立 FR（横切基础设施）
**NFRs addressed:** NFR-1.3 (FCP), NFR-2.2 (auto-save status), NFR-4.4 (contrast)
**UX components:** Design token extensions, ToastSystem, StatusBar, EmptyState, WorkflowStepper, FinancialDisplayData adapter
**测试**: 组件单元测试 + Storybook 验证

**依赖**: 无（独立交付）
**被依赖**: Epic 2-7 全部依赖此 Epic 的令牌和横切组件

---

### Epic 2: 可信回测体验 (Trustworthy Backtest Experience)

用户能用真实数据回测策略，通过 S/A/B/C/D 评分一眼判断策略好坏，看到白话策略摘要而非代码，完全信任展示的每个数字的来源。

**用户成果**: 从"回测结果是一堆数字"升级为"一眼知道策略值不值得投入"。数据源透明可追溯，模拟数据有全局警告。

**FRs covered:** FR-2.7
**NFRs addressed:** NFR-1.1 (backtest <3s), NFR-2.3 (graceful degradation), NFR-2.4 (error codes)
**UX components:** ScoreCard, StrategyLogicSummary, DataSourceBadge, SimulatedDataBanner, PreCheckPanel, ThreeStageProgress, ErrorDiagnosisCard
**新增业务逻辑**: ScoreCalculator (lib/backtest/ — 评分算法), Progressive disclosure 渐进披露逻辑
**测试**: 评分算法单元测试 + 组件测试

**依赖**: Epic 1（设计令牌、Toast、StatusBar）
**被依赖**: Epic 3 (ScoreCard for discovery), Epic 4 (ScoreCard for batch), Epic 5 (结果上下文)

---

### Epic 3: 策略来源与发现 (Strategy Source & Discovery)

用户无需编程知识，即可浏览热门策略、按类型/热度筛选、查看白话摘要和快速预览回测结果、一键导入到工作区或工作流。新用户通过分级示例（简单/进阶/专业）30秒内完成首次回测体验。

**用户成果**: "不知道写什么策略"的用户有了明确起点——模板库提供 5+ 经典策略，发现页汇聚 GitHub 热门策略，入门体验零门槛。

**FRs covered:** FR-1.5
**NFRs addressed:** NFR-1.3 (FCP), NFR-2.3 (empty state fallback)
**UX components:** StrategyDiscoveryCard, StrategyDetailPanel, QuickPreviewResult, FilterBar, TieredDemoSelector
**测试**: 组件测试 + 策略导入集成测试

**依赖**: Epic 1（EmptyState, Toast）, Epic 2（ScoreCard for preview）
**被依赖**: Epic 6（策略导入到工作流）

---

### Epic 4: 批量验证与专业报告 (Batch Validation & Professional Reports)

用户能高效对多只股票并行执行回测验证，获得完整 PDF 汇总报告，并排对比两个策略的历史表现，快速回顾最近 20 次回测记录。

**用户成果**: 从"一次只能测一只股票"升级为"一次验证整个板块，导出报告给团队/客户"。

**FRs covered:** FR-2.10, FR-3.6, FR-3.7
**NFRs addressed:** NFR-1.2 (batch <30s), NFR-1.4 (table render <100ms)
**UX components:** BatchProgressBar, BacktestHistoryList, StrategyComparisonView, AbnormalAnalysisPanel
**技术 Spike**: 并行回测方案调研（Web Worker vs NATS 任务队列）
**测试**: 并行回测性能测试 + PDF 生成集成测试

**依赖**: Epic 1（Toast, StatusBar）, Epic 2（ScoreCard for batch summary）
**被依赖**: Epic 5（批量结果 → 问 AI）

---

### Epic 5: AI 副驾驶 (AI Co-pilot)

AI 顾问基于回测上下文自动推荐高价值问题，给出结构化建议（建议→理由→预期影响），用户一键将参数调整建议应用到策略并重跑回测。对话历史持久化可回溯。

**用户成果**: AI 从"独立聊天工具"升级为"内嵌于工作流每一步的投资搭档"。用户不再需要想"该问什么"，AI 主动提供可操作的改进方向。

**FRs covered:** FR-5.6
**NFRs addressed:** NFR-1.5 (AI response <10s)
**UX components:** SmartQuestionChips, ApplySuggestionButton, TokenBudgetIndicator, AI visual language (purple theme, bg-ai, border-ai, ai-pulse)
**跨旅程集成**: J1→J3 侧栏模式, J2→J3 行级"问AI", J3→J1 一键应用参数
**测试**: AI 建议应用集成测试 + 对话持久化测试

**依赖**: Epic 1（Toast, StatusBar）, Epic 2（回测结果上下文）
**被依赖**: Epic 6（工作流每步 AI 入口）

---

### Epic 6: 工作流效率与版本管理 (Workflow Efficiency & Versioning)

用户通过 Cmd+K 命令面板快速跳转任何功能，在工作流中清晰看到缓存命中标识和完成仪式，参数 tooltip 提供白话+专业双层解释，策略支持版本管理追溯历史修改。

**用户成果**: IDE 级别的操作效率 + 策略版本可追溯。高级用户不再需要手动记录每次参数修改。

**FRs covered:** FR-1.7
**NFRs addressed:** NFR-1.6 (cache hit <50ms), NFR-2.5 (workflow recovery)
**UX components:** GlobalCommandPalette, CacheBadge, TwoLayerTooltip, WorkflowSummaryReport, ForkDialog
**测试**: 命令面板搜索测试 + 版本管理 CRUD 测试

**依赖**: Epic 1（WorkflowStepper）, Epic 5（AI 入口集成）
**被依赖**: 无

---

### Epic 7: 平台成熟与无障碍 (Platform Maturity & Accessibility)

平台支持实时行情数据自动更新，E2E 测试覆盖关键用户旅程，WCAG 2.1 AA 无障碍合规审计通过，响应式设计在平板和移动端优雅降级。

**用户成果**: 平台值得长期使用——数据自动更新不过期，残障用户可完整使用，平板上可查看结果和排名。

**FRs covered:** FR-6.4, FR-6.5
**NFRs addressed:** NFR-2.1 (99.5% uptime), NFR-4.1-4.4 (WCAG AA), NFR-5.2-5.4 (test coverage)
**UX deliverables:** axe-core CI 集成, prefers-reduced-motion 支持, forced-colors 支持, 响应式断点专项验证, FinancialDisplayData 无障碍增强
**测试**: E2E 自动化 (Playwright), 无障碍审计 (axe-core), 响应式测试矩阵 (6 viewports)

**依赖**: Epic 1-6（全部功能就位后做全面审计）
**被依赖**: 无

---

### Epic 依赖关系图

```
Epic 1 (体验基石)
  ├──→ Epic 2 (可信回测)
  │      ├──→ Epic 3 (策略发现)
  │      ├──→ Epic 4 (批量验证)
  │      └──→ Epic 5 (AI 副驾驶)
  │             └──→ Epic 6 (工作流效率)
  └──→ Epic 7 (平台成熟) ← 依赖 Epic 1-6 全部
```

注意: Epic 3/4/5 之间无硬依赖，可根据团队资源并行开发。

### 设计决策记录

| 决策 | 理由 | 来源 |
|------|------|------|
| 拆出 Epic 1 作为横切基础 | 避免后续 Epic 重复建设设计令牌和反馈通道 | War Room (Sally, Winston) |
| WorkflowStepper 前置到 Epic 1 | 核心用户需要工作流导航感知 | Focus Group, Pre-mortem |
| EmptyState 前置到 Epic 1 | Dashboard/编辑器空态在 Epic 2 前就需要 | War Room (Sally) |
| FR-1.7 版本管理放 Epic 6 | 量化分析师高频痛点，但需要工作流基础 | Focus Group |
| Epic 4 加 Spike Story | 并行回测方案需先调研再实现 | War Room (Winston) |
| 测试分散到各 Epic | 避免质量问题累积到最后 | Pre-mortem, First Principles |
| 响应式内置到组件 DoD | 避免集中补做响应式的返工 | Pre-mortem, First Principles |
| 7 Epic 而非 6 Epic | Epic 1 体量可控，每个 Epic 更聚焦 | Tree of Thoughts 方案 C |

---

## Epic 1: 专业体验基石 (Professional Experience Foundation)

用户能感受到平台从原型升级为专业金融工具：统一的通知反馈、全局状态感知、空状态引导、工作流步骤导航，以及所有金融数据的一致格式化。

### Story 1.1: 设计系统令牌扩展

As a 用户,
I want 平台的评分、数据源、AI 元素和状态指示使用统一且专业的视觉语言,
So that 我能通过颜色和样式直觉地区分不同类型的信息。

**Acceptance Criteria:**

**Given** 现有设计系统 (DESIGN_SYSTEM.md + tailwind.config.ts)
**When** 开发者扩展设计令牌
**Then** tailwind.config.ts 中新增以下 CSS 变量并可通过 Tailwind class 使用:
- 评分色: `--lucrum-color-score-s` (#fbbf24), `score-a` (#22d3ee), `score-b` (#3b82f6), `score-c` (#6b7280), `score-d` (#fb923c)
- 数据源色: `--lucrum-color-source-db` (#3b82f6), `source-api` (#eab308), `source-sim` (#6b7280)
- AI 色: `--lucrum-color-ai` (#a78bfa), `--lucrum-bg-ai` (rgba(167,139,250,0.10)), `--lucrum-border-ai` (rgba(167,139,250,0.20))
- 步骤色: `--lucrum-color-step-active` (#3b82f6), `step-done` (#22c55e), `step-pending` (#4b5563)
- 状态灯色: `--lucrum-color-status-ready` (#22c55e), `status-warn` (#eab308), `status-block` (#ef4444)
- 背景层级: `--lucrum-bg-surface-elevated` (#1f1f23), `--lucrum-bg-surface-modal` (#2d2d33)
- 图表色: benchmark (#6b7280), 交易信号 (#a78bfa)
**And** Display 字型级别注册: `fontSize.display` = `clamp(32px, 5vw, 48px)` with lineHeight 1.1, fontWeight 700
**And** Caption/Data SM 字号从 12px 调整为 13px
**And** 所有新增前景色在 bg-void (#09090b) 上满足 WCAG AA 对比度 (≥ 4.5:1 正文, ≥ 3:1 大字)
**And** `ai-mark` Tailwind plugin class 注册 (bg-ai + border-left 2px ai + border-ai)
**And** 单元测试验证所有新增 CSS 变量可被解析且非空值

---

### Story 1.2: Toast 通知系统

As a 用户,
I want 操作后获得即时、清晰的反馈通知,
So that 我始终知道操作是否成功、是否需要关注。

**Acceptance Criteria:**

**Given** 用户在平台执行任何操作
**When** 操作产生需要通知的结果
**Then** 右下角显示 Toast 通知，支持 4 种变体:
- success: 左侧 2px 绿色标记 + ✓ 图标, 5s 后自动关闭 + 手动关闭
- warning: 左侧 2px 黄色标记 + ⚠ 图标, 不自动消失
- error: 左侧 2px 红色标记 + ✕ 图标, 不自动消失, `aria-live="assertive"`
- info: 左侧 2px 蓝色标记 + ℹ 图标, 5s 后自动关闭
**And** Toast 使用 sonner 库实现，最多同时显示 3 个，超出时堆叠
**And** Toast 入场动画 slide-in-right (150ms)，退场 fade-out (150ms)
**And** 支持 swipe-to-dismiss 手势
**And** 支持 Promise toast 模式 (loading → success/error 自动切换)
**And** `prefers-reduced-motion` 下禁用所有动画，直接显示/隐藏
**And** success/info 使用 `aria-live="polite"`, error 使用 `aria-live="assertive"`
**And** Toast 背景使用 `bg-surface-elevated`，max-width 360px
**And** 组件测试覆盖: 4 种变体渲染、自动关闭计时、手动关闭、Promise 模式

---

### Story 1.3: 底部状态栏

As a 用户,
I want 屏幕底部始终显示当前系统状态,
So that 我无需切换页面就能知道保存状态、数据来源、工作流步骤和网络连接。

**Acceptance Criteria:**

**Given** 用户在桌面端 (≥ 768px) 使用平台
**When** 页面加载完成
**Then** 屏幕底部固定显示 StatusBar，包含以下 Slot:
- save-status: 显示 "● 已保存" / "● 保存中..." / "● 未保存" / "● 保存失败"，对应绿/蓝/灰/红状态灯
- data-source: 显示当前数据来源 "DB" / "API" / "模拟"
- workflow-step: 显示 "步骤 N/4" (当在工作流中时)
- network: 显示 "✓" 或 "✕ 网络断开"
**And** StatusBar 使用 `bg-surface` + `border-t` 样式，高度 28px
**And** 各 Slot 使用 flexbox 水平排列，分隔符为竖线
**And** StatusBar 使用 `role="status"` + `aria-live="polite"`
**And** 移动端 (< 768px) 隐藏 StatusBar，状态通过 Toast 替代反馈
**And** StatusBar 通过 Zustand store 获取状态数据，支持外部更新
**And** 组件测试覆盖: 各状态变体渲染、Slot 更新响应、响应式隐藏

---

### Story 1.4: 空状态组件

As a 用户,
I want 当页面或面板没有数据时看到引导和建议操作,
So that 我不会面对空白页面不知所措，始终有明确的下一步。

**Acceptance Criteria:**

**Given** 页面或面板没有可展示的数据
**When** 组件渲染空状态
**Then** 显示 EmptyState 组件:
- Lucide React 图标 (48px, `text-muted`)
- 标题文字 (Body 14px, `text-muted`, 居中)
- 1-2 个操作按钮 (主按钮 `btn-tactile` + `--lucrum-color-primary`, 可选次按钮 ghost)
**And** 组件支持以下 Props: `icon: LucideIcon`, `title: string`, `description?: string`, `actions: Array<{label, onClick, variant}>`
**And** 上方留 `space-2xl` (32px) 呼吸空间
**And** 不使用插画，仅使用 Lucide 图标
**And** 预设 5 种场景配置导出:
- 空编辑器: FileCode + "开始创建你的第一个策略" + [新建][浏览模板]
- 无回测历史: BarChart3 + "还没有回测记录" + [运行第一次回测]
- 空策略列表: Folder + "还没有保存的策略" + [新建][导入]
- AI 无上下文: MessageCircle + "先回测，AI 分析更精准" + [去回测][直接提问]
- 发现无数据: Globe + "暂时无法获取最新策略" + [显示缓存][刷新]
**And** 组件使用 `role="status"` 和描述性文字
**And** 桌面端和移动端均正常显示 (flexbox 垂直居中)
**And** 组件测试覆盖: 默认渲染、各预设场景、操作按钮点击回调

---

### Story 1.5: 工作流步骤导航

As a 用户,
I want 始终看到当前在工作流的哪一步,
So that 我清楚地知道整个流程进度和下一步该做什么。

**Acceptance Criteria:**

**Given** 用户在策略工作流或回测流程中
**When** 工作流步骤导航渲染
**Then** 显示 WorkflowStepper 组件:
- 5 个步骤: ⓪ 起点 → ① 输入 → ② 生成 → ③ 回测 → ④ 验证
- 每步状态: completed (✓ + step-done 绿色) / current (step-active 蓝色高亮) / pending (step-pending 灰色) / error (status-block 红色)
- 步骤间连线，已完成段实线，未完成段虚线
**And** 已完成步骤可点击跳转，pending 步骤不可点击 (cursor-not-allowed)
**And** 桌面端 (≥ 768px) 水平布局，移动端 (< 768px) 纵向布局
**And** 使用 `role="navigation"` + `aria-label="工作流步骤"` + 当前步骤 `aria-current="step"`
**And** 步骤切换使用 normal (300ms) ease-in-out 过渡动画
**And** `prefers-reduced-motion` 下禁用过渡动画
**And** 组件 Props: `steps: Array<{label, status}>`, `currentStep: number`, `onStepClick: (index) => void`
**And** 组件测试覆盖: 各状态渲染、点击跳转回调、aria 属性、响应式布局切换

---

### Story 1.6: 金融数据格式化适配器

As a 用户,
I want 所有金融数字使用一致的格式、颜色和排版,
So that 我能快速识别涨跌方向，信任数据的专业精度。

**Acceptance Criteria:**

**Given** 任何金融数据需要在 UI 中展示
**When** 数据通过 FinancialDisplayData 适配器处理
**Then** 返回统一的展示对象:
```typescript
interface FinancialDisplayData {
  raw: Decimal;
  formatted: string;        // "32.50%" or "¥15.20"
  direction: 'up' | 'down' | 'neutral';
  ariaLabel: string;         // "上涨 32.50%"
  colorToken: string;        // "text-profit" | "text-loss" | "text-muted"
  responsive: {
    full: string;            // "总收益率 +32.50%"
    compact: string;         // "+32.5%"
  };
}
```
**And** 数据精度规则: 价格 2 位小数, 百分比 2 位小数, 比率 (夏普等) 3 位小数
**And** 所有金融数字渲染时强制使用 `font-mono` + `tabular-nums` class
**And** 涨跌方向使用颜色 + ↑↓ 箭头 + +/- 符号三重编码 (色盲友好)
**And** 数据内部计算使用 Decimal.js，禁止 JavaScript 原生浮点数 (ADR-006)
**And** 提供 React hook `useFinancialFormat(value: Decimal, type: 'price' | 'percent' | 'ratio')` 返回 FinancialDisplayData
**And** 提供辅助组件 `<FinancialValue data={fdd} />` 自动应用 class 和 aria-label
**And** 单元测试覆盖: 正值/负值/零值格式化、精度规则、方向判断、aria-label 生成、Decimal.js 精度验证

---

## Epic 2: 可信回测体验 (Trustworthy Backtest Experience)

用户能用真实数据回测策略，通过 S/A/B/C/D 评分一眼判断策略好坏，看到白话策略摘要而非代码，完全信任展示的每个数字的来源。

### Story 2.1: 策略评分算法

As a 用户,
I want 回测结果自动生成一个直觉化的策略评分 (S/A/B/C/D),
So that 我不需要理解 30+ 个指标就能判断策略好坏。

**Acceptance Criteria:**

**Given** 回测引擎返回完整的 30+ 指标结果
**When** ScoreCalculator 处理指标数据
**Then** 返回策略评分对象:
```typescript
interface StrategyScore {
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  score: number;           // 0-100 综合分
  description: string;     // "卓越" / "优秀" / "良好" / "一般" / "需改进"
  coreMetrics: {
    totalReturn: Decimal;  // 总收益率
    maxDrawdown: Decimal;  // 最大回撤
    sharpeRatio: Decimal;  // 夏普比率
  };
  breakdown: {             // 各维度得分
    profitability: number; // 收益性 0-100
    risk: number;          // 风险控制 0-100
    stability: number;     // 稳定性 0-100
    efficiency: number;    // 交易效率 0-100
  };
}
```
**And** 评分规则: S (≥90分, ≤5% 频率), A (≥75), B (≥60), C (≥40), D (<40)
**And** 各维度权重: 收益性 30%, 风险控制 30%, 稳定性 25%, 交易效率 15%
**And** 收益性评分考虑: 总收益率、年化收益率、vs 沪深300 超额收益
**And** 风险控制评分考虑: 最大回撤、回撤恢复天数、VaR
**And** 稳定性评分考虑: 夏普比率、月度胜率、收益波动率
**And** 交易效率评分考虑: 胜率、盈亏比、平均持仓天数
**And** 所有计算使用 Decimal.js (ADR-006)
**And** ScoreCalculator 位于 `src/lib/backtest/score-calculator.ts`
**And** 单元测试: 各等级边界值、全优指标→S级、全差指标→D级、混合指标→中间等级、零交易特殊处理

---

### Story 2.2: 策略评分卡组件

As a 用户,
I want 回测完成后第一眼看到评分卡，显示评级、核心指标和基准对比,
So that 我能立即判断策略是否值得继续优化。

**Acceptance Criteria:**

**Given** 回测完成且 ScoreCalculator 返回评分
**When** 结果页渲染
**Then** 显示 ScoreCard 组件:
- 评分字母 (Display 字号, 评分色编码) + 描述文字 + 星级图标 (S=★★★, A=★★, B=★, C=○, D=✕)
- 分隔线
- 3 核心指标: 总收益率 / 年化收益率 / 最大回撤 (使用 FinancialValue 组件)
- 分隔线
- vs 沪深300 基准对比: 超额收益 + ▲/▼ 方向箭头
- 操作按钮行: [展开详情] [问AI] [导出]
**And** 三重编码确保色盲可区分: 字母 + 描述文字 + 图标
**And** 3 种 Variant:
- `full`: 完整版 (带操作按钮行)
- `compact`: 评分 + 3 核心指标 (无按钮)
- `mini`: 仅评分字母 + 描述 (内联使用)
**And** 4 种状态: default / loading (skeleton shimmer) / error / comparison-mode
**And** Loading 状态: skeleton 矩形 (fast) → 数字滚动入场 (slow) → 评分色渐现 (slow)
**And** `aria-label` 格式: "策略评分 A 优秀，总收益率 上涨 23.5%，最大回撤 下跌 8.3%"
**And** 评分字母附带 `?` 帮助图标，hover 显示评分说明 tooltip
**And** 组件测试: 5 个等级渲染、3 种 variant、loading skeleton、aria-label 正确性

---

### Story 2.3: 策略逻辑摘要组件

As a 用户,
I want 看到 AI 生成策略的白话逻辑摘要而非代码,
So that 我不懂编程也能理解策略的买卖条件和仓位控制。

**Acceptance Criteria:**

**Given** AI 生成策略代码后
**When** 策略编辑页渲染
**Then** 显示 StrategyLogicSummary 组件:
- 标题行: "策略逻辑摘要" + 置信度 Badge (高=绿 / 中=黄 / 低=红)
- 分隔线
- 结构化条件列表:
  - 买入条件: 白话描述 (例: "KDJ 在 20 以下金叉时")
  - 卖出条件: 白话描述
  - 仓位控制: 白话描述
- 分隔线
- 参数摘要: 关键参数名=值 (内联展示)
- 折叠区域: [▼ 查看生成代码] → 展开显示 Python 语法高亮代码
**And** 代码默认折叠，点击展开/收起 (Collapsible)
**And** Props: `conditions: {buy: string, sell: string, position: string}`, `confidence: 'high' | 'medium' | 'low'`, `params: Record<string, string>`, `code: string`
**And** 3 种状态: default / loading (ai-pulse 动画) / error
**And** 条件列表使用 `role="list"`，屏幕阅读器可朗读
**And** 组件测试: 默认渲染、折叠/展开代码、置信度 Badge 颜色、loading 状态

---

### Story 2.4: 数据源标识与模拟数据警告

As a 用户,
I want 清楚知道每个数据的来源是数据库、API 还是模拟生成,
So that 我能判断结果的可信度，不会误信模拟数据。

**Acceptance Criteria:**

**Given** 回测使用任何数据源
**When** 结果页和数据面板渲染
**Then** DataSourceBadge 组件显示数据来源:
- DB: 蓝色 Badge "数据库" + tooltip "真实历史数据，来自本地数据库"
- API: 黄色 Badge "API" + tooltip "实时拉取，可能有延迟"
- 模拟: 灰色 Badge "模拟" + tooltip "模拟生成数据，仅供参考"
**And** Badge 使用对应 `--lucrum-color-source-*` 颜色令牌
**And** Badge 尺寸: Caption (13px) + 内边距 `space-xs` (4px)
**And** 当数据源为"模拟"时，页面顶部固定显示 SimulatedDataBanner:
- 黄色横幅 (`--lucrum-color-banner-warn` 背景)
- 文字: "当前使用模拟数据，结果仅供参考"
- 右侧: [切换真实数据] 链接 (如果 DB 有该股票数据) + [✕] 关闭按钮
**And** Banner 关闭后记住选择 (sessionStorage)，页面刷新后不再显示
**And** Banner 使用 `role="alert"` + `aria-live="polite"`
**And** 组件测试: 3 种数据源 Badge 渲染、Banner 显示/关闭/记忆、tooltip 内容

---

### Story 2.5: 回测前置条件检查面板

As a 用户,
I want 在运行回测前看到所有条件是否满足,
So that 我不会因为遗漏配置而导致回测失败。

**Acceptance Criteria:**

**Given** 用户在策略编辑页准备运行回测
**When** PreCheckPanel 渲染
**Then** 显示前置条件清单:
- ✅/❌ 策略代码有效 (有效的 vnpy CtaTemplate)
- ✅/❌ 已选择回测标的 (至少1只股票)
- ✅/❌ 已设置日期范围 (起止日期均有值)
- ✅/❌ 初始资金已配置 (> 0)
**And** 每项使用三态灯: ● 绿 (就绪) / ● 黄 (警告，可运行但有风险) / ● 红 (阻断)
**And** 全部绿灯时: "运行回测" 按钮高亮可点击 (`btn-primary` + `glow-active`)
**And** 有红灯时: "运行回测" 按钮禁用 (`opacity-50` + `cursor-not-allowed`)，tooltip 显示 "请先完成所有必要配置"
**And** 点击 ❌ 项自动聚焦到对应的编辑区域 (策略输入框/股票选择器/日期选择器/资金输入框)
**And** 条件状态实时更新 (用户修改配置后立即反映)
**And** 使用 `aria-live="polite"` 在条件变化时通知屏幕阅读器
**And** 组件测试: 全通过/部分通过/全失败渲染、点击跳转、按钮联动、实时更新

---

### Story 2.6: 三阶段回测进度

As a 用户,
I want 回测执行时看到分阶段的进度而非单一进度条,
So that 我知道系统在做什么、大概还要等多久。

**Acceptance Criteria:**

**Given** 用户点击"运行回测"
**When** 回测开始执行
**Then** 显示 ThreeStageProgress 组件:
```
① 数据加载    ████████░░ 80%
② 信号计算    ░░░░░░░░░░ 等待中
③ 指标统计    ░░░░░░░░░░ 等待中
```
- 每阶段状态: waiting (灰色) / in-progress (蓝色动画) / completed (绿色 ✓) / error (红色 ✕)
- 当前阶段显示百分比进度
- 已完成阶段显示 ✓
**And** 进度条使用 `--lucrum-color-primary` 填充色，`bg-surface-elevated` 底色
**And** 百分比使用 Data MD (14px, font-mono)
**And** 基于 Radix UI Progress × 3 + 自定义容器
**And** 进度数据通过现有的 backtest progress event streaming 获取
**And** 回测完成时，短暂 (500ms) 显示全部 ✓ 后自动切换到结果展示
**And** 回测失败时，失败阶段显示红色 ✕ + 错误描述
**And** `prefers-reduced-motion` 下进度条无动画，直接更新宽度
**And** 组件测试: 三阶段状态流转、百分比更新、完成/失败状态、动画禁用

---

### Story 2.7: 错误诊断卡

As a 用户,
I want 回测失败时看到结构化的错误信息和修复建议,
So that 我知道出了什么问题、为什么出问题、以及如何修复。

**Acceptance Criteria:**

**Given** 回测执行失败
**When** 错误诊断卡渲染
**Then** 显示 ErrorDiagnosisCard 组件:
- 标题行: ⚠ "回测失败" + 错误代码 [BT3XX]
- 分隔线
- "问题": 一句话描述发生了什么
- "原因": 一句话描述为什么
- 分隔线
- "建议": 可操作的修复建议
- 操作按钮: [应用建议] [换股票] [关闭]
**And** 错误信息三要素: 发生了什么 + 期望是什么 + 调用方能做什么
**And** 错误代码使用 BT 前缀命名空间 (BT1XX 数据错误, BT2XX 策略错误, BT3XX 执行错误)
**And** Props: `error: { code: string, message: string, cause: string, suggestion: string, actions?: Array<{label, onClick}> }`
**And** "应用建议" 按钮可自动修正参数 (如修改日期范围)
**And** 使用 `role="alert"` 确保屏幕阅读器立即播报
**And** 背景使用 `bg-surface-elevated`，左侧 2px `--lucrum-color-status-block` 红色标记
**And** 组件测试: 各错误类型渲染、应用建议回调、aria 属性、按钮交互

---

### Story 2.8: 真实选股与结果页渐进披露

As a 用户,
I want 默认回测使用真实股票数据，并且结果页按层级展示信息,
So that 我的回测结果基于真实市场数据，我能从概要逐步深入到详细指标。

**Acceptance Criteria:**

**Given** 用户进入策略编辑页选择回测标的
**When** 股票选择器渲染
**Then** 默认推荐真实股票 (如贵州茅台 600519)，而非模拟数据
**And** 搜索支持: 股票代码 / 名称 / 拼音首字母 模糊匹配
**And** 显示"最近使用"列表 (最多 5 只，localStorage 持久化)
**And** 数据源自动检测: DB 有数据 → 直接使用; DB 无 → API 拉取; API 失败 → 模拟 (显示 SimulatedDataBanner)

**Given** 回测完成，结果页渲染
**When** 用户查看结果
**Then** 实现三层渐进披露:
- 第 1 层 (立即显示): ScoreCard (评分 + 3 核心指标 + 基准对比)
- 第 2 层 (0.5s 延迟淡入): equity curve 图表
- 第 3 层 (折叠，点击展开): 30+ 完整指标表格 + 交易列表 + 信号明细
**And** 结果页右侧或下方显示 AiInsightCard 占位 (Epic 5 实现内容，此处仅预留位置)
**And** 下一步引导 (3 个选项卡片): "优化参数" / "问问AI顾问" / "验证更多股票"
**And** 回测完成后焦点自动移到 ScoreCard (`focus()`)
**And** 组件测试: 默认选股推荐、搜索匹配、数据源自动检测、渐进披露层级展示、引导卡片渲染

---

## Epic 3: 策略来源与发现 (Strategy Source & Discovery)

用户无需编程知识，即可浏览热门策略、按类型/热度筛选、查看白话摘要和快速预览回测结果、一键导入到工作区或工作流。新用户通过分级示例 30 秒内完成首次回测体验。

### Story 3.1: 内置策略模板库

As a 投资学习者,
I want 从预置的经典策略模板中选择一个开始,
So that 我不需要自己编写策略也能体验完整的回测流程。

**Acceptance Criteria:**

**Given** 用户在策略编辑页点击"浏览模板"或首次进入空编辑器
**When** 模板选择器渲染
**Then** 显示策略模板卡片网格，包含 ≥5 个内置模板:
- 双均线交叉策略 (简单): MA5/MA20 金叉买入、死叉卖出
- KDJ 超买超卖策略 (简单): KDJ<20 买入、KDJ>80 卖出
- MACD 动量策略 (进阶): MACD 金叉 + 量能确认
- 布林带突破策略 (进阶): 突破上轨买入、跌破中轨卖出
- 多因子综合策略 (专业): RSI + MACD + 均线三重确认
**And** 每张卡片显示: 策略名称 + 一句话描述 + 难度标签 (简单/进阶/专业) + ScoreCard(mini) 预设评分范围
**And** 点击模板卡片: 自动填充策略描述 + 代码 + 参数到编辑器
**And** 模板数据存储为 JSON 配置文件 `src/lib/strategy/templates.ts`
**And** 每个模板包含: id, name, description, difficulty, code, defaultParams, conditions (buy/sell/position)
**And** 组件测试: 模板列表渲染、点击填充、难度标签颜色

---

### Story 3.2: 策略发现页面与筛选

As a 用户,
I want 浏览 GitHub 爬取的热门策略并按类型、热度筛选,
So that 我能发现社区验证过的优质策略。

**Acceptance Criteria:**

**Given** 用户进入"发现"页面 (导航栏第四 Tab)
**When** 页面加载
**Then** 显示 Dashboard 卡片网格布局:
- StrategyDiscoveryCard 卡片: 策略名称 + 一句话摘要 + ScoreCard(mini) + 来源(GitHub) + 热度(Stars) + 难度标签
- FilterBar 顶部筛选栏:
  - 类型筛选 (Select): KDJ / MACD / 均线 / 布林 / 综合 / 全部
  - 排序 (Select): 热度 / 最新 / Stars
  - 关键词搜索 (Input): 300ms debounce 模糊匹配
**And** 数据来源: 现有 popular strategies API + trending strategies API (FR-8.5, FR-8.6)
**And** 爬虫数据不可用时显示 EmptyState: "暂时无法获取最新策略" + [显示缓存] + [刷新]
**And** 有缓存时优先显示缓存结果 + 顶部提示 "显示的是 X 天前的数据"
**And** 无缓存且无数据时: 显示内置策略模板作为替代内容
**And** 卡片网格响应式: 桌面 3 列, 平板 2 列, 移动端 1 列
**And** 组件测试: 卡片渲染、筛选功能、搜索 debounce、空状态降级链

---

### Story 3.3: 策略详情面板与快速预览

As a 用户,
I want 点击策略卡片查看详情并快速预览回测效果,
So that 我不用导入就能判断策略是否值得使用。

**Acceptance Criteria:**

**Given** 用户在发现页点击某个策略卡片
**When** 策略详情展开
**Then** 右侧 Side Panel (桌面) 或全屏 Sheet (移动端) 显示 StrategyDetailPanel:
- 策略名称 + 来源链接 (GitHub URL)
- 元信息: Stars / Forks / 更新时间 / 质量分
- 策略逻辑摘要 (StrategyLogicSummary 复用)
- 参数说明: 每个参数名 + 白话含义
- vnpy 代码预览 (语法高亮, 折叠)
**And** 详情页包含 "快速预览回测" 按钮
**When** 用户点击"快速预览回测"
**Then** 使用默认参数 + 默认股票 (600519) 执行简化回测
**And** 显示 QuickPreviewResult: ScoreCard(compact) + 总收益 + 最大回撤
**And** 操作按钮: [导入到编辑器] [导入到工作流] [返回列表]
**And** Side Panel 使用 Radix Dialog, 宽度 40%, ESC 关闭, focus trap
**And** 组件测试: 详情渲染、快速预览触发与结果、导入按钮回调、Panel 开关

---

### Story 3.4: 策略导入与分级入门体验

As a 新用户,
I want 通过分级示例一键体验完整回测流程,
So that 我在 30 秒内就能理解平台能做什么。

**Acceptance Criteria:**

**Given** 新用户首次进入 Dashboard 或策略编辑页
**When** 引导卡片渲染
**Then** 显示分级入门体验选择器 (TieredDemoSelector):
- 简单 (推荐新手): "双均线交叉 + 贵州茅台" → 一键自动填充 + 自动运行回测
- 进阶: "KDJ超买超卖 + 自选股票" → 填充策略 + 让用户选股
- 专业: "多因子综合 + 行业板块" → 填充策略 + 进入多股验证
**And** 简单模式点击后: 自动填充策略 → 自动选股 → 自动运行 → 直接展示 ScoreCard 结果
**And** 入门体验完成时间目标 ≤ 30 秒 (从点击到看到评分)

**Given** 用户从发现页或模板库选择策略并点击"导入"
**When** 导入动作执行
**Then** 支持两条导入路径:
- "导入到编辑器" → 跳转 J1 策略编辑页，代码 + 参数自动填充
- "导入到工作流" → 跳转 J5 工作流 Step 0，策略自动加载到 Step 2
**And** 导入成功显示 Toast(success): "策略已导入"
**And** 导入时自动转换 GitHub 代码为 vnpy CtaTemplate 格式 (复用 FR-8.3 StrategyConverter)
**And** 组件测试: 三级示例渲染与自动流程、导入路径切换、Toast 触发

---

## Epic 4: 批量验证与专业报告 (Batch Validation & Professional Reports)

用户能高效对多只股票并行执行回测验证，获得完整 PDF 汇总报告，并排对比两个策略的历史表现，快速回顾最近 20 次回测记录。

### Story 4.1: 并行回测方案 Spike

As a 开发团队,
I want 调研并确定多股并行回测的最优技术方案,
So that 后续实现有明确的技术路径和性能基准。

**Acceptance Criteria:**

**Given** 当前多股回测使用串行 Promise.all
**When** 执行技术调研
**Then** 输出技术方案文档 `doc/decisions/parallel-backtest.md`，评估至少 2 种方案:
- 方案 A: Web Worker 并行 (浏览器端, 利用多核)
- 方案 B: 后端 NATS 任务队列 (服务端并行, API 轮询结果)
**And** 每种方案评估: 性能 (20 只股票 1 年数据的耗时)、复杂度、资源占用、错误处理
**And** 性能基准测试: 串行 vs 并行的实际对比数据
**And** 明确推荐方案及理由
**And** 确认推荐方案满足 NFR-1.2 (20 只股票 < 30 秒)

---

### Story 4.2: 并行批量回测实现

As a 量化分析师,
I want 对多只股票并行执行回测验证,
So that 验证一个策略的普适性不再需要等待逐只串行完成。

**Acceptance Criteria:**

**Given** 用户在多股验证页选择了策略和 ≥2 只股票
**When** 点击"开始验证"
**Then** 基于 Story 4.1 确定的方案并行执行回测
**And** 显示 BatchProgressBar: "已完成 12/45 只" + 进度条 + 失败计数
**And** 进度实时更新，每完成一只股票刷新一次
**And** Tab 切换或后台时运行状态持久化，返回后可恢复查看
**And** 单只股票失败不阻断整体，失败计数累加
**And** 失败比例 ≤ 50%: 正常展示结果 + 失败项标记
**And** 失败比例 > 50%: 进入异常分析模式，优先展示失败原因分析 (数据不足/停牌/格式异常)
**And** 取消按钮: 用户可中途取消，已完成的结果保留
**And** 性能目标: 20 只股票 1 年数据 < 30 秒 (NFR-1.2)
**And** 测试: 并行执行正确性、失败容错、取消功能、进度持久化

---

### Story 4.3: PDF 报告导出

As a 用户,
I want 将回测结果导出为 PDF 报告,
So that 我能保存或分享给团队和客户。

**Acceptance Criteria:**

**Given** 单股或多股回测结果已生成
**When** 用户点击"导出 PDF"
**Then** 生成包含以下内容的 PDF 报告:
- 封面: 策略名称 + 回测日期范围 + 生成时间
- 评分摘要: ScoreCard 内容 (评分 + 3 核心指标 + 基准对比)
- 权益曲线图表 (静态图片渲染)
- 关键指标表格 (收益率、夏普、回撤、胜率等)
- 交易列表摘要 (前 20 笔)
- 多股排名表 (如果是批量回测)
**And** PDF 使用 @react-pdf/renderer 或 html2canvas + jsPDF 方案
**And** 中文字体正确渲染 (嵌入字体或使用系统字体)
**And** 导出过程显示 loading Toast: "导出中..." → "导出完成"
**And** 文件名格式: `回测报告_{策略名}_{日期}.pdf`
**And** 测试: PDF 生成不报错、中文渲染、多股模式内容完整

---

### Story 4.4: 策略对比视图

As a 量化分析师,
I want 并排对比两个策略的回测表现,
So that 我能直觉地判断哪个策略更优以及各自的优劣势。

**Acceptance Criteria:**

**Given** 用户在结果页点击"策略对比"
**When** 选择另一个策略 (从"我的策略"或"内置策略"列表)
**Then** 进入并排对比视图 (StrategyComparisonView):
- 左右分栏: 策略 A vs 策略 B
- 每侧: ScoreCard(compact) + 核心指标
- 指标对比行: 每个指标显示两侧数值 + 差异
  - 提升项: `text-profit` + ↑ 箭头
  - 下降项: `text-loss` + ↓ 箭头
  - 无变化: `text-muted`
- 权益曲线叠加图表: 两条曲线同一坐标轴
**And** 支持切换对比基准 (沪深300 / 对方策略)
**And** 对比视图桌面端左右分栏，平板/移动端上下堆叠
**And** 组件测试: 双策略数据渲染、指标差异计算、图表叠加、响应式布局

---

### Story 4.5: 回测历史列表

As a 用户,
I want 查看最近的回测记录并快速恢复查看,
So that 我不会丢失之前的回测结果，能回顾和对比历史表现。

**Acceptance Criteria:**

**Given** 用户执行过回测
**When** 打开回测历史面板 (Dashboard 侧边栏或导航入口)
**Then** 显示 BacktestHistoryList:
- 最近 20 次回测记录，按时间倒序
- 每行: 时间 + 策略名称 + 股票代码 + ScoreCard(mini) 评分
- 点击行: 恢复查看该次回测的完整结果 (ScoreCard + 图表 + 指标)
**And** 历史数据存储在 localStorage (最近 20 条)，主动保存的写入 PostgreSQL
**And** 列表支持键盘导航 (↑↓ 切换, Enter 选择)
**And** 超过 20 条时自动淘汰最旧记录
**And** 空列表显示 EmptyState: "还没有回测记录" + [运行第一次回测]
**And** 组件测试: 列表渲染、点击恢复、localStorage 持久化、溢出淘汰、空状态

---

## Epic 5: AI 副驾驶 (AI Co-pilot)

AI 顾问基于回测上下文自动推荐高价值问题，给出结构化建议，用户一键将参数调整建议应用到策略并重跑回测。对话历史持久化可回溯。

### Story 5.1: AI 视觉语言与上下文集成

As a 用户,
I want AI 相关的界面元素有统一的视觉标识，并且从回测结果能无缝进入 AI 对话,
So that 我一眼就能区分"我的数据"和"AI 的建议"，并且不需要离开当前页面。

**Acceptance Criteria:**

**Given** 任何包含 AI 生成内容的界面区域
**When** AI 元素渲染
**Then** 使用统一的 AI 视觉语言:
- 背景: `--lucrum-bg-ai` (rgba(167,139,250,0.10))
- 左侧强标记: `border-left: 2px solid var(--lucrum-color-ai)` (#a78bfa)
- 边框: `--lucrum-border-ai`
- AI 处理中: `ai-pulse` 呼吸灯动画 (1500ms loop)
- 通过 `ai-mark` Tailwind class 一键应用
**And** 回测结果页的"问AI"按钮 (Secondary + 箭头图标) 打开 AI 侧栏:
- Split 模式: 左侧保留回测结果，右侧 AI 对话面板
- 自动携带上下文: 策略代码 + 参数 + 回测结果摘要
**And** 多股验证排名表的行级"问AI"按钮:
- 点击后打开 AI 侧栏，携带该股上下文
- 预填问题: "为什么 {股票名} 的策略表现 {好/差}？"
**And** `prefers-reduced-motion` 下 ai-pulse 静止
**And** 组件测试: ai-mark class 渲染、侧栏开关、上下文传递、行级触发

---

### Story 5.2: 智能推荐问题

As a 用户,
I want AI 顾问根据回测结果自动推荐 3 个高价值问题,
So that 我不需要想"该问什么"，直接点击就能获得有用分析。

**Acceptance Criteria:**

**Given** 用户从回测结果进入 AI 顾问 (有上下文)
**When** AI 面板渲染
**Then** 显示 SmartQuestionChips 组件:
- 3 个推荐问题 chips，基于回测结果自动生成:
  - 问题 1: 关于最突出的指标 (如 "为什么最大回撤发生在 3 月？")
  - 问题 2: 关于参数优化 (如 "如何优化止损参数？")
  - 问题 3: 关于适用性 (如 "这策略适合震荡市吗？")
**And** 推荐逻辑: 分析 ScoreCard breakdown 中最低维度 + 最显著指标 + 市场环境
**And** Chips 使用 Badge variant=outline 样式，可点击
**And** 点击 chip → 自动填入对话输入框并发送
**And** 无上下文时不显示推荐，改为显示引导文字: "输入任何投资相关问题"
**And** 组件测试: chips 渲染、点击发送、无上下文隐藏

---

### Story 5.3: AI 建议一键应用

As a 用户,
I want 将 AI 的参数调整建议一键应用到策略并重跑回测,
So that 我能即时验证 AI 建议的效果，不需要手动修改参数。

**Acceptance Criteria:**

**Given** AI 返回包含可操作参数建议的回复
**When** 回复渲染
**Then** 建议以结构化格式展示 (ApplySuggestionButton):
- 建议内容: "将止损设为 5%"
- 理由: "基于历史回撤分析"
- 预期影响: "预期减少回撤约 30%"
- [一键应用到策略] 按钮 (Primary)
**And** 点击"一键应用"后:
- 参数自动更新到策略编辑器
- 显示 Toast(success): "参数已应用: 止损 → 5%"
- 提示"重跑回测?" 选项
**And** 如果用户选择重跑: 自动触发回测，结果与之前对比
**And** 按钮状态: default → applying (loading) → applied (✓ 绿色, 1s) → 恢复
**And** AI 回复中非参数建议 (纯分析) 不显示应用按钮
**And** 组件测试: 建议渲染、一键应用参数更新、Toast 触发、重跑流程

---

### Story 5.4: 对话历史持久化与 Token 管理

As a 用户,
I want 对话历史被保存，并且知道对话容量还剩多少,
So that 我能回顾之前的分析，不会突然被截断而丢失上下文。

**Acceptance Criteria:**

**Given** 用户与 AI 顾问对话
**When** 对话进行中
**Then** TokenBudgetIndicator 显示在对话面板顶部:
- 进度条: 已用 token / 总预算
- 颜色: 绿色 (<70%) → 黄色 (70-90%) → 红色 (>90%)
- 接近上限时 (>90%): Toast(warning) "上下文即将满，建议开启新对话"
**And** Token 耗尽时回复被截断:
- 显示截断提示 + 已说内容自动摘要
- [开启新对话继续] 按钮
**And** 对话历史持久化到 localStorage:
- 每个对话 session: id + 策略上下文 + 消息列表 + 创建时间
- 最多保存 10 个对话 session
- 对话列表可浏览和恢复
**And** FR-5.6 覆盖: 主动保存的对话可写入 PostgreSQL (通过"保存对话"按钮)
**And** 组件测试: Token 进度条、颜色变化、截断处理、历史持久化与恢复

---

## Epic 6: 工作流效率与版本管理 (Workflow Efficiency & Versioning)

用户通过 Cmd+K 命令面板快速跳转任何功能，参数 tooltip 提供双层解释，策略支持版本管理追溯历史修改。

### Story 6.1: 全局命令面板

As a 高级用户,
I want 通过 Cmd+K 快捷键快速搜索并跳转到任何功能,
So that 我不需要在导航菜单中逐级寻找，提高操作效率。

**Acceptance Criteria:**

**Given** 用户在任何页面
**When** 按下 Cmd/Ctrl + K
**Then** 弹出 GlobalCommandPalette (Dialog + Command 搜索):
- 搜索输入框: 即时模糊匹配
- 结果分类:
  - 导航: "策略编辑" / "多股验证" / "AI 顾问" / "策略发现"
  - 操作: "新建策略" / "运行回测" / "导出报告"
  - 最近: 最近 5 个访问的页面/功能
- 键盘: ↑↓ 选择, Enter 执行, ESC 关闭
**And** 基于 Radix UI Command + Dialog 实现
**And** 搜索支持中文和拼音首字母匹配
**And** 快捷键为 Global scope，任何面板 focus 状态下均生效
**And** 移动端 (< 768px) 不显示命令面板 (无快捷键提示)
**And** 组件测试: 快捷键触发、搜索匹配、分类显示、键盘导航、执行跳转

---

### Story 6.2: 双层参数 Tooltip

As a 用户,
I want 策略参数旁有白话和专业双层解释,
So that 新手看得懂含义，专家看得到技术细节。

**Acceptance Criteria:**

**Given** 用户在参数编辑面板悬停某个参数
**When** Tooltip 触发
**Then** TwoLayerTooltip 显示:
- 白话层 (默认可见): "数值越大，交易信号越少，策略越稳健"
- 专业层 (点击"详细"展开): "平滑系数影响 EMA 周期，增大会降低噪音但延迟增加"
**And** 基于 Radix Tooltip + Popover 组合实现
**And** 白话层使用 Tooltip (hover), 专业层使用 Popover (click 展开)
**And** Props: `layman: string`, `professional: string`, `children: ReactNode`
**And** 触控设备: tap 显示白话层, 长按显示专业层
**And** 组件测试: hover 白话层、click 专业层、触控交互

---

### Story 6.3: 缓存标识与工作流完成报告

As a 用户,
I want 知道结果来自缓存还是实时计算，工作流完成时看到汇总报告,
So that 我信任数据的时效性，并对完成的工作有成就感。

**Acceptance Criteria:**

**Given** 工作流步骤结果来自缓存
**When** 结果展示
**Then** CacheBadge 显示在结果旁:
- Badge: "来自缓存" (灰色) + 缓存时间 "2 小时前"
- [刷新] 按钮: 点击重新执行该步骤
**And** 刷新后 Badge 消失，结果更新

**Given** 用户完成工作流全部 4 个步骤
**When** Step 4 验证完成
**Then** 显示 WorkflowSummaryReport:
- 完成微动画 (confetti 或 checkmark 展开, 500ms)
- 汇总报告卡: 各步骤成果摘要
  - Step 1: 策略描述摘要
  - Step 2: 代码生成置信度
  - Step 3: ScoreCard(compact) 评分
  - Step 4: 多股验证 Top 3
- 操作: [保存到数据库] [导出 PDF] [另存为新工作流] [开始新工作流]
**And** "另存为新工作流" 打开 ForkDialog: 输入名称 → 基于当前参数创建副本
**And** `prefers-reduced-motion` 下跳过完成动画
**And** 组件测试: CacheBadge 显示/刷新、完成报告渲染、ForkDialog 交互

---

### Story 6.4: 策略版本管理

As a 量化分析师,
I want 策略的每次修改自动记录版本历史,
So that 我能追溯参数修改过程，回退到之前的版本。

**Acceptance Criteria:**

**Given** 用户修改策略代码或参数并保存
**When** 保存操作完成
**Then** 自动创建新版本记录:
```typescript
interface StrategyVersion {
  versionId: string;
  strategyId: string;
  code: string;
  params: Record<string, unknown>;
  description: string;      // 自动生成: "修改止损参数 3% → 5%"
  createdAt: Date;
  score?: StrategyScore;     // 该版本的回测评分 (如果有)
}
```
**And** 版本历史面板 (Side Panel): 时间线列表，每个版本显示时间 + 描述 + 评分(mini)
**And** 点击版本: 预览该版本代码和参数 (diff 高亮变更)
**And** "回退到此版本" 按钮: 恢复代码和参数到选定版本
**And** 版本存储: localStorage (最近 20 个版本) + PostgreSQL (主动保存的策略)
**And** 版本描述自动生成: 对比前后参数差异，生成一句话摘要
**And** 数据库 schema: `strategy_versions` 表 (version_id, strategy_id, code, params, description, created_at)
**And** 测试: 版本创建、历史列表、diff 展示、回退功能、自动描述生成

---

## Epic 7: 平台成熟与无障碍 (Platform Maturity & Accessibility)

平台支持实时行情数据自动更新，E2E 测试覆盖关键用户旅程，WCAG 2.1 AA 无障碍合规审计通过。

### Story 7.1: 实时行情数据集成

As a 用户,
I want 平台自动获取最新的股票行情数据,
So that 我的回测使用最新数据，不需要手动更新。

**Acceptance Criteria:**

**Given** 平台需要最新的 K 线数据
**When** 数据更新机制运行
**Then** 实现定时数据更新:
- Cron 任务: 每交易日 18:00 (收盘后) 自动拉取当日 K 线数据
- 数据源: 现有 API provider (已实现 FR-2.1)
- 范围: 自动更新 DB 中已有的所有股票
- 增量更新: 只拉取 DB 中缺失的日期范围
**And** FR-6.4: 实时行情 API 集成 (非 WebSocket, 而是按需拉取):
- 回测时自动检测数据是否最新
- 数据过期 (>1 交易日) 时自动拉取更新
- 拉取状态通过 StatusBar 显示: "正在更新行情..."
**And** FR-6.5: Cron 调度器使用 node-cron 或 K8s CronJob
**And** 更新日志记录到 structured log (JSON): 更新股票数、耗时、失败项
**And** 更新失败时: 优雅降级使用旧数据 + Toast(warning): "部分数据未能更新"
**And** 测试: 增量更新逻辑、过期检测、失败降级

---

### Story 7.2: E2E 测试关键用户旅程

As a 开发团队,
I want 关键用户旅程有自动化 E2E 测试保障,
So that 每次部署前能自动验证核心功能不被破坏。

**Acceptance Criteria:**

**Given** 代码库已有 Playwright 配置
**When** 运行 E2E 测试
**Then** 覆盖以下关键路径:
- J1 核心流程: 输入策略 → 选股 → 运行回测 → 看到 ScoreCard
- J2 多股验证: 选策略 → 选行业 → 批量运行 → 排名表展示
- J3 AI 顾问: 从回测"问AI" → 侧栏打开 → 发送问题 → 收到回复
- J6 策略发现: 进入发现页 → 筛选 → 点击详情 → 导入到编辑器
**And** 测试矩阵:
- Desktop: 1920×1080, 1280×800 (Chrome)
- Tablet: 768×1024 (Chrome)
- Mobile: 390×844 (Chrome)
**And** 每个旅程测试包含: Happy path + 主要错误路径 (网络失败/空数据)
**And** CI 集成: GitHub Actions 中 `bun run test:e2e` 在 PR 合并前运行
**And** 测试文件位于 `lucrum-web/tests/e2e/`
**And** 验收: 4 个旅程 × 4 个 viewport = 16 个测试用例全部通过

---

### Story 7.3: WCAG 2.1 AA 无障碍审计与修复

As a 残障用户,
I want 平台满足 WCAG 2.1 AA 无障碍标准,
So that 我能使用键盘和屏幕阅读器完整操作平台。

**Acceptance Criteria:**

**Given** 所有 Epic 1-6 的功能已实现
**When** 运行无障碍审计
**Then** axe-core 自动化审计:
- 所有页面 (Dashboard, 编辑器, 验证, AI 顾问, 发现) 通过 `wcag2a` + `wcag2aa` 标签检测
- 零 violations (或有文档化的已知例外)
**And** eslint-plugin-jsx-a11y CI 集成: PR 中无新增 a11y warnings
**And** 键盘导航验证:
- Skip Link: 首次 Tab 显示 "跳至主内容"
- 全键盘回测路径: Tab 链路完整 (策略输入→参数→选股→日期→运行)
- Modal focus trap: Dialog 内焦点循环不溢出
- 回测完成后焦点自动移到 ScoreCard
**And** 屏幕阅读器验证 (手动):
- 所有金融数据有 aria-label (如 "上涨 32.5%")
- 评分卡有完整描述
- 进度条有 `aria-valuenow` + `aria-valuetext`
**And** prefers-reduced-motion: 所有动画被禁用，shimmer 替换为静态 "加载中..."
**And** forced-colors: glass-panel 和 btn-primary 有 2px solid 边框 fallback
**And** 测试: axe-core CI 自动化 + Lighthouse a11y 评分 ≥ 90

---

### Story 7.4: 数据层与组件测试覆盖率提升

As a 开发团队,
I want 数据层和组件层的测试覆盖率达到目标,
So that 代码质量有保障，重构时不会引入回归 Bug。

**Acceptance Criteria:**

**Given** 当前覆盖率: data ~30%, components ~25%
**When** 测试补充完成
**Then** 数据层 (lib/db/) 覆盖率 ≥ 60% (NFR-5.2):
- 股票查询函数测试
- K 线数据读写测试
- 策略 CRUD 测试
- 版本管理数据操作测试
- 边界: 空结果、非法输入、并发读写
**And** 组件层 (components/) 覆盖率 ≥ 50% (NFR-5.3):
- 所有 Epic 1-6 新增组件已有测试 (各 Story 中要求)
- 已有组件补充测试: strategy-editor 核心组件、advisor 核心组件
- 快照测试: 关键 UI 状态 (ScoreCard 5 等级, EmptyState 5 场景)
**And** 覆盖率报告通过 vitest --coverage 生成
**And** CI 中覆盖率低于阈值时 PR 构建失败
**And** 验收: `bun run test -- --coverage` 输出 data≥60%, components≥50%
