/**
 * Server-wide concurrency limiter for heavy operations.
 * Prevents more than N simultaneous backtest computations.
 *
 * When the limit is reached, requests are queued with a timeout.
 * Queue position is returned to the client for UX feedback.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_CONCURRENT = {
  backtest: 10,
  sector: 3,
  portfolio: 2,
  recommend: 2,
} as const;

export type ConcurrencyType = keyof typeof MAX_CONCURRENT;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AcquireResult {
  /** 0 means the slot was immediately available; >0 means the request was queued */
  position: number;
  /** Must be called when the operation completes to free the slot */
  release: () => void;
}

interface QueueEntry {
  resolve: (result: AcquireResult) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ConcurrencyStatus {
  active: number;
  max: number;
  queued: number;
}

// ─── Limiter Implementation ──────────────────────────────────────────────────

class ConcurrencyLimiter {
  private active = new Map<string, number>();
  private queues = new Map<string, QueueEntry[]>();

  /**
   * Acquire a concurrency slot.
   *
   * If a slot is available, resolves immediately.
   * If all slots are occupied, the request is queued and will resolve
   * when a slot becomes available or reject after `timeoutMs`.
   *
   * @param type       Which limiter pool to use
   * @param timeoutMs  Maximum wait time in the queue (default 30s)
   * @returns          Promise resolving to { position, release }
   * @throws           Error with Chinese message on queue timeout
   */
  async acquire(
    type: ConcurrencyType,
    timeoutMs = 30_000,
  ): Promise<AcquireResult> {
    const max = MAX_CONCURRENT[type];
    const current = this.active.get(type) ?? 0;

    if (current < max) {
      this.active.set(type, current + 1);
      return { position: 0, release: () => this.release(type) };
    }

    // All slots occupied — enqueue the request
    const queue = this.queues.get(type) ?? [];
    const position = queue.length + 1;

    return new Promise<AcquireResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove ourselves from the queue
        const idx = queue.indexOf(entry);
        if (idx >= 0) queue.splice(idx, 1);
        reject(
          new Error(
            `排队超时，请稍后重试 (当前有${this.active.get(type) ?? 0}个任务正在执行)`,
          ),
        );
      }, timeoutMs);

      const entry: QueueEntry = {
        resolve: (result: AcquireResult) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        },
        timeout,
      };

      queue.push(entry);
      this.queues.set(type, queue);
    });
  }

  /**
   * Release a concurrency slot and promote the next queued request (if any).
   */
  private release(type: string): void {
    const current = this.active.get(type) ?? 1;
    this.active.set(type, current - 1);

    // Promote the next waiting request
    const queue = this.queues.get(type);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      this.active.set(type, (this.active.get(type) ?? 0) + 1);
      next.resolve({ position: 0, release: () => this.release(type) });
    }
  }

  /**
   * Get current status for a limiter pool (useful for monitoring / SSE events).
   */
  getStatus(type: ConcurrencyType): ConcurrencyStatus {
    return {
      active: this.active.get(type) ?? 0,
      max: MAX_CONCURRENT[type],
      queued: this.queues.get(type)?.length ?? 0,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const limiter = new ConcurrencyLimiter();
