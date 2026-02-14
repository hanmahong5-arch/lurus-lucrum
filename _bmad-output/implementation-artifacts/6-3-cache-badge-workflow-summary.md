# Story 6-3: Cache Badge & Workflow Summary Report
# 缓存标识与工作流完成报告

## Story

As a user,
I want to know whether results come from cache or live computation, and see a summary report when the workflow completes,
So that I trust the data's freshness and feel a sense of achievement for completed work.

## Status

| Field | Value |
|-------|-------|
| Epic | 6 - Workflow Efficiency & Versioning |
| Priority | P1 |
| FRs | FR-7.2 (deterministic caching), FR-7.4 (TTL-based expiration) |
| NFRs | NFR-1.6 (cache hit <50ms), NFR-2.5 (workflow recovery) |
| Dependencies | Workflow system (lib/workflow/), workflow-store.ts |

## Acceptance Criteria

### AC-1: CacheBadge Component - Display
- **Given** a workflow step result comes from cache
- **When** the result is displayed
- **Then** a CacheBadge appears next to the result showing:
  - Badge text: "来自缓存" (grey)
  - Relative time: e.g. "2 小时前"
  - A [Refresh] button to re-execute the step
- **And** the badge has `aria-label` for accessibility

### AC-2: CacheBadge Component - Refresh Action
- **Given** the CacheBadge is visible with a [Refresh] button
- **When** user clicks [Refresh]
- **Then** the step re-executes with `skipCache=true`
- **And** the CacheBadge disappears after fresh result loads
- **And** a loading spinner shows during re-execution

### AC-3: CacheBadge Component - Edge Cases
- **Given** CacheBadge receives `cachedAt` timestamp
- **When** timestamp is null, undefined, or invalid
- **Then** badge shows "缓存时间未知" instead of crashing
- **And** the refresh button still works

### AC-4: WorkflowSummaryReport - Display on Completion
- **Given** user completes all 4 workflow steps
- **When** Step 4 validation finishes
- **Then** WorkflowSummaryReport displays:
  - Completion animation (checkmark expand, 500ms)
  - Summary card with each step's outcome:
    - Step 1: Strategy description summary
    - Step 2: Code generation confidence
    - Step 3: ScoreCard (compact) rating
    - Step 4: Multi-stock validation Top 3
  - Action buttons: [Save to DB] [Export PDF] [Fork as New Workflow] [Start New Workflow]

### AC-5: WorkflowSummaryReport - Reduced Motion
- **Given** user has `prefers-reduced-motion` enabled
- **When** workflow completes
- **Then** completion animation is skipped
- **And** the summary report appears instantly

### AC-6: WorkflowSummaryReport - Fork Dialog
- **Given** user clicks [Fork as New Workflow]
- **When** ForkDialog opens
- **Then** user enters a new workflow name
- **And** clicking confirm creates a copy based on current parameters
- **And** the dialog has cancel/confirm buttons with keyboard support

### AC-7: WorkflowSummaryReport - Edge Cases
- **Given** some steps have no output data (failed or skipped)
- **When** summary report renders
- **Then** failed steps show error message instead of result summary
- **And** skipped steps show "Skipped" indicator
- **And** the report still renders without crashing

### AC-8: Component Tests
- CacheBadge: displays "来自缓存" text and relative time
- CacheBadge: refresh button calls onRefresh callback
- CacheBadge: handles null/invalid cachedAt gracefully
- CacheBadge: hides when `cached` is false
- WorkflowSummaryReport: renders step summaries for completed workflow
- WorkflowSummaryReport: shows completion animation (respects reduced motion)
- WorkflowSummaryReport: renders action buttons
- WorkflowSummaryReport: ForkDialog opens/closes correctly
- WorkflowSummaryReport: handles missing step data gracefully

## Technical Notes

### New Files
1. `src/components/strategy-editor/cache-badge.tsx` - CacheBadge component
2. `src/components/strategy-editor/workflow-summary-report.tsx` - WorkflowSummaryReport component
3. `src/components/strategy-editor/__tests__/cache-badge.test.tsx` - CacheBadge tests
4. `src/components/strategy-editor/__tests__/workflow-summary-report.test.tsx` - WorkflowSummaryReport tests

### Modified Files
1. `src/lib/stores/workflow-store.ts` - Add `cachedAt` timestamp tracking per step

### Architecture Decisions
- Components placed in `strategy-editor/` as they are workflow-specific (not generic UI primitives)
- CacheBadge is a presentational component: receives `cached`, `cachedAt`, `onRefresh` props
- WorkflowSummaryReport receives `session` (WorkflowSession) and step data to render summaries
- ForkDialog uses Radix Dialog primitive from `ui/`
- Relative time formatting uses `Intl.RelativeTimeFormat` (no external dependency)
- Design system: `bg-surface`, `text-white/60` for cache badge; `bg-surface-elevated` for summary card
- Animation: CSS `@keyframes` for checkmark expand; respects `prefers-reduced-motion: reduce`
- ARIA: badge has `role="status"`, dialog has `role="dialog"` with `aria-label`
