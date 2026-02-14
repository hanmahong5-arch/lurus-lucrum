# Story 4.2: Parallel Batch Backtest Implementation

Status: done

## Story

As a quantitative analyst,
I want to run backtests on multiple stocks in parallel with real-time progress feedback,
So that validating a strategy across 20+ stocks completes in under 30 seconds instead of running sequentially.

## Acceptance Criteria

### AC-1: Parallel Execution via Chunked Executor
**Given** user selects a strategy and >= 2 stocks on the strategy-validation page
**When** they click Start Validation
**Then** backtests execute using executeInChunks from src/lib/backtest/parallel/chunked-executor.ts
**And** default concurrency is 8 (configurable)
**And** results are identical to sequential execution for the same inputs

### AC-2: BatchProgressBar Component
**Given** parallel backtest is running
**When** each stock completes
**Then** display a BatchProgressBar showing:
- Text: Completed 12/45 stocks
- Visual progress bar with percentage
- Failed count badge (if > 0): 3 failed
- Elapsed time display
- Estimated remaining time (based on average per-stock time)
**And** progress updates after every single stock completion (not per-chunk)

### AC-3: Cancellation Support
**Given** parallel backtest is in progress
**When** user clicks Cancel button
**Then** in-flight chunk completes, remaining stocks are skipped
**And** already-completed results are preserved and displayed
**And** UI shows Cancelled - showing partial results (12/45) state

### AC-4: Error Isolation and Failure Modes
**Given** some stocks fail during parallel backtest (data missing, timeout, computation error)
**When** failure ratio <= 50%
**Then** show results normally with failed items marked (red badge on stock ranking row)
**And** summary excludes failed stocks from aggregate metrics
**When** failure ratio > 50%
**Then** enter anomaly analysis mode: show failure reason breakdown above results
**And** still show whatever successful results exist

### AC-5: SSE Progress Stream (API Route)
**Given** the /api/backtest/multi-stocks route handles the batch request
**When** backtest runs with parallel execution
**Then** the API route uses Server-Sent Events (SSE) to stream progress
**And** each SSE event contains: completed, total, failed, currentItem, elapsedMs
**And** final SSE event contains complete results payload
**And** client reconnection is handled gracefully

### AC-6: Performance Target
**Given** 20 stocks with 1 year of daily data each (252 trading days)
**When** parallel batch backtest executes
**Then** total execution time < 30 seconds (NFR-1.2)
**And** performance is tested via benchmark test (manual run)

### AC-7: State Persistence Across Tab Switches
**Given** a batch backtest is running
**When** user switches browser tabs or minimizes window
**Then** backtest continues running (server-side execution)
**And** on tab return, progress is restored from SSE reconnection or polling

### AC-8: Test Coverage
**Given** the parallel batch backtest implementation
**Then** tests cover:
- Integration: executeInChunks wired to scanStockSignalsEnhanced produces correct results
- BatchProgressBar: renders progress, failures, cancel button, completion states
- Error modes: failure ratio threshold logic, anomaly analysis display
- Cancellation: abort signal propagation, partial result display

## Tasks / Subtasks

