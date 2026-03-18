/**
 * Web Worker Message Protocol Types
 *
 * Defines the contract between main thread and backtest workers.
 * All data must be serializable via structured clone algorithm.
 * Decimal.js values are passed as strings and reconstructed in workers.
 *
 * @module lib/backtest/workers/types
 */

/**
 * K-line data point in serializable format.
 * Matches BacktestKline but documented explicitly for worker boundary.
 */
export interface SerializableKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Job payload sent from main thread to worker.
 */
export interface WorkerJobMessage {
  type: "job";
  /** Unique job identifier */
  jobId: string;
  /** Stock symbol */
  symbol: string;
  /** Stock name */
  name: string;
  /** K-line data for this stock */
  klines: SerializableKline[];
  /** Strategy identifier */
  strategyId: string;
  /** Scan options (serializable subset) */
  options: {
    holdingDays: number;
    excludeSTStocks?: boolean;
    includeTransactionCosts?: boolean;
  };
}

/**
 * Terminate signal sent to worker.
 */
export interface WorkerTerminateMessage {
  type: "terminate";
}

/** Messages sent TO a worker */
export type WorkerInboundMessage = WorkerJobMessage | WorkerTerminateMessage;

/**
 * Successful result from worker.
 */
export interface WorkerResultMessage {
  type: "result";
  jobId: string;
  symbol: string;
  /** Serialized StockSignalResult */
  data: unknown;
}

/**
 * Error result from worker.
 */
export interface WorkerErrorMessage {
  type: "error";
  jobId: string;
  symbol: string;
  error: string;
}

/**
 * Worker ready signal.
 */
export interface WorkerReadyMessage {
  type: "ready";
}

/** Messages sent FROM a worker */
export type WorkerOutboundMessage =
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerReadyMessage;

/**
 * Worker pool configuration.
 */
export interface WorkerPoolConfig {
  /**
   * Number of workers in the pool.
   * @default navigator.hardwareConcurrency || 4
   */
  poolSize?: number;

  /**
   * Maximum time (ms) to wait for a single job before considering it failed.
   * @default 30000
   */
  jobTimeoutMs?: number;
}

/**
 * Progress callback for worker pool operations.
 */
export interface WorkerPoolProgress {
  completed: number;
  total: number;
  failed: number;
  currentSymbol?: string;
  elapsedMs: number;
}
