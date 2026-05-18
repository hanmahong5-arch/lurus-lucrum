/**
 * Backtest executor abstraction — the indirection layer that lets us swap
 * the local-process engine for a remote worker pod without touching call
 * sites.
 *
 * Sprint 1 architecture prep (per Winston Top-5 #1): the current
 * `runBacktest()` in `engine.ts` runs synchronously inside the Next.js
 * pod. Long-running backtests (Paper Trading, large universes) will OOM
 * the web tier. This module defines the contract that a NATS-driven
 * worker pod will implement, so the eventual swap is a one-line factory
 * change rather than a refactor.
 *
 * Today: only `LocalBacktestExecutor` is wired. `RemoteBacktestExecutor`
 * is a documented stub showing the NATS subject + payload shape; throwing
 * `NotImplementedError` keeps anyone from accidentally relying on it.
 *
 * @module lib/backtest/executor/types
 */

import type {
  BacktestConfig,
  BacktestKline,
  BacktestResult,
} from "@/lib/backtest/types";

// ---------------------------------------------------------------------------
// Public input / output types — match the existing runBacktest signature
// exactly so call sites can be migrated by changing the import alone.
// ---------------------------------------------------------------------------

export interface BacktestRunInput {
  /** Vnpy-flavoured CtaTemplate strategy source (parsed by engine). */
  readonly strategyCode: string;
  /** OHLCV bars in chronological order — provider's job to fetch. */
  readonly klines: readonly BacktestKline[];
  /** Engine config (initial capital, costs, walk-forward split, ...). */
  readonly config: BacktestConfig;
  /**
   * Optional per-run identifier. Used for cancellation, telemetry
   * correlation, and remote-executor job tracking. When omitted, the
   * executor generates a UUID and surfaces it on the result.
   */
  readonly runId?: string;
  /**
   * Optional caller-owned signal. Local executor checks it between
   * segments; remote executor sends a cancel message on the NATS subject.
   */
  readonly signal?: AbortSignal;
}

export interface BacktestExecutionMeta {
  /** The runId the executor used (echoes input.runId or its own UUID). */
  readonly runId: string;
  /** Stable name of the implementation, for telemetry. */
  readonly executorName: string;
  /** Wall-clock milliseconds inside the executor (excludes data fetch). */
  readonly durationMs: number;
}

export interface BacktestRunOutput {
  readonly result: BacktestResult;
  readonly meta: BacktestExecutionMeta;
}

// ---------------------------------------------------------------------------
// The executor interface — implementations must be cancellable, idempotent
// per runId, and emit no side effects beyond what the engine itself does.
// ---------------------------------------------------------------------------

export interface IBacktestExecutor {
  /** Stable identifier — `local` / `remote-nats` / `mock`. */
  readonly name: string;

  /**
   * Run a single backtest. Implementations MUST:
   *   - resolve with the same `runId` they accepted (or one they generated);
   *   - reject with `BacktestCancelledError` when the supplied signal aborts;
   *   - never throw on user-input errors — those are propagated through the
   *     BacktestResult shape (the engine already does this).
   */
  run(input: BacktestRunInput): Promise<BacktestRunOutput>;

  /**
   * Cooperative cancellation by runId. For the local executor this is a
   * no-op past the synchronous segment boundary; remote executors send a
   * NATS cancel message. Resolves immediately — the actual run rejection
   * arrives via the original promise.
   */
  cancel(runId: string): Promise<void>;

  /**
   * Healthcheck — used by the factory to decide whether to fall back. The
   * remote executor pings its NATS queue; the local executor always returns
   * true (the process is healthy by definition if this call is running).
   */
  isHealthy(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Error types — small, dedicated classes so call sites can branch cleanly.
// ---------------------------------------------------------------------------

/** Thrown when the caller aborts via `input.signal`. */
export class BacktestCancelledError extends Error {
  readonly code = "BACKTEST_CANCELLED";
  constructor(readonly runId: string) {
    super(`Backtest ${runId} cancelled by caller`);
    this.name = "BacktestCancelledError";
  }
}

/**
 * Thrown by stub implementations to make it obvious in dev logs that the
 * remote executor isn't wired yet. Never catch this and continue — it
 * means the factory mis-selected the impl.
 */
export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED";
  constructor(what: string) {
    super(`${what} is not implemented in this build`);
    this.name = "NotImplementedError";
  }
}
