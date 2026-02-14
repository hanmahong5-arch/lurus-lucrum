# Story 4.4: Strategy Comparison View

Status: ready-for-dev

## Story

As a quantitative analyst,
I want to compare two strategies' backtest results side by side,
So that I can intuitively judge which strategy is better and understand their respective strengths and weaknesses.

## Acceptance Criteria

### AC-1: Comparison Data Engine
**Given** two UnifiedBacktestResult objects (Strategy A and Strategy B)
**When** the comparison engine processes them
**Then** it produces a ComparisonResult containing:
- Per-metric difference calculations using Decimal.js (no floating point)
- Direction indicator for each metric (better/worse/neutral)
- Winner determination by category (return, risk, Sharpe, overall)
- Equity curve data arrays for overlay chart
**And** metrics compared include: totalReturn, annualizedReturn, maxDrawdown, sharpeRatio, sortinoRatio, calmarRatio, winRate, profitFactor, totalTrades, avgHoldingDays, maxConsecutiveWins, maxConsecutiveLosses

### AC-2: Side-by-Side Layout
**Given** user enters the strategy comparison view
**When** StrategyComparisonView renders on desktop (>=1024px)
**Then** a left-right split layout displays:
- Left column: Strategy A with ScoreCard(compact) + core metrics
- Right column: Strategy B with ScoreCard(compact) + core metrics
- Center divider with "VS" badge
**And** on tablet/mobile (<1024px), the layout stacks vertically (Strategy A on top, B below)

### AC-3: Metric Comparison Table
**Given** both strategies have been compared
**When** the metric comparison table renders
**Then** each row shows:
- Metric label (Chinese)
- Strategy A value (font-mono, tabular-nums)
- Strategy B value (font-mono, tabular-nums)
- Difference column: absolute diff + percentage
  - Improvement: `text-profit` + up arrow
  - Degradation: `text-loss` + down arrow
  - Neutral (diff < threshold): `text-muted`
**And** rows are grouped into 3 sections: Return metrics, Risk metrics, Trading metrics
**And** the winner in each row has a subtle highlight background

