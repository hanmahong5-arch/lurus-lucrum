/**
 * Backtest validation — core types.
 *
 * Independent of the main engine so unit tests don't have to spin up a
 * full data provider.
 *
 * @module lib/backtest/validation/types
 */

/** A daily return series, e.g. strategy NAV day-over-day returns. */
export type ReturnSeries = ReadonlyArray<number>;

/** Walk-forward fold — non-overlapping train/test windows. */
export interface WalkForwardFold {
  readonly index: number;
  readonly trainStart: number;
  readonly trainEnd: number; // inclusive
  readonly testStart: number;
  readonly testEnd: number; // inclusive
}

export interface FoldResult {
  readonly fold: WalkForwardFold;
  readonly trainSharpe: number;
  readonly testSharpe: number;
  /** The single parameter set that won in-sample. Opaque to this module. */
  readonly bestParamsId: string;
}

export interface WalkForwardReport {
  readonly folds: ReadonlyArray<FoldResult>;
  readonly avgTrainSharpe: number;
  readonly avgTestSharpe: number;
  /** Ratio of test vs train Sharpe averaged across folds; lower = more overfit. */
  readonly generalisationRatio: number;
}

export interface GateVerdict<T> {
  readonly passed: boolean;
  readonly reasons: ReadonlyArray<string>;
  readonly metric: T;
}
