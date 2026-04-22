/**
 * Funnel Pipeline — Core Types
 *
 * The selection funnel narrows a universe of thousands of stocks down to a
 * handful of actionable picks. It is modeled as a sequence of independent
 * stages, each taking a symbol list (plus stage-specific context) and
 * emitting a filtered/scored list (plus an eval record).
 *
 * Design tenets:
 *   1. Point-in-Time: every query is anchored to `context.asOfDate`.
 *   2. Stage independence: each stage has its own health metrics and
 *      can be swapped/disabled without touching neighbors.
 *   3. Observability first: every stage emits a `StageEval` for dashboards.
 *
 * @module lib/funnel/types
 */

/** A ranked or unranked candidate flowing between stages. */
export interface Candidate {
  readonly symbol: string;
  /** Human-readable name snapshot. Optional — stages may not resolve it. */
  readonly name?: string;
  /** Stage-contributed score in [0, 1]. Final ordering is by composite score. */
  readonly score?: number;
  /** Per-stage score breakdown; keyed by stage name. */
  readonly scoreBreakdown?: Record<string, number>;
  /** Tags applied by stages (e.g. "leader", "value", "regime-ok"). */
  readonly tags?: ReadonlyArray<string>;
  /** Stage-attached notes useful for debugging or UI tooltips. */
  readonly notes?: Record<string, string>;
}

/** Context threaded through every stage. Immutable per run. */
export interface FunnelContext {
  /** Unique identifier for this funnel execution — used as cache key and trace id. */
  readonly runId: string;
  /** PIT anchor. Every historical query must respect this date. */
  readonly asOfDate: string;
  /** Absolute epoch ms when the run started. */
  readonly startTime: number;
  /** Caller-supplied options (e.g. universe spec, risk dial values). */
  readonly options: Readonly<Record<string, unknown>>;
  /** Optional user id for audit/billing. */
  readonly userId?: string;
  /** Feature flags / experiment toggles. */
  readonly flags: Readonly<Record<string, boolean>>;
}

/** Evaluation metrics emitted by a single stage run. */
export interface StageEval {
  readonly stageName: string;
  readonly stageIndex: number;
  readonly inputSize: number;
  readonly outputSize: number;
  /** outputSize / max(inputSize, 1). */
  readonly keepRatio: number;
  readonly durationMs: number;
  /** Stage-specific numeric/string metrics for dashboards. */
  readonly metrics: Readonly<Record<string, number | string>>;
  /** Non-fatal warnings (e.g. "sector snapshot missing, falling back"). */
  readonly warnings: ReadonlyArray<string>;
}

/** Final run summary produced after the last stage. */
export interface FunnelResult {
  readonly runId: string;
  readonly asOfDate: string;
  readonly durationMs: number;
  readonly candidates: ReadonlyArray<Candidate>;
  readonly evals: ReadonlyArray<StageEval>;
  /** Error info if a stage threw. null = success. */
  readonly error: FunnelError | null;
}

export interface FunnelError {
  readonly stageName: string;
  readonly stageIndex: number;
  readonly message: string;
  readonly code: string;
}

/** Signature every stage implements. */
export interface Stage {
  readonly name: string;
  /** Index in the pipeline (0..N-1). Set by `buildPipeline`. */
  index: number;
  /**
   * Transform candidates and emit an eval record.
   * A stage may throw — the pipeline wraps errors with FunnelError.
   */
  run(
    candidates: ReadonlyArray<Candidate>,
    context: FunnelContext
  ): Promise<StageRunOutput>;
}

export interface StageRunOutput {
  readonly candidates: ReadonlyArray<Candidate>;
  /** Metrics and warnings specific to this stage execution. */
  readonly metrics?: Readonly<Record<string, number | string>>;
  readonly warnings?: ReadonlyArray<string>;
}

/** Event emitted to the stream API as the funnel progresses. */
export type FunnelEvent =
  | { readonly kind: 'run-start'; readonly runId: string; readonly asOfDate: string }
  | {
      readonly kind: 'stage-start';
      readonly runId: string;
      readonly stageName: string;
      readonly stageIndex: number;
      readonly inputSize: number;
    }
  | {
      readonly kind: 'stage-end';
      readonly runId: string;
      readonly eval: StageEval;
      readonly sampleCandidates: ReadonlyArray<Candidate>;
    }
  | {
      readonly kind: 'run-complete';
      readonly runId: string;
      readonly result: FunnelResult;
    }
  | {
      readonly kind: 'run-error';
      readonly runId: string;
      readonly error: FunnelError;
    };

export type FunnelEventListener = (event: FunnelEvent) => void;
