# Story 4.1: Parallel Backtest Technical Spike

Status: done

## Story

As a development team,
I want to investigate and determine the optimal technical approach for multi-stock parallel backtesting,
So that subsequent implementation has a clear technical path and performance baseline.

## Acceptance Criteria

### AC-1: Technical Decision Document
**Given** the current multi-stock backtest uses sequential Promise.all in server-side API route
**When** the spike investigation is completed
**Then** produce a decision document at doc/decisions/parallel-backtest.md evaluating at least 2 approaches:
- Option A: Web Worker Pool (browser-side, multi-core parallel execution)
- Option B: Server-side chunked concurrency (API route with controlled concurrency and SSE progress)
- Optional: Option C: NATS task queue (server-side distributed, worker pods)
**And** each option documents: architecture diagram (ASCII), performance characteristics, complexity, error handling, resource usage
**And** the document follows ADR format (Context, Options, Decision, Consequences)

### AC-2: Performance Benchmark - Baseline
**Given** the current sequential Promise.all implementation in /api/backtest/multi-stocks
**When** a benchmark test runs 20 stocks x 1 year data
**Then** record baseline execution time and resource metrics
**And** store results in the decision document

### AC-3: Performance Benchmark - Web Worker
**Given** a proof-of-concept Web Worker implementation
**When** the same 20 stocks x 1 year benchmark runs
**Then** record execution time with worker pool sizes of 2, 4, and navigator.hardwareConcurrency
**And** measure: total time, per-stock average, memory usage delta, main thread blocking (should be ~0)
**And** store results in the decision document

### AC-4: Performance Benchmark - Server Chunked Concurrency
**Given** a proof-of-concept chunked concurrency implementation (controlled Promise.all with chunk size)
**When** the same 20 stocks x 1 year benchmark runs with chunk sizes 4, 8, 12
**Then** record execution time and compare with baseline
**And** measure: total time, per-stock average, server memory usage
**And** store results in the decision document

### AC-5: Recommendation and Architecture
**Given** benchmark results for all options
**When** the decision document is finalized
**Then** it contains:
- Clear recommendation with rationale
- High-level architecture for recommended approach
- Migration path from current implementation
- Integration plan with existing BatchProgressBar component (Story 4-2)
- Risk assessment and mitigation strategies
**And** the recommended approach satisfies NFR-1.2: 20 stocks x 1 year < 30 seconds

### AC-6: Proof-of-Concept Code
**Given** the recommended approach is chosen
**When** spike code is written
**Then** deliver working PoC code in proper project locations:
- Web Worker option: src/lib/backtest/workers/ with worker script + pool manager
- Server chunked option: src/lib/backtest/parallel/ with chunked executor
**And** PoC includes basic error handling (single stock failure does not crash batch)
**And** PoC includes progress callback mechanism for UI integration
**And** unit tests verify correctness against sequential baseline

### AC-7: Test Coverage
**Given** the PoC implementation
**When** tests are executed
**Then** tests cover:
- Correctness: parallel results match sequential results for same input
- Error isolation: one stock failure does not affect others
- Progress reporting: callback fires with correct counts
- Edge cases: empty stock list, single stock, all stocks fail
**And** all tests pass with bun run test

## Tasks / Subtasks

