# ADR: Parallel Backtest Architecture

**Status**: Accepted
**Date**: 2026-02-13
**Story**: 4-1 (Parallel Backtest Technical Spike)

## Context

The multi-stock backtest feature (FR-2.10) requires executing backtests across 20+ stocks within 30 seconds (NFR-1.2). The current implementation in `/api/backtest/multi-stocks` uses `Promise.all` which provides I/O concurrency but NOT CPU parallelism in single-threaded Node.js.

Backtest computation is CPU-bound: indicator calculation (SMA, EMA, RSI, MACD, Bollinger), signal detection, trade simulation, and statistics. `Promise.all` on CPU-bound tasks effectively runs them sequentially.

## Options Evaluated

### Option A: Web Worker Pool (Browser-side)

```
Browser Main Thread              Worker Pool (N workers)
--------------------             ----------------------
1. Fetch K-line data (API)
2. Create worker pool     
3. Dispatch jobs          -->    Worker: compute backtest
4. Collect results        <--    Worker: return result
5. Update UI progress
```

**Performance**: True CPU parallelism. N workers = N cores utilized.
**Complexity**: Medium-High. Requires data serialization, webpack worker config, Decimal.js string conversion.
**Pros**: Offloads server, scales with client hardware, no network for intermediate results.
**Cons**: Requires all K-line data upfront (extra API call), Decimal.js serialization overhead, Next.js worker bundling complexity, browser tab must stay open.

### Option B: Server-side Chunked Concurrency (Recommended)

```
API Route Handler
-----------------
1. Batch fetch K-line data (single DB query)
2. Split stocks into chunks of size N
3. Process chunk: await Promise.all(chunk.map(process))
4. Stream progress via callback / SSE
5. Return aggregated results
```

**Performance**: Scheduling concurrency, not true parallelism. But for this workload, overhead is dominated by DB I/O which IS concurrent.
**Complexity**: Low. Minimal code change, reuses existing infrastructure.
**Pros**: Direct DB access, no serialization, works in background, incremental migration, simpler error handling.
**Cons**: Server-bound computation, single-threaded CPU limitation.

### Option C: NATS Task Queue (Distributed)

```
API Route --> NATS JetStream --> Worker Pod(s) --> Result Stream
```

**Performance**: Horizontally scalable. Multiple pods = true distributed parallelism.
**Complexity**: Very High. Requires NATS consumer pods, job serialization, result collection, deployment changes.
**Pros**: Best scalability, crash resilience, decoupled.
**Cons**: Disproportionate complexity for 2-person team and current scale (<100 stocks).

## Decision

**Recommended: Option B (Server-side Chunked Concurrency) as primary, with Option A (Web Workers) as future enhancement.**

### Rationale

1. **Current performance is already adequate**: Benchmark shows 20 stocks x 252 days completes in <200ms with simplified computation. Even with full signal scanner overhead (5-10x), the 30-second target is easily met.
2. **Simplicity**: Option B requires ~100 lines of generic utility code vs ~500+ for Web Workers with serialization/bundling.
3. **Incremental migration**: The existing `/api/backtest/multi-stocks` route can adopt `executeInChunks` with minimal refactoring.
4. **No infrastructure changes**: No webpack config, no worker bundling, no NATS consumers needed.
5. **Progress reporting**: The `onProgress` callback integrates naturally with SSE or BatchProgressBar.

### When to upgrade to Web Workers

Consider Web Workers (Option A) when:
- Single stock backtest exceeds 1 second (current: ~10-50ms)
- Server memory pressure becomes an issue with concurrent users
- Users request "run in background" capability

### When to upgrade to NATS

Consider NATS (Option C) when:
- Need to support 100+ concurrent users
- Need backtest across 1000+ stocks
- Need crash-resilient long-running computations

## Benchmark Results

### Test Setup
- 20 stocks, 252 trading days each
- Simplified SMA crossover strategy (representative CPU work)
- Run in Vitest on development machine

### Results

| Approach | Concurrency | Time (ms) | Per Stock (ms) |
|----------|------------|-----------|----------------|
| Sequential (baseline) | 1 | ~5-15 | ~0.3-0.8 |
| Chunked | 4 | ~5-15 | ~0.3-0.8 |
| Chunked | 8 | ~5-15 | ~0.3-0.8 |
| Chunked | 12 | ~5-15 | ~0.3-0.8 |

Note: For pure CPU-bound work in single-threaded Node.js, chunked concurrency does not improve wall-clock time. However, it provides crucial benefits:
1. Interleaving with I/O (DB fetches) enables real concurrency gains
2. Progress reporting between chunks keeps UI responsive
3. Cancellation checkpoints between chunks enable abort support
4. Error isolation prevents single stock failure from crashing batch

## Migration Path

### Phase 1 (Story 4-1, current)
- Implement `executeInChunks` generic utility
- Unit tests + benchmarks

### Phase 2 (Story 4-2)
- Replace `Promise.all` in `/api/backtest/multi-stocks` with `executeInChunks`
- Add SSE endpoint for real-time progress
- Wire to BatchProgressBar component
- Add cancellation via AbortController

### Phase 3 (Future, if needed)
- Add Web Worker pool for client-side computation
- Hybrid: use workers when available, fall back to server chunked

## Consequences

### Positive
- Minimal implementation effort (generic utility, ~150 LOC)
- Backward compatible with existing API
- Natural progress reporting mechanism
- Cancellation support built in
- Error isolation by design

### Negative
- No true CPU parallelism on server (acceptable for current scale)
- Server bears computation load (acceptable for <10 concurrent users)

### Risks
- If backtest engine becomes significantly heavier (e.g., tick-level simulation), single-threaded may become bottleneck
- Mitigation: Web Worker upgrade path is documented and PoC code exists

## References
- NFR-1.2: Multi-stock backtest (20 stocks, 1yr) < 30 seconds
- ADR-006: Decimal.js for financial calculations
- FR-2.10: Parallel batch backtest for multi-stock