- [x] Task 1: Create batch backtest service layer (AC: #1, #4)
  - [x] 1.1: Create src/lib/backtest/parallel/batch-backtest-service.ts
  - [x] 1.2: Implement aggregate summary calculation (exclude failed stocks)
  - [x] 1.3: Implement failure ratio detection and anomaly mode classification
  - [x] 1.4: Write unit tests

- [x] Task 2: Create SSE API route (AC: #5)
  - [x] 2.1: Create src/app/api/backtest/multi-stocks/stream/route.ts with SSE
  - [x] 2.2: Wire chunked executor progress callback to SSE events
  - [x] 2.3: Send final complete results as last SSE event
  - [x] 2.4: Handle client disconnect (abort signal)

- [x] Task 3: Create BatchProgressBar component (AC: #2, #3)
  - [x] 3.1: Create src/components/strategy-validation/batch-progress-bar.tsx
  - [x] 3.2: Implement progress text, bar, failure badge, elapsed/remaining time
  - [x] 3.3: Implement cancel button with abort callback
  - [x] 3.4: Implement completion/cancelled/anomaly states
  - [x] 3.5: Write component tests

- [x] Task 4: Create useBatchBacktest hook (AC: #1, #3, #5, #7)
  - [x] 4.1: Create src/hooks/use-batch-backtest.ts
  - [x] 4.2: Implement SSE EventSource with reconnection logic
  - [x] 4.3: Implement tab visibility change handling
  - [x] 4.4: Write hook tests

- [x] Task 5: Create FailureAnalysisPanel component (AC: #4)
  - [x] 5.1: Create src/components/strategy-validation/failure-analysis-panel.tsx
  - [x] 5.2: Classify failures by reason
  - [x] 5.3: Display failure breakdown with counts
  - [x] 5.4: Write component tests

- [x] Task 6: Integrate into strategy-validation page (AC: #1-#7)
  - [x] 6.1: Replace handleValidate with useBatchBacktest
  - [x] 6.2: Add BatchProgressBar between ConfigPanel and results
  - [x] 6.3: Add FailureAnalysisPanel when anomaly mode triggered
  - [x] 6.4: Ensure existing components work with parallel results
  - [x] 6.5: Refactor existing multi-stocks route to use executeInChunks

- [x] Task 7: Performance benchmark (AC: #6)
  - [x] 7.1: Update parallel-benchmark.test.ts
  - [x] 7.2: Benchmark 20 stocks x 252 days with concurrency 4, 8, 12

## Dev Notes

### Architecture Overview

Story 4-1 spike recommended Server-side Chunked Concurrency. PoC at src/lib/backtest/parallel/chunked-executor.ts.

This story: wrap executor with backtest logic, add SSE streaming, build UI.

Data flow: Browser POST -> /api/backtest/multi-stocks/stream -> getKLineDataBatch() -> executeInChunks(symbols, processor, {concurrency:8, onProgress}) -> SSE events -> final results

### Existing Code to Reuse
- src/lib/backtest/parallel/chunked-executor.ts: executeInChunks()
- src/lib/backtest/parallel/types.ts: BatchProgress, BatchResult, ItemResult
- src/lib/backtest/signal-scanner.ts: scanStockSignalsEnhanced()
- src/lib/db/queries.ts: getKLineDataBatch()
- src/lib/redis/index.ts: cacheGet(), cacheSet()
- src/app/api/backtest/multi-stocks/route.ts: Current impl to refactor
- src/components/strategy-validation/config-panel.tsx: ValidationConfig type
- src/lib/backtest/__tests__/mock-factory.ts: Test data generators

### New Files
- src/lib/backtest/parallel/batch-backtest-service.ts
- src/lib/backtest/parallel/batch-backtest-types.ts
- src/app/api/backtest/multi-stocks/stream/route.ts
- src/components/strategy-validation/batch-progress-bar.tsx
- src/components/strategy-validation/failure-analysis-panel.tsx
- src/hooks/use-batch-backtest.ts
- src/lib/backtest/__tests__/batch-backtest-service.test.ts
- src/components/strategy-validation/__tests__/batch-progress-bar.test.tsx
- src/components/strategy-validation/__tests__/failure-analysis-panel.test.tsx
- src/hooks/__tests__/use-batch-backtest.test.ts

### Modified Files
- src/app/dashboard/strategy-validation/page.tsx: Use useBatchBacktest hook
- src/app/api/backtest/multi-stocks/route.ts: Refactor with executeInChunks
- src/components/strategy-validation/index.ts: Export new components
- src/lib/backtest/parallel/index.ts: Export new service

### Technical Specs
- SSE: text/event-stream, events: progress/complete/cancelled/error
- FailureReason: data_insufficient | suspended | format_error | timeout | unknown
- Concurrency: default 8
- Design: bg-accent bar, bg-loss/20 badges, font-mono tabular-nums, btn-tactile

### Performance Baseline (Spike)
Sequential: ~45s, Chunked c=8: ~12s, Target: <30s for 20 stocks x 252 days

## Dev Agent Record
