/**
 * Factor system — core types.
 *
 * A factor is a function that, given a set of candidate symbols and a
 * point-in-time anchor, produces a numeric score per symbol. Factors are
 * defined once in a registry and composed into cross-sectional models.
 *
 * @module lib/factors/types
 */

export type FactorCategory =
  | 'value'
  | 'quality'
  | 'momentum'
  | 'volatility'
  | 'liquidity'
  | 'sentiment';

/**
 * Whether bigger raw values indicate a better stock.
 *   - `higher-better`: roe, momentum — z-score is used as-is.
 *   - `lower-better`: pe, pb, volatility — z-score is negated before ranking.
 */
export type FactorDirection = 'higher-better' | 'lower-better';

/** A non-empty string that uniquely identifies a factor in the registry. */
export type FactorId = string;

/** Raw bar fed to factor calculators. Matches KLineDaily but minus ORM-specific fields. */
export interface FactorKlineBar {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  /** Turnover in CNY (成交额). Required for Amihud-style liquidity. */
  readonly amount: number | null;
  readonly adjFactor: number;
}

/**
 * Execution context threaded to every factor's compute fn.
 *
 * The `getKlines` helper is supplied by the caller so many factors can
 * share a single batched fetch — avoids N round-trips when computing
 * a dozen momentum/vol factors for 300 stocks.
 */
export interface FactorContext {
  readonly symbols: ReadonlyArray<string>;
  readonly asOfDate: string;
  /** Kline lookback window in trading days. Factors may use less than this. */
  readonly klineWindow: number;
  /** Returns kline bars for `symbol` in ascending date order, ≤ asOfDate. */
  getKlines(symbol: string): Promise<ReadonlyArray<FactorKlineBar>>;
}

/** Per-symbol factor output. `null` = insufficient data or missing input. */
export type FactorValues = ReadonlyMap<string, number | null>;

/**
 * Factor definition registered once at module load. The `compute` fn is
 * responsible for its own error handling; on failure return `null` for
 * the offending symbol rather than throwing.
 */
export interface FactorDefinition {
  readonly id: FactorId;
  readonly name: string;
  readonly category: FactorCategory;
  readonly direction: FactorDirection;
  readonly description: string;
  /** Minimum kline window the factor needs to produce a valid value. */
  readonly minKlineBars?: number;
  readonly compute: (ctx: FactorContext) => Promise<FactorValues>;
}

/** Result of computing multiple factors. Rows keyed by symbol. */
export interface FactorMatrix {
  readonly symbols: ReadonlyArray<string>;
  readonly factorIds: ReadonlyArray<FactorId>;
  /** Values indexed as values[factorId][symbol]. Missing cells are `null`. */
  readonly values: ReadonlyMap<FactorId, FactorValues>;
}
