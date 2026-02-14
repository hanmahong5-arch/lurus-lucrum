/**
 * Parallel Execution Module
 * Provides chunked concurrent execution for batch operations.
 * @module lib/backtest/parallel
 */

export { executeInChunks } from "./chunked-executor";
export type { BatchProgress, BatchResult, ChunkedExecutorOptions, ItemResult } from "./types";

export { executeBatchBacktest, classifyFailure, buildFailureBreakdown, calculateBatchSummary } from "./batch-backtest-service";
export type { StockBatchItem, BatchProcessorConfig } from "./batch-backtest-service";

export { ANOMALY_THRESHOLD, DEFAULT_BATCH_CONCURRENCY } from "./batch-backtest-types";
export type {
  FailureReason, FailureRecord, FailureBreakdown,
  BatchBacktestSummary, BatchBacktestResult,
  BatchSSEEvent, BatchSSEProgressEvent, BatchSSECompleteEvent, BatchSSECancelledEvent, BatchSSEErrorEvent,
  BatchBacktestOptions, BatchBacktestRequest,
} from "./batch-backtest-types";