### AC-4: Equity Curve Overlay
**Given** both strategies have equityCurve data
**When** the chart renders
**Then** both equity curves are displayed on the same chart:
- Strategy A: primary color line (#3b82f6)
- Strategy B: secondary color line (#a78bfa)
- X-axis: date, Y-axis: portfolio value (currency formatted)
- Legend with strategy names
- Tooltip showing both values on hover date
**And** if one strategy has a different date range, the chart aligns by overlapping dates
**And** chart renders using lightweight-charts or a div-based solution compatible with SSR

### AC-5: Strategy Selector
**Given** user has one backtest result (Strategy A)
**When** user clicks "Strategy Comparison" button
**Then** a strategy selector dialog/dropdown opens allowing user to:
- Select from "builtin strategies" (grouped)
- Select from "my strategies" (user custom, grouped)
- Each option shows: strategy name + ScoreCard(mini) if available
**And** after selection, Strategy B backtest runs (or loads from cache/history)

### AC-6: Winner Summary Banner
**Given** the comparison is complete
**When** the winner summary renders
**Then** a banner at the top shows:
- Overall winner strategy name (highlighted)
- Key advantage: e.g., "Strategy A wins: higher return (+12.3%) with lower risk"
- Category winners: Return winner | Risk winner | Efficiency winner
**And** the banner uses `bg-surface-elevated` with the winner's score grade border color

### AC-7: Responsive & Accessibility
**Given** the comparison view renders
**Then**:
- Desktop (>=1024px): side-by-side split
- Tablet (768-1023px): vertical stack with compact cards
- Mobile (<768px): vertical stack, simplified metrics (top 6 only)
**And** `role="region"` + `aria-label="策略对比"` on the comparison container
**And** metric table uses `role="table"` with proper row/cell roles
**And** `prefers-reduced-motion` disables chart animations
**And** all financial values use `font-mono` + `tabular-nums`

### AC-8: Test Coverage
**Given** the strategy comparison implementation
**Then** tests cover:
- Comparison engine: metric diff calculation, winner determination, edge cases (zero trades, identical strategies, missing metrics)
- Component rendering: both strategies display, metric table rows, responsive layout
- Strategy selector: option rendering, selection callback
- Accessibility: aria attributes present, keyboard navigation

## Tasks / Subtasks

- [ ] Task 1: Create comparison engine (AC: #1)
  - [ ] 1.1: Create src/lib/comparison/types.ts with ComparisonResult, MetricDiff, ComparisonConfig interfaces
  - [ ] 1.2: Create src/lib/comparison/comparison-engine.ts with compareStrategies() function
  - [ ] 1.3: Create src/lib/comparison/metric-diff.ts with per-metric difference calculation using Decimal.js
  - [ ] 1.4: Create src/lib/comparison/winner-resolver.ts with category and overall winner logic
  - [ ] 1.5: Create src/lib/comparison/index.ts barrel export
  - [ ] 1.6: Write unit tests for comparison engine (comparison-engine.test.ts)

- [ ] Task 2: Create metric comparison table component (AC: #3)
  - [ ] 2.1: Create src/components/backtest/comparison/metric-comparison-table.tsx
  - [ ] 2.2: Implement grouped rows (return/risk/trading) with metric labels
  - [ ] 2.3: Implement diff column with direction indicators (arrows + colors)
  - [ ] 2.4: Implement winner highlight per row

- [ ] Task 3: Create winner summary banner (AC: #6)
  - [ ] 3.1: Create src/components/backtest/comparison/winner-summary.tsx
  - [ ] 3.2: Display overall winner, key advantage, category breakdown

- [ ] Task 4: Create StrategyComparisonView main component (AC: #2, #7)
  - [ ] 4.1: Create src/components/backtest/comparison/strategy-comparison-view.tsx
  - [ ] 4.2: Implement side-by-side layout with responsive breakpoints
  - [ ] 4.3: Integrate ScoreCard(compact) for each strategy
  - [ ] 4.4: Integrate MetricComparisonTable
  - [ ] 4.5: Integrate WinnerSummary banner
  - [ ] 4.6: Add ARIA attributes and keyboard accessibility

- [ ] Task 5: Write component tests (AC: #8)
  - [ ] 5.1: Create src/components/backtest/comparison/__tests__/strategy-comparison-view.test.tsx
  - [ ] 5.2: Test dual strategy rendering, metric table, responsive layout, accessibility

- [ ] Task 6: Run verification (typecheck + test)
  - [ ] 6.1: Run bun run typecheck — 0 errors
  - [ ] 6.2: Run bun run test — all tests pass

## Dev Notes

### Existing Types to Leverage
- `UnifiedBacktestResult` in `src/lib/backtest/types.ts` — main backtest result interface
- `StrategyScore` in `src/lib/backtest/score/types.ts` — grade/score data
- `ComparisonItem`, `MetricComparison`, `ComparisonReport` in `src/lib/backtest/types.ts` — already defined comparison types
- `ReturnMetrics`, `RiskMetrics`, `TradingMetrics` in `src/lib/backtest/types.ts` — metric categories
- `calculateScore()` from `src/lib/backtest/score` — to compute scores for comparison

### Existing Components to Reuse
- `ScoreCard` (compact variant) from `src/components/backtest/score-card.tsx`
- `SimpleFinancialValue` from `src/components/financial/financial-value.tsx`
- `Card`, `CardContent`, `CardHeader` from `src/components/ui/card`
- `Badge` from `src/components/ui/badge`
- `Button` from `src/components/ui/button`

### Design System Compliance
- Dark mode only: `bg-void` base, `bg-surface` cards, `bg-surface-elevated` banner
- Financial data: `font-mono` + `tabular-nums` for all numbers
- Profit/loss: `text-profit` (green) / `text-loss` (red) / `text-muted` (neutral)
- Score grade colors: `text-score-s/a/b/c/d` and `bg-score-s/a/b/c/d`
- Buttons: `btn-tactile` on interactive elements

### Strategy Selector (AC-5) — Deferred
The strategy selector (AC-5) requires integration with the strategy list API and backtest execution flow.
This task is deferred to a follow-up integration story. The comparison view component will accept two results as props.

### Equity Curve Overlay (AC-4) — Simplified
The equity curve overlay requires lightweight-charts setup which is complex.
For this story, we provide the data structure and a placeholder chart area.
Full chart integration will be done when the comparison view is wired into the result dashboard.

### Key Architecture Decisions
- Comparison engine is a pure library function (no React, no side effects) in src/lib/comparison/
- All metric diffs use Decimal.js for precision
- ComparisonResult is serializable (no Decimal objects in output — convert to numbers for display)
- Component accepts pre-computed ComparisonResult as prop (not raw results)

### References
- [Source: src/lib/backtest/types.ts] — UnifiedBacktestResult, ComparisonItem, MetricComparison
- [Source: src/lib/backtest/score/types.ts] — StrategyScore, ScoreGrade
- [Source: src/components/backtest/score-card.tsx] — ScoreCard component
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4] — original requirements
- [Source: _bmad-output/planning-artifacts/prd.md#FR-3.7] — Strategy comparison view FR
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — StrategyComparisonView = ScoreCard x2 split
