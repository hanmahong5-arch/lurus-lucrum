/**
 * Chunked Concurrent Executor
 *
 * Generic utility for processing a list of items with controlled concurrency.
 * Processes items in chunks, reporting progress after each item completes.
 *
 * Key properties:
 * - Single item failure does not crash the batch
 * - Progress callback fires after each completion
 * - Supports AbortSignal for cancellation
 * - Order of results matches order of input items
 *
 * @module lib/backtest/parallel/chunked-executor
 */

import type {
  BatchProgress,
  BatchResult,
  ChunkedExecutorOptions,
  ItemResult,
} from "./types";

/** Default concurrency level */
const DEFAULT_CONCURRENCY = 4;

/**
 * Execute a batch of items with controlled concurrency.
 *
 * Items are processed in chunks of `concurrency` size.
 * Each chunk runs in parallel via Promise.all, then the next chunk starts.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Execution options (concurrency, progress, cancellation)
 * @returns BatchResult containing all results and summary statistics
 *
 * @example
 * ```ts
 * const result = await executeInChunks(
 *   symbols,
 *   async (symbol) => await runBacktest(symbol),
 *   { concurrency: 8, onProgress: (p) => updateUI(p) }
 * );
 * ```
 */
export async function executeInChunks<TItem, TResult>(
  items: TItem[],
  processor: (item: TItem, index: number) => Promise<TResult>,
  options: ChunkedExecutorOptions = {},
): Promise<BatchResult<TResult>> {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    onProgress,
    signal,
    getItemId,
  } = options;

  // Edge case: empty input
  if (items.length === 0) {
    return {
      results: [],
      summary: {
        total: 0,
        succeeded: 0,
        failed: 0,
        totalTimeMs: 0,
        avgTimePerItemMs: 0,
      },
    };
  }

  const startTime = performance.now();
  const total = items.length;
  const results: Array<ItemResult<TResult>> = new Array(total);
  let completed = 0;
  let failed = 0;

  // Validate concurrency
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, total));

  // Split items into chunks
  const chunks: Array<Array<{ item: TItem; index: number }>> = [];
  for (let i = 0; i < total; i += effectiveConcurrency) {
    const chunk: Array<{ item: TItem; index: number }> = [];
    for (let j = i; j < Math.min(i + effectiveConcurrency, total); j++) {
      chunk.push({ item: items[j]!, index: j });
    }
    chunks.push(chunk);
  }

  // Process each chunk sequentially, items within chunk in parallel
  for (const chunk of chunks) {
    // Check for cancellation before starting chunk
    if (signal?.aborted) {
      // Fill remaining with cancellation errors
      for (const { index } of chunk) {
        if (results[index] === undefined) {
          results[index] = { success: false, error: "Cancelled" };
          failed++;
          completed++;
        }
      }
      // Fill any remaining chunks too
      continue;
    }

    const chunkPromises = chunk.map(async ({ item, index }) => {
      // Check cancellation at item level too
      if (signal?.aborted) {
        results[index] = { success: false, error: "Cancelled" };
        failed++;
        completed++;
        return;
      }

      try {
        const data = await processor(item, index);
        results[index] = { success: true, data };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        results[index] = { success: false, error: errorMessage };
        failed++;
      }

      completed++;

      // Report progress
      if (onProgress) {
        const itemId = getItemId
          ? getItemId(item, index)
          : String(index);
        const progress: BatchProgress = {
          completed,
          total,
          failed,
          currentItem: itemId,
          elapsedMs: performance.now() - startTime,
        };
        onProgress(progress);
      }
    });

    await Promise.all(chunkPromises);
  }

  const totalTimeMs = performance.now() - startTime;

  return {
    results,
    summary: {
      total,
      succeeded: completed - failed,
      failed,
      totalTimeMs,
      avgTimePerItemMs: total > 0 ? totalTimeMs / total : 0,
    },
  };
}
