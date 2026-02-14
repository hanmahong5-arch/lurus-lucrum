/**
 * Batch Backtest Types
 *
 * Domain types for parallel batch backtesting, including failure
 * classification, anomaly analysis, and aggregate summaries.
 *
 * @module lib/backtest/parallel/batch-backtest-types
 */

import type { StockSignalResult } from "../signal-scanner";
import type { BatchProgress, ItemResult } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Failure ratio threshold above which anomaly mode activates */
export const ANOMALY_THRESHOLD = 0.5;

/** Default concurrency for batch backtest */
export const DEFAULT_BATCH_CONCURRENCY = 8;

// =============================================================================
// Failure Classification
// =============================================================================

/** Categorized reason for a single stock backtest failure */
export type FailureReason =
  | "data_insufficient"
  | "suspended"
  | "format_error"
  | "timeout"
  | "unknown";

/** A single failure record with classified reason */
export interface FailureRecord {
  symbol: string;
  reason: FailureReason;
  message: string;
}

/** Aggregated failure breakdown by reason */
export interface FailureBreakdown {
  reason: FailureReason;
  count: number;
  symbols: string[];
  label: string;
  labelEn: string;
}

// =============================================================================
// Batch Backtest Results
// =============================================================================

/** Aggregate summary for a batch backtest run */
export interface BatchBacktestSummary {
  totalStocks: number;
  succeededStocks: number;
  failedStocks: number;
  totalSignals: number;
  positiveReturns: number;
  negativeReturns: number;
  avgReturn: number;
  winRate: number;
  maxReturn: number;
  minReturn: number;
  totalReturn: number;
  totalTimeMs: number;
  avgTimePerStockMs: number;
}

/** Full result of a batch backtest execution */
export interface BatchBacktestResult {
  results: Array<ItemResult<StockSignalResult>>;
  summary: BatchBacktestSummary;
  failures: FailureRecord[];
  failureBreakdown: FailureBreakdown[];
  isAnomalyMode: boolean;
  meta: {
    concurrency: number;
    dataSource: "database" | "api" | "mixed";
    timestamp: string;
  };
}

// =============================================================================
// SSE Event Types
// =============================================================================

export interface BatchSSEProgressEvent {
  type: "progress";
  completed: number;
  total: number;
  failed: number;
  currentItem: string;
  elapsedMs: number;
}

export interface BatchSSECompleteEvent {
  type: "complete";
  result: BatchBacktestResult;
}

export interface BatchSSECancelledEvent {
  type: "cancelled";
  result: BatchBacktestResult;
}

export interface BatchSSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export type BatchSSEEvent =
  | BatchSSEProgressEvent
  | BatchSSECompleteEvent
  | BatchSSECancelledEvent
  | BatchSSEErrorEvent;

// =============================================================================
// Service Options
// =============================================================================

export interface BatchBacktestOptions {
  concurrency?: number;
  onProgress?: (progress: BatchProgress) => void;
  signal?: AbortSignal;
}

export interface BatchBacktestRequest {
  symbols: string[];
  strategy: string;
  startDate: string;
  endDate: string;
  holdingDays: number;
  maxStocks?: number;
  includeTransactionCosts?: boolean;
  excludeSTStocks?: boolean;
  deduplicateSignals?: boolean;
  concurrency?: number;
  dataSource?: "database" | "api" | "auto";
}
