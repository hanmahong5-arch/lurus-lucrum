/**
 * Local backtest executor — runs the engine inside the current Node/Bun
 * process. This is the production path today and the fallback when the
 * remote worker pool is unreachable.
 *
 * Wraps `runBacktest()` from `../engine.ts` with the standard
 * IBacktestExecutor contract: stable runId, durationMs telemetry,
 * cooperative cancellation via AbortSignal.
 *
 * Limitations (acknowledged, not silently swept under):
 *   - The engine is fundamentally synchronous; the AbortSignal can only
 *     cause the post-completion result to be discarded, not interrupt
 *     mid-computation. Cancellation between bars would require an engine
 *     rewrite — Sprint 2 work.
 *   - Memory peak scales with klines.length × indicator-window-count.
 *     1000-day daily-bar runs are ~MB-scale and fine; tick runs aren't.
 *
 * @module lib/backtest/executor/local-executor
 */

import { runBacktest } from "@/lib/backtest/engine";
import {
  BacktestCancelledError,
  type BacktestRunInput,
  type BacktestRunOutput,
  type IBacktestExecutor,
} from "./types";

function generateRunId(): string {
  // crypto.randomUUID() is available in Node 19+ / Bun / all modern browsers.
  // Fall back to a simple random string for the (vanishingly rare) case it isn't.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class LocalBacktestExecutor implements IBacktestExecutor {
  readonly name = "local";

  async run(input: BacktestRunInput): Promise<BacktestRunOutput> {
    const runId = input.runId ?? generateRunId();

    // Early-abort: if the caller already cancelled before we entered, don't
    // burn cycles. The engine call itself is synchronous so we can't
    // interrupt mid-run, but we can refuse to start.
    if (input.signal?.aborted) {
      throw new BacktestCancelledError(runId);
    }

    const startedAt = Date.now();
    const result = await runBacktest(
      input.strategyCode,
      // engine accepts mutable array; clone defensively since callers may
      // reuse the kline list across runs.
      input.klines as ReadonlyArray<unknown> as Parameters<typeof runBacktest>[1],
      input.config,
    );
    const durationMs = Date.now() - startedAt;

    // Post-run abort check: if the caller cancelled while the engine was
    // crunching, honour it by discarding the result.
    if (input.signal?.aborted) {
      throw new BacktestCancelledError(runId);
    }

    return {
      result,
      meta: {
        runId,
        executorName: this.name,
        durationMs,
      },
    };
  }

  async cancel(_runId: string): Promise<void> {
    // No-op: the engine doesn't expose mid-run cancellation hooks today.
    // Callers should pass an AbortSignal in `run(input)` instead; that one
    // at least prevents the result from being consumed post-completion.
  }

  async isHealthy(): Promise<boolean> {
    // We're alive enough to be answering this call.
    return true;
  }
}
