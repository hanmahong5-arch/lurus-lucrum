# Story 3.3: Strategy Detail Panel & Quick Preview

Status: done

## Story

As a user,
I want to click a strategy card to view details and quickly preview backtest results,
So that I can judge whether a strategy is worth using without importing it.

## Acceptance Criteria

### AC-1: Strategy Detail Side Panel
**Given** user clicks a strategy card on the discovery page
**When** strategy detail expands
**Then** right Side Panel (desktop) or full-screen Sheet (mobile) shows StrategyDetailPanel:
- Strategy name + source link (GitHub URL)
- Meta info: Stars / Forks / Updated time / Quality score
- Strategy logic summary (reuse StrategyLogicSummary)
- Parameter descriptions: each param name + plain-language meaning
- vnpy code preview (syntax highlighted, collapsible)
**And** Side Panel uses Radix Dialog, width 40%, ESC close, focus trap

### AC-2: Quick Preview Backtest
**Given** detail panel is open
**When** user clicks "Quick Preview Backtest" button
**Then** execute simplified backtest with default params + default stock (600519)
**And** show QuickPreviewResult: ScoreCard(compact) + total return + max drawdown
**And** show loading state during preview execution

### AC-3: Action Buttons
**Given** quick preview completed or detail panel is open
**Then** action buttons: [Import to Editor] [Import to Workflow] [Back to List]
**And** buttons follow three-tier hierarchy: Primary (Import to Editor) / Secondary (Import to Workflow) / Ghost (Back)

### AC-4: Responsive Behavior
**Given** different screen sizes
**When** desktop (>=1280px) -> right Side Panel 40% width slide-in
**When** mobile (<768px) -> full-screen Sheet from bottom

### AC-5: Strategy Detail Data Fetching
**Given** card click passes strategy ID
**When** Panel opens
**Then** fetch detail from /api/strategies/popular (including veighnaCode, originalCode, indicators)
**And** for builtin source, get full data from BUILTIN_TEMPLATES

### AC-6: Component Tests
**Given** StrategyDetailPanel, QuickPreviewResult components
**When** running tests
**Then** cover: detail rendering, quick preview trigger & result, import button callbacks, panel open/close, loading state, error state, responsive

## Technical Design

### Architecture

Story 3.3 builds on existing infrastructure:
- src/components/discovery/ -- Story 3.2 components
- src/hooks/use-discovery-strategies.ts -- DiscoveryStrategy type
- src/components/backtest/score-card.tsx -- ScoreCard compact variant
- src/components/strategy-editor/strategy-logic-summary.tsx -- Logic summary
- src/components/strategy-editor/code-preview.tsx -- Code preview
- src/lib/backtest/engine.ts -- Backtest engine for quick preview
- src/lib/backtest/score/ -- Score calculator
- src/lib/strategy-templates/builtin-templates.ts -- Builtin template data
- src/components/ui/dialog.tsx -- Radix Dialog primitive

### New Files
1. src/components/discovery/strategy-detail-panel.tsx -- Side panel with Radix Dialog
2. src/components/discovery/quick-preview-result.tsx -- Quick preview result display
3. src/hooks/use-strategy-detail.ts -- Fetch single strategy detail
4. src/hooks/use-quick-preview.ts -- Run quick preview backtest
5. src/components/discovery/__tests__/strategy-detail-panel.test.tsx -- Panel tests
6. src/components/discovery/__tests__/quick-preview-result.test.tsx -- Preview tests

### Modified Files
1. src/components/discovery/discovery-page-content.tsx -- Add panel state, open on card click
2. src/components/discovery/index.ts -- Export new components

### Key Interfaces

StrategyDetail: extends DiscoveryStrategy with originalCode, veighnaCode, conversionStatus, annualReturn, maxDrawdown, sharpeRatio, tags, markets fields.

StrategyDetailPanelProps: strategy, open, onOpenChange, onImportToEditor, onImportToWorkflow.

QuickPreviewData: score (StrategyScore | null), totalReturn (string), maxDrawdown (string), tradeCount (number).

QuickPreviewResultProps: data, state (idle|loading|success|error), errorMessage, onRetry.

### Quick Preview Implementation
1. Use veighnaCode (or originalCode fallback) from strategy detail
2. Default stock: 600519, default period: 1 year
3. Run backtest via engine, calculate score
4. Display ScoreCard(compact) + summary metrics

### Side Panel Implementation
- Radix Dialog with right-aligned positioning (fixed right-0 top-0 h-full w-[40%])
- Slide-in animation from right
- Focus trap via Radix Dialog built-in
- ESC to close via Radix Dialog built-in
- Mobile: full-width bottom sheet via responsive classes

## Test Plan

### StrategyDetailPanel (18 tests)
1. Renders strategy name, description, author when open
2. Shows source badge with GitHub icon + URL link
3. Displays popularity metrics (stars, views, score)
4. Renders strategy type badge
5. Shows indicators list
6. Displays parameter descriptions
7. Renders code preview (collapsible)
8. Renders StrategyLogicSummary when conditions available
9. Quick preview button triggers backtest
10. Shows loading state during preview
11. Shows QuickPreviewResult on success
12. Shows error state on preview failure
13. Import to editor button calls callback
14. Import to workflow button calls callback
15. Panel closes on ESC
16. Panel closes on onOpenChange(false)
17. Handles null/missing fields gracefully
18. Handles builtin strategy (negative ID)

### QuickPreviewResult (7 tests)
19. Renders ScoreCard compact with score data
20. Displays total return and max drawdown
21. Shows trade count
22. Renders loading skeleton
23. Shows error with retry button
24. Retry button calls onRetry
25. Handles null data gracefully

## Definition of Done

- [x] StrategyDetailPanel with Radix Dialog
- [x] QuickPreviewResult component
- [x] useStrategyDetail hook
- [x] useQuickPreview hook
- [x] DiscoveryPageContent integrated with panel
- [x] Side Panel: 40% desktop, full-screen mobile
- [x] Quick preview: stock 600519 + default params
- [x] Action buttons with three-tier hierarchy
- [x] Unit tests passing (26 new tests, 59 total)
- [x] TypeScript strict mode passes
- [x] Design tokens (no hardcoded colors)
- [x] Accessible (ARIA, keyboard nav, focus trap)
- [x] Zero hardcoded magic values
