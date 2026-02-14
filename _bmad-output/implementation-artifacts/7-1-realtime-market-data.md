# Story 7-1: Realtime Market Data Integration

## Story

As a user,
I want the platform to automatically fetch the latest stock market data,
So that my backtests use up-to-date data without manual updates.

## Status: done

## Context

- Epic: 7 - Platform Maturity & Accessibility
- FRs covered: FR-6.4 (Real-time market data integration), FR-6.5 (Scheduled data update automation)
- NFRs: NFR-1.7 (Market data API cached < 200ms), NFR-2.1 (99.5% uptime)
- Existing code: `src/lib/cron/daily-updater.ts` (basic cron), `src/lib/data-service/` (data sources), `src/lib/backtest/db-kline-provider.ts` (DB data access)

## Acceptance Criteria

### AC-1: Incremental Data Update Service
- Given the platform has stocks in the database
- When the incremental updater runs
- Then it detects which stocks have stale data (latest DB date < last trading day)
- And fetches only the missing date range from API (incremental, not full re-fetch)
- And persists new data to `kline_daily` table via upsert
- And logs structured JSON: `{ stocksChecked, stocksUpdated, recordsInserted, failedSymbols, durationMs }`

### AC-2: Staleness Detection
- Given a backtest is about to run for a stock
- When the system checks data freshness
- Then it compares the latest DB date against the last completed trading day
- And returns a `DataFreshness` result: `{ isFresh, latestDbDate, lastTradingDay, staleDays }`
- And if stale (>1 trading day), triggers an on-demand incremental update for that symbol

### AC-3: Cron Scheduler Enhancement
- Given the server is running in production
- When trading day ends (18:00 CST, after settlement)
- Then the enhanced cron job runs incremental update for ALL active stocks
- And uses batch processing with concurrency control (50 concurrent)
- And implements rate limiting (1s delay between batches)
- And the schedule uses `node-cron` with Asia/Shanghai timezone

### AC-4: Data Update API Enhancement
- Given `POST /api/data/update` endpoint
- When called with `{ updateType: 'incremental' }`
- Then runs incremental update (only missing dates)
- And when called with `{ updateType: 'daily', date: 'YYYY-MM-DD' }`
- Then fetches specific date for all active stocks
- And returns progress via structured response

### AC-5: Data Freshness Hook
- Given the frontend needs to display data freshness status
- When `useDataFreshness(symbol)` hook is called
- Then it returns `{ isFresh, staleDays, lastUpdate, isUpdating }`
- And if `isUpdating` is true, shows status in StatusBar: "Updating market data..."
- And on update failure, shows Toast(warning): "Some data could not be updated"

### AC-6: Graceful Degradation
- Given an update fails for some stocks
- When the system encounters API errors
- Then it continues processing remaining stocks (no abort on single failure)
- And uses existing stale data for failed stocks (no data loss)
- And reports partial success with list of failed symbols
- And structured error logging with actionable messages

### AC-7: Test Coverage
- Unit tests for: incremental update logic, staleness detection, trading day calculation
- Integration-style tests for: batch update orchestration, error handling, retry logic
- All tests pass with `npx vitest run`

## Technical Design

### New Files
1. `src/lib/cron/incremental-updater.ts` - Core incremental update logic
2. `src/lib/cron/data-freshness.ts` - Staleness detection utilities
3. `src/lib/cron/__tests__/incremental-updater.test.ts` - Unit tests
4. `src/lib/cron/__tests__/data-freshness.test.ts` - Staleness tests
5. `src/hooks/use-data-freshness.ts` - React hook for data freshness

### Modified Files
1. `src/lib/cron/daily-updater.ts` - Integrate incremental update
2. `src/app/api/data/update/route.ts` - Add incremental update type
3. `src/app/api/cron/init/route.ts` - Initialize enhanced scheduler

### Key Types
```typescript
interface DataFreshness {
  isFresh: boolean;
  latestDbDate: string | null;
  lastTradingDay: string;
  staleDays: number;
}

interface IncrementalUpdateResult {
  success: boolean;
  stocksChecked: number;
  stocksUpdated: number;
  recordsInserted: number;
  recordsFailed: number;
  failedSymbols: string[];
  durationMs: number;
}
```

## Definition of Done
- [ ] All AC tests pass
- [ ] `npx vitest run` passes
- [ ] `bun run typecheck` passes
- [ ] No hardcoded values (dates, URLs, timeouts extracted to constants)
- [ ] Structured logging (JSON format)
- [ ] Graceful degradation on API failures
- [ ] Code reviewed