- [x] Task 1: Baseline benchmark (AC: #2)
    - [x] 1.1: Create benchmark test file at src/lib/backtest/__tests__/parallel-benchmark.test.ts
    - [x] 1.2: Generate mock K-line data for 20 stocks x 252 trading days
    - [x] 1.3: Run sequential baseline and record metrics
- [x] Task 2: Web Worker PoC (AC: #3, #6)
    - [x] 2.1: Create worker script at src/lib/backtest/workers/backtest-worker.ts
    - [x] 2.2: Create worker pool manager at src/lib/backtest/workers/worker-pool.ts
    - [x] 2.3: Implement message protocol (job dispatch, result collection, error reporting)
    - [x] 2.4: Benchmark with pool sizes 2, 4, hardwareConcurrency
- [x] Task 3: Server chunked concurrency PoC (AC: #4, #6)
    - [x] 3.1: Create chunked executor at src/lib/backtest/parallel/chunked-executor.ts
    - [x] 3.2: Implement progress callback mechanism
    - [x] 3.3: Benchmark with chunk sizes 4, 8, 12
- [x] Task 4: Write decision document (AC: #1, #5)
    - [x] 4.1: Document architecture options with ASCII diagrams
    - [x] 4.2: Compare benchmark results
    - [x] 4.3: Write recommendation with rationale
    - [x] 4.4: Define migration path and integration plan
- [x] Task 5: Unit tests for recommended approach (AC: #7)
    - [x] 5.1: Correctness tests (parallel vs sequential result equality)
    - [x] 5.2: Error isolation tests
    - [x] 5.3: Progress reporting tests
    - [x] 5.4: Edge case tests

## Dev Notes

### Current Implementation Analysis

The existing multi-stock backtest lives in:
- API Route: src/app/api/backtest/multi-stocks/route.ts
- Signal Scanner: src/lib/backtest/signal-scanner.ts (scanStockSignalsEnhanced)
- Engine: src/lib/backtest/engine.ts (core backtest engine, ~900 lines)

Current approach: Server-side Promise.all in the API route handler. Effectively sequential because:
1. Node.js is single-threaded - Promise.all provides I/O concurrency but NOT CPU parallelism
2. Backtest computation is CPU-bound (indicator calculation, signal detection, trade simulation)
3. All computation happens in the main event loop, blocking other requests during batch execution

### Key Architecture Constraints

1. **Decimal.js requirement (ADR-006)**: All financial calculations MUST use Decimal.js. Web Workers receive/send data via structured clone - Decimal.js objects must be serialized to strings and reconstructed.
2. **Data Provider**: K-line data comes from PostgreSQL via getKLineDataBatch(). Web Workers cannot access database directly - data must be passed as messages.
3. **Next.js App Router**: API routes run server-side. Web Workers run client-side. These are fundamentally different execution contexts.
4. **NATS JetStream**: Available on office-debian-2. Could be used for distributed task queuing, but adds infrastructure complexity.

### Web Worker Considerations

**Pros:**
- True multi-core CPU parallelism in browser
- Offloads computation from main thread (UI stays responsive)
- No server load for computation - scales with client hardware
- No network round-trip for intermediate results

**Cons:**
- Must serialize all data via postMessage
- Decimal.js objects need string serialization/deserialization
- Worker bundling with Next.js requires webpack config
- Cannot access server-side DB - must fetch all K-line data upfront via API
- Memory pressure: 20 stocks x 252 days x ~6 fields = ~30K data points per worker
- Browser tab must stay open

### Server Chunked Concurrency Considerations

**Pros:**
- Simpler implementation - no worker bundling, no serialization overhead
- Direct database access - no extra API call for data
- Works even when browser tab is backgrounded
- Existing code can be refactored incrementally
- SSE for real-time progress

**Cons:**
- Still single-threaded - chunks provide concurrency scheduling, not parallelism
- Server bears all computation load
- Network required for progress updates

### NATS Task Queue (Optional Evaluation)

Pros: Distributable across pods, resilient to crashes, decoupled worker scaling
Cons: Highest complexity, requires NATS consumer pods, operational overhead for 2-person team
Recommendation: Document but likely defer

### Performance Target

NFR-1.2: Multi-stock backtest (20 stocks, 1 year each) < 30 seconds

### Existing Test Patterns

- Tests use Vitest (not Jest)
- Test files alongside source: src/lib/backtest/__tests__/
- Mock factories exist: src/lib/backtest/__tests__/mock-factory.ts

### Files to Create

| File | Purpose |
|------|---------|
| src/lib/backtest/__tests__/parallel-benchmark.test.ts | Benchmark tests |
| src/lib/backtest/workers/backtest-worker.ts | Web Worker script (PoC) |
| src/lib/backtest/workers/worker-pool.ts | Worker pool manager (PoC) |
| src/lib/backtest/workers/types.ts | Worker message protocol types |
| src/lib/backtest/workers/index.ts | Barrel export |
| src/lib/backtest/parallel/chunked-executor.ts | Server-side chunked executor (PoC) |
| src/lib/backtest/parallel/types.ts | Parallel execution types |
| src/lib/backtest/parallel/index.ts | Barrel export |
| src/lib/backtest/__tests__/chunked-executor.test.ts | Chunked executor unit tests |
| src/lib/backtest/__tests__/worker-pool.test.ts | Worker pool unit tests |
| doc/decisions/parallel-backtest.md | ADR decision document |

### Files to Reference (Read Only)

| File | Reason |
|------|--------|
| src/app/api/backtest/multi-stocks/route.ts | Current sequential implementation |
| src/lib/backtest/signal-scanner.ts | Core scanning function per stock |
| src/lib/backtest/engine.ts | Backtest engine internals |
| src/lib/backtest/types.ts | All type definitions |
| src/lib/backtest/core/interfaces.ts | IBacktestEngine, IDataProvider |
| src/lib/backtest/__tests__/mock-factory.ts | Existing mock data generators |
| src/lib/backtest/core/financial-math.ts | Decimal.js FinancialAmount wrapper |

### Design Decisions for PoC

1. Worker message format: Plain objects with string-serialized Decimal values. Workers reconstruct internally.
2. Progress protocol: type=progress messages with completed count, total count, and current symbol.
3. Error protocol: type=error messages with symbol and error string - never crash pool on single stock failure.
4. Chunked executor: Generic utility, not backtest-specific - accepts (items, processor, options) with concurrency and onProgress callback.

### Testing Strategy

- Benchmark tests use test.skip by default (CPU-intensive, run manually)
- Unit tests mock the backtest engine to test orchestration logic
- Correctness tests compare parallel output against sequential output for identical inputs
- Use vi.fn() to verify progress callback invocations

## Dev Agent Record
