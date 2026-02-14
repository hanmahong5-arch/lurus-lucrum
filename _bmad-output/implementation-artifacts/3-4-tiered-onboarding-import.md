# Story 3.4: Tiered Onboarding Import & Strategy Import Paths

Status: done

## Story

As a new user,
I want to experience a complete backtest workflow through tiered guided demos,
So that I understand what the platform can do within 30 seconds.

## Acceptance Criteria

### AC-1: TieredDemoSelector Component
**Given** a new user visits the Dashboard (strategy editor page)
**When** no strategy code exists in the workspace (empty state)
**Then** display TieredDemoSelector with three difficulty tiers:
- **Simple (Recommended):** Dual MA Crossover + Kweichow Moutai (600519) -- one-click auto-fill + auto-run backtest
- **Intermediate:** KDJ Overbought/Oversold + User-selected stock -- fill strategy, let user pick stock
- **Advanced:** Multi-Factor Composite + Industry sector -- fill strategy, navigate to multi-stock validation
**And** each tier card shows: icon, difficulty badge (reuse DIFFICULTY_CONFIG), strategy name, description, expected action
**And** Simple tier has prominent primary CTA button, others use outline variant

### AC-2: Simple Tier Auto-Run Flow
**Given** user clicks the Simple tier one-click experience button
**When** the auto-run sequence executes
**Then** the following happens in order:
1. Fill workspace with Dual MA Crossover code (from BUILTIN_TEMPLATES builtin-dual-ma)
2. Fill strategy input with the template prompt
3. Auto-trigger backtest with default stock 600519 + 1-year period
4. Display ScoreCard result when backtest completes
**And** total time from click to seeing ScoreCard result <= 30 seconds
**And** show a progress indicator during the auto-run sequence
**And** if backtest fails, show error diagnosis card (reuse ErrorDiagnosisCard)

### AC-3: Intermediate Tier Flow
**Given** user clicks the Intermediate tier button
**When** the intermediate flow executes
**Then** fill workspace with KDJ strategy code (from BUILTIN_TEMPLATES builtin-kdj)
**And** fill strategy input with the template prompt
**And** scroll to the backtest panel and focus on stock selection
**And** show Toast(info) about selecting a stock to backtest
**And** do NOT auto-trigger backtest (user must select stock first)

### AC-4: Advanced Tier Flow
**Given** user clicks the Advanced tier button
**When** the advanced flow executes
**Then** fill workspace with Multi-Factor code (from BUILTIN_TEMPLATES builtin-multi-factor)
**And** fill strategy input with the template prompt
**And** navigate to /dashboard/strategy-validation for multi-stock validation
**And** show Toast(info) about proceeding to multi-stock validation

### AC-5: Import from Discovery -- Import to Editor
**Given** user clicks Import to Editor from strategy detail panel
**When** import action executes
**Then** fill workspace with the strategy vnpy code (veighnaCode or originalCode)
**And** fill strategy input with strategy description or prompt
**And** show Toast(success) confirming strategy imported
**And** navigate to /dashboard (strategy editor page)

### AC-6: Import from Discovery -- Import to Workflow
**Given** user clicks Import to Workflow from strategy detail panel
**When** import action executes
**Then** fill workspace with the strategy vnpy code
**And** fill strategy input with strategy description
**And** navigate to /dashboard (strategy editor page, workflow Step 2)
**And** show Toast(success) confirming strategy loaded to workflow

### AC-7: Component Tests
Cover: tier card rendering, button callbacks, hidden state, loading, error handling, responsive layout, import flows, toast

## Tasks / Subtasks

- [x] Task 1: Create TieredDemoSelector component (AC: #1)
- [x] Task 2: Create useOnboardingImport hook (AC: #2-#6)
- [x] Task 3: Integrate TieredDemoSelector into Dashboard page (AC: #1, #2)
- [x] Task 4: Wire import actions in DiscoveryPageContent (AC: #5, #6)
- [x] Task 5: Write component tests (AC: #7)

## Dev Notes

### Architecture
Builds on: BUILTIN_TEMPLATES, strategy-workspace-store, backtest-panel, discovery-page-content (TODO stubs), strategy-detail-panel, toast.ts, use-quick-preview, backtest engine

### New Files
1. src/components/onboarding/tiered-demo-selector.tsx
2. src/components/onboarding/index.ts
3. src/hooks/use-onboarding-import.ts
4. src/components/onboarding/__tests__/tiered-demo-selector.test.tsx
5. src/hooks/__tests__/use-onboarding-import.test.ts

### Modified Files
1. src/app/dashboard/page.tsx -- Add TieredDemoSelector in empty state
2. src/components/discovery/discovery-page-content.tsx -- Wire import handlers

### Design System: bg-void, bg-surface, DIFFICULTY_CONFIG badges, btn-tactile, Lucide icons, grid-cols-1 md:grid-cols-3
### Performance: Simple tier click-to-result <= 30s (backtest ~2-3s with mock data)
### Navigation: useRouter from next/navigation, router.push
### Testing: Vitest + RTL, mock workspace store/useRouter/showToast, data-testid selectors

## Dev Agent Record

### Agent Model Used
claude-opus-4-6

### Debug Log References

### Completion Notes List
- TypeScript strict mode: PASS (tsc --noEmit clean)
- New tests: 18 (11 component + 7 hook)
- Existing tests: 59 pass (no regressions)
- Total tests affected: 77 pass across 7 files

### File List
- src/components/onboarding/tiered-demo-selector.tsx (new)
- src/components/onboarding/index.ts (new)
- src/hooks/use-onboarding-import.ts (new)
- src/components/onboarding/__tests__/tiered-demo-selector.test.tsx (new)
- src/hooks/__tests__/use-onboarding-import.test.ts (new)
- src/app/dashboard/page.tsx (modified)
- src/components/discovery/discovery-page-content.tsx (modified)
- src/components/discovery/__tests__/discovery-page-content.test.tsx (modified)