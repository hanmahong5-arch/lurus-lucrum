# Story 4-5: Backtest History List

## Story

As a user,
I want to view my recent backtest records and quickly restore viewing,
So that I don't lose previous backtest results and can review and compare historical performance.

## Status

Done

## Context

- Epic: 4 - Batch Validation & Professional Reports
- Priority: P1
- Depends on: ScoreCard (2-2), EmptyState (1-4)
- FRs: FR-3.7 (partial - history view supports comparison entry point)

## Acceptance Criteria

### AC-1: History List Display
- **Given** the user has executed backtests
- **When** they open the backtest history panel (Dashboard sidebar or navigation entry)
- **Then** display BacktestHistoryList:
  - Most recent 20 backtest records, sorted by time descending
  - Each row: timestamp + strategy name + stock symbol + ScoreCard(mini) grade
  - Click row: restore viewing the full backtest result (ScoreCard + charts + metrics)

### AC-2: Storage Strategy
- **Given** history data is managed
- **Then** history data is stored in localStorage (most recent 20 items)
- **And** actively saved records write to PostgreSQL (future, not this story)

### AC-3: Keyboard Navigation
- **Given** the history list is focused
- **When** user presses arrow keys
- **Then** up/down arrows switch selection, Enter selects

### AC-4: Overflow Eviction
- **Given** there are 20+ records in history
- **When** a new record is added
- **Then** the oldest record is automatically evicted

### AC-5: Empty State
- **Given** there are no backtest records
- **When** the list renders
- **Then** show EmptyState: "还没有回测记录" + [运行第一次回测]

## Technical Design

### New Files
- `src/lib/stores/backtest-history-store.ts` - Zustand store with localStorage persistence
- `src/components/backtest/backtest-history-list.tsx` - UI component
- `src/components/backtest/__tests__/backtest-history-list.test.tsx` - Tests

### Data Model (localStorage)
```typescript
interface BacktestHistoryEntry {
  id: string;                    // Unique ID (uuid or timestamp-based)
  timestamp: number;             // Unix timestamp ms
  strategyName: string;          // Strategy name
  symbol: string;                // Stock symbol code
  symbolName: string;            // Stock display name
  totalReturn: string;           // Decimal string
  annualizedReturn: string;      // Decimal string
  maxDrawdown: string;           // Decimal string
  sharpeRatio: string;           // Decimal string
  grade: ScoreGrade;             // S/A/B/C/D
  score: number;                 // 0-100
  tradeCount: number;            // Total trades
  config: BacktestConfig;        // Backtest config snapshot
}
```

### Store Actions
- `addEntry(entry)` - Add new backtest result, evict oldest if > 20
- `removeEntry(id)` - Remove specific entry
- `clearHistory()` - Clear all entries
- `getEntries()` - Get all entries sorted by timestamp desc
- `selectEntry(id)` - Mark entry as selected (for restore)

### Component Structure
```
BacktestHistoryList
├── Header (title + count badge)
├── List (scrollable, keyboard navigable)
│   └── BacktestHistoryRow (repeating)
│       ├── Timestamp
│       ├── Strategy Name + Symbol
│       └── ScoreCard(mini)
└── EmptyState (when no records)
```

## Testing Requirements
- List rendering with multiple entries
- Click to restore (onSelect callback)
- localStorage persistence (mock)
- Overflow eviction (21st entry removes 1st)
- Empty state display
- Keyboard navigation (arrow keys + Enter)
- Score grade display per entry

## Definition of Done
- [x] Tests written (RED) - 30 tests across 2 test files
- [x] Implementation complete (GREEN) - Store + Component
- [x] All tests pass - `npx vitest run` -> 1937 passed (64 files)
- [x] TypeScript typecheck passes - `bun run typecheck` -> clean
- [x] No `any` types - verified
- [x] Financial data uses Decimal.js strings - totalReturn/annualizedReturn/maxDrawdown/sharpeRatio as strings, rendered via Decimal
- [x] Dark mode compliant (bg-void, bg-surface) - uses design system tokens
- [x] font-mono + tabular-nums for numbers - symbol, trade count, return, count badge
- [x] ARIA accessibility labels - role="listbox", role="row", aria-selected, aria-label
- [x] English code comments - all JSDoc and inline comments in English
