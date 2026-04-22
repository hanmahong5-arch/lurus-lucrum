/**
 * Market regime — core types.
 *
 * Four-way classification designed to answer "which strategy packs fit
 * today?". Intentionally coarse; additional state (e.g. risk-on/risk-off
 * cross-asset) can be layered later without breaking the enum.
 *
 * @module lib/regime/types
 */

export type Regime = 'bull' | 'bear' | 'sideways' | 'rebound';

export interface RegimeSignals {
  /** Last close relative to 20-day SMA: (close - ma20) / ma20 */
  readonly closeVsMa20: number | null;
  /** 20-day SMA relative to 60-day SMA. */
  readonly ma20VsMa60: number | null;
  /** Realized vol annualized, last 20 days. */
  readonly realizedVol20d: number | null;
  /** Cumulative return over last 20 trading days. */
  readonly return20d: number | null;
  /** Cumulative return over last 60 trading days. */
  readonly return60d: number | null;
  /** 20-day avg volume relative to 60-day avg volume. */
  readonly volumeRatio: number | null;
}

export interface RegimeDetection {
  readonly regime: Regime;
  /** Confidence in [0, 1]. Low values indicate borderline classification. */
  readonly confidence: number;
  readonly signals: RegimeSignals;
  /** Human-readable reasoning for dashboards and audit. */
  readonly reasoning: ReadonlyArray<string>;
  /** As-of anchor used for the classification. */
  readonly asOfDate: string;
}
