/**
 * Backtest Worker Pool Manager
 *
 * Manages a pool of Web Workers for parallel backtest execution.
 * Dispatches jobs round-robin, collects results, reports progress.
 *
 * Usage:
 *   const pool = new BacktestWorkerPool({ poolSize: 4 });
 *   const results = await pool.executeBatch(jobs, onProgress);
 *   pool.terminate();
 *
 * @module lib/backtest/workers/worker-pool
 */

import type {
  WorkerJobMessage,
  WorkerOutboundMessage,
  WorkerPoolConfig,
  WorkerPoolProgress,
  SerializableKline,
} from "./types";

/** Default pool size based on hardware or fallback */
const DEFAULT_POOL_SIZE = 4;

/** Default job timeout: 30 seconds */
const DEFAULT_JOB_TIMEOUT_MS = 30_000;

/**
 * Job definition for the worker pool.
 */
export interface BacktestJob {
  symbol: string;
  name: string;
  klines: SerializableKline[];
  strategyId: string;
  options: {
    holdingDays: number;
    excludeSTStocks?: boolean;
    includeTransactionCosts?: boolean;
  };
}

/**
 * Result from a single job in the pool.
 */
export type JobResult =
  | { success: true; symbol: string; data: unknown }
  | { success: false; symbol: string; error: string };

/**
 * Manages a pool of backtest Web Workers.
 *
 * Workers are created lazily on first executeBatch call.
 * The pool distributes jobs to available workers and collects results.
 */
export class BacktestWorkerPool {
  private workers: Worker[] = [];
  private poolSize: number;
  private jobTimeoutMs: number;
  private terminated = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.poolSize = config.poolSize ?? DEFAULT_POOL_SIZE;
    this.jobTimeoutMs = config.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
  }

  /**
   * Create worker instances.
   * In a real Next.js app, the worker URL would be resolved by webpack.
   * For the PoC, we use the standard Worker constructor pattern.
   */
  private createWorkers(): void {
    if (this.workers.length > 0) return;

    for (let i = 0; i < this.poolSize; i++) {
      try {
        // Next.js/webpack worker pattern
        const worker = new Worker(
          new URL("./backtest-worker.ts", import.meta.url),
          { type: "module" },
        );
        this.workers.push(worker);
      } catch {
        // If Worker creation fails (e.g., in tests or SSR), skip
        console.warn(
          `[WorkerPool] Failed to create worker ${i + 1}/${this.poolSize}`,
        );
      }
    }
  }

  /**
   * Execute a batch of backtest jobs across the worker pool.
   *
   * @param jobs - Array of backtest jobs to execute
   * @param onProgress - Optional progress callback
   * @returns Array of job results in the same order as input
   */
  async executeBatch(
    jobs: BacktestJob[],
    onProgress?: (progress: WorkerPoolProgress) => void,
  ): Promise<JobResult[]> {
    if (this.terminated) {
      throw new Error("Worker pool has been terminated");
    }

    if (jobs.length === 0) {
      return [];
    }

    this.createWorkers();

    if (this.workers.length === 0) {
      throw new Error(
        "No workers available. Web Workers may not be supported in this environment.",
      );
    }

    const startTime = performance.now();
    const results: JobResult[] = new Array(jobs.length);
    let completed = 0;
    let failed = 0;

    return new Promise((resolve) => {
      // Job queue
      let nextJobIndex = 0;
      const pendingJobs = new Map<
        string,
        { index: number; timer: ReturnType<typeof setTimeout> }
      >();

      const dispatchNext = (worker: Worker): void => {
        if (nextJobIndex >= jobs.length) return;

        const jobIndex = nextJobIndex++;
        const job = jobs[jobIndex]!;
        const jobId = `${job.symbol}-${jobIndex}`;

        const message: WorkerJobMessage = {
          type: "job",
          jobId,
          symbol: job.symbol,
          name: job.name,
          klines: job.klines,
          strategyId: job.strategyId,
          options: job.options,
        };

        // Set timeout for this job
        const timer = setTimeout(() => {
          if (pendingJobs.has(jobId)) {
            pendingJobs.delete(jobId);
            results[jobIndex] = {
              success: false,
              symbol: job.symbol,
              error: `Job timed out after ${this.jobTimeoutMs}ms`,
            };
            completed++;
            failed++;
            reportProgress(job.symbol);
            dispatchNext(worker);
            checkDone();
          }
        }, this.jobTimeoutMs);

        pendingJobs.set(jobId, { index: jobIndex, timer });
        worker.postMessage(message);
      };

      const reportProgress = (symbol: string): void => {
        if (onProgress) {
          onProgress({
            completed,
            total: jobs.length,
            failed,
            currentSymbol: symbol,
            elapsedMs: performance.now() - startTime,
          });
        }
      };

      const checkDone = (): void => {
        if (completed >= jobs.length) {
          resolve(results);
        }
      };

      // Set up message handlers for each worker
      const messageHandlers = this.workers.map(
        (worker) =>
          (event: MessageEvent<WorkerOutboundMessage>) => {
            const msg = event.data;

            if (msg.type === "ready") {
              dispatchNext(worker);
              return;
            }

            if (msg.type === "result" || msg.type === "error") {
              const pending = pendingJobs.get(msg.jobId);
              if (!pending) return; // Already timed out or duplicate

              clearTimeout(pending.timer);
              pendingJobs.delete(msg.jobId);

              if (msg.type === "result") {
                results[pending.index] = {
                  success: true,
                  symbol: msg.symbol,
                  data: msg.data,
                };
              } else {
                results[pending.index] = {
                  success: false,
                  symbol: msg.symbol,
                  error: msg.error,
                };
                failed++;
              }

              completed++;
              reportProgress(msg.symbol);
              dispatchNext(worker);
              checkDone();
            }
          },
      );

      // Attach handlers and start dispatching
      this.workers.forEach((worker, i) => {
        worker.addEventListener("message", messageHandlers[i]!);
        // Dispatch first job to each worker
        dispatchNext(worker);
      });
    });
  }

  /**
   * Terminate all workers in the pool.
   * After termination, the pool cannot be reused.
   */
  terminate(): void {
    this.terminated = true;
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
  }

  /** Get the current pool size */
  getPoolSize(): number {
    return this.poolSize;
  }

  /** Check if pool has been terminated */
  isTerminated(): boolean {
    return this.terminated;
  }
}
