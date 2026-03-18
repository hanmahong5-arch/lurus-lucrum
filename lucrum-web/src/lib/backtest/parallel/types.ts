/**
 * Parallel Execution Types
 *
 * Generic types for parallel/chunked batch processing.
 * Not backtest-specific - reusable across the platform.
 *
 * @module lib/backtest/parallel/types
 */

/**
 * Progress information for batch operations.
 */
export interface BatchProgress {
  /** Number of items completed so far */
  completed: number;
  /** Total number of items in the batch */
  total: number;
  /** Number of items that failed */
  failed: number;
  /** Identifier of the most recently completed item */
  currentItem?: string;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Result of processing a single item in a batch.
 */
export type ItemResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Result of an entire batch execution.
 */
export interface BatchResult<T> {
  /** Successfully processed results (order matches input) */
  results: Array<ItemResult<T>>;
  /** Summary statistics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalTimeMs: number;
    avgTimePerItemMs: number;
  };
}

/**
 * Options for chunked concurrent execution.
 */
export interface ChunkedExecutorOptions {
  /**
   * Maximum number of items to process concurrently.
   * @default 4
   */
  concurrency?: number;

  /**
   * Callback invoked after each item completes.
   * Use for progress UI updates.
   */
  onProgress?: (progress: BatchProgress) => void;

  /**
   * AbortSignal for cancellation support.
   * When aborted, remaining items are skipped and completed results are returned.
   */
  signal?: AbortSignal;

  /**
   * Optional identifier extractor for progress reporting.
   * If not provided, item index is used.
   */
  getItemId?: (item: unknown, index: number) => string;
}
