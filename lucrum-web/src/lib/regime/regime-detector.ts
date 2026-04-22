/**
 * Regime detector.
 *
 * Rule-based classifier over 20D/60D moving averages, realized volatility,
 * and short/medium-term returns. Keeping it rule-based (not ML) means:
 *   - Results are explainable to users and auditors.
 *   - No model-drift surprises in production.
 *   - Easy to tune thresholds per market without retraining.
 *
 * Inputs: a reference series of daily bars (typically an index or an
 * equal-weight proxy built from the universe). No peek-past; the caller
 * is responsible for passing bars with date ≤ asOfDate.
 *
 * @module lib/regime/regime-detector
 */

import type { FactorKlineBar } from '@/lib/factors';
import {
  adjustedClose,
  logReturns,
  mean,
  sampleStdev,
} from '@/lib/factors/calculators/kline-helpers';
import type { Regime, RegimeDetection, RegimeSignals } from './types';

const TRADING_DAYS_PER_YEAR = 252;

export interface DetectRegimeArgs {
  readonly bars: ReadonlyArray<FactorKlineBar>;
  readonly asOfDate: string;
  /** Override rule thresholds for testing or regional tuning. */
  readonly thresholds?: Partial<RegimeThresholds>;
}

export interface RegimeThresholds {
  /** Bull requires close/MA20 > +2% and MA20/MA60 > +2%. */
  readonly bullTrend: number;
  /** Bear requires close/MA20 < -2% and MA20/MA60 < -2%. */
  readonly bearTrend: number;
  /** Rebound requires below MA60 but strong recent return. */
  readonly reboundReturn20d: number;
  /** High-vol threshold (annualized). */
  readonly highVol: number;
  /** Low-vol threshold (annualized). */
  readonly lowVol: number;
}

const DEFAULT_THRESHOLDS: RegimeThresholds = {
  bullTrend: 0.02,
  bearTrend: -0.02,
  reboundReturn20d: 0.05,
  highVol: 0.35,
  lowVol: 0.18,
};

function sma(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return mean(values);
}

function computeSignals(bars: ReadonlyArray<FactorKlineBar>): RegimeSignals {
  const closes = bars.map(adjustedClose);
  const n = closes.length;

  const ma20 = n >= 20 ? sma(closes.slice(-20)) : null;
  const ma60 = n >= 60 ? sma(closes.slice(-60)) : null;
  const lastClose = closes[n - 1] ?? null;

  const closeVsMa20 =
    lastClose !== null && ma20 !== null && ma20 > 0
      ? lastClose / ma20 - 1
      : null;
  const ma20VsMa60 =
    ma20 !== null && ma60 !== null && ma60 > 0 ? ma20 / ma60 - 1 : null;

  let return20d: number | null = null;
  if (n >= 21 && lastClose !== null) {
    const p20 = closes[n - 21];
    if (p20 !== undefined && p20 > 0) {
      return20d = lastClose / p20 - 1;
    }
  }

  let return60d: number | null = null;
  if (n >= 61 && lastClose !== null) {
    const p60 = closes[n - 61];
    if (p60 !== undefined && p60 > 0) {
      return60d = lastClose / p60 - 1;
    }
  }

  const realizedVol20d = (() => {
    if (n < 22) return null;
    const rets = logReturns(closes.slice(-21));
    if (rets.length < 5) return null;
    return sampleStdev(rets) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  })();

  const volumeRatio = (() => {
    if (n < 60) return null;
    const short = bars.slice(-20).map((b) => b.volume);
    const long = bars.slice(-60).map((b) => b.volume);
    const ms = mean(short);
    const ml = mean(long);
    if (ml <= 0) return null;
    return ms / ml;
  })();

  return {
    closeVsMa20,
    ma20VsMa60,
    realizedVol20d,
    return20d,
    return60d,
    volumeRatio,
  };
}

function classify(
  signals: RegimeSignals,
  thresholds: RegimeThresholds
): { regime: Regime; reasoning: string[] } {
  const reasoning: string[] = [];
  const {
    closeVsMa20,
    ma20VsMa60,
    realizedVol20d,
    return20d,
    return60d,
  } = signals;

  // Bull: positive trend in both short and medium MAs.
  if (
    closeVsMa20 !== null &&
    ma20VsMa60 !== null &&
    closeVsMa20 > thresholds.bullTrend &&
    ma20VsMa60 > thresholds.bullTrend &&
    (realizedVol20d === null || realizedVol20d < thresholds.highVol)
  ) {
    reasoning.push(
      `close/MA20 = ${(closeVsMa20 * 100).toFixed(2)}% > ${(thresholds.bullTrend * 100).toFixed(1)}%`
    );
    reasoning.push(
      `MA20/MA60 = ${(ma20VsMa60 * 100).toFixed(2)}% > ${(thresholds.bullTrend * 100).toFixed(1)}%`
    );
    if (realizedVol20d !== null) {
      reasoning.push(
        `realized vol ${(realizedVol20d * 100).toFixed(1)}% < high-vol ${(thresholds.highVol * 100).toFixed(0)}%`
      );
    }
    return { regime: 'bull', reasoning };
  }

  // Bear: negative trend in both MAs, especially with medium-term losses.
  if (
    closeVsMa20 !== null &&
    ma20VsMa60 !== null &&
    closeVsMa20 < thresholds.bearTrend &&
    ma20VsMa60 < thresholds.bearTrend &&
    (return60d === null || return60d < thresholds.bearTrend * 2)
  ) {
    reasoning.push(
      `close/MA20 = ${(closeVsMa20 * 100).toFixed(2)}% < ${(thresholds.bearTrend * 100).toFixed(1)}%`
    );
    reasoning.push(
      `MA20/MA60 = ${(ma20VsMa60 * 100).toFixed(2)}% < ${(thresholds.bearTrend * 100).toFixed(1)}%`
    );
    if (return60d !== null) {
      reasoning.push(`60D return ${(return60d * 100).toFixed(1)}% confirms downtrend`);
    }
    return { regime: 'bear', reasoning };
  }

  // Rebound: short-term up while medium-term still below MA60 — classic bottom reversal.
  if (
    return20d !== null &&
    return20d > thresholds.reboundReturn20d &&
    ma20VsMa60 !== null &&
    ma20VsMa60 < 0
  ) {
    reasoning.push(
      `20D return ${(return20d * 100).toFixed(1)}% > ${(thresholds.reboundReturn20d * 100).toFixed(0)}%`
    );
    reasoning.push(`but MA20 still below MA60 → recovering from below`);
    return { regime: 'rebound', reasoning };
  }

  // Sideways fallback.
  reasoning.push('no strong bull/bear/rebound signal; defaulting to sideways');
  if (realizedVol20d !== null) {
    reasoning.push(
      `realized vol ${(realizedVol20d * 100).toFixed(1)}% within range`
    );
  }
  return { regime: 'sideways', reasoning };
}

function confidenceFrom(
  signals: RegimeSignals,
  regime: Regime,
  thresholds: RegimeThresholds
): number {
  // Distance from the decision boundary → confidence proxy.
  const close = signals.closeVsMa20 ?? 0;
  const ma = signals.ma20VsMa60 ?? 0;
  const r20 = signals.return20d ?? 0;

  switch (regime) {
    case 'bull': {
      const margin = Math.min(
        close - thresholds.bullTrend,
        ma - thresholds.bullTrend
      );
      return Math.max(0.5, Math.min(1, 0.5 + margin * 10));
    }
    case 'bear': {
      const margin = Math.min(
        thresholds.bearTrend - close,
        thresholds.bearTrend - ma
      );
      return Math.max(0.5, Math.min(1, 0.5 + margin * 10));
    }
    case 'rebound': {
      const margin = r20 - thresholds.reboundReturn20d;
      return Math.max(0.5, Math.min(1, 0.5 + margin * 5));
    }
    default:
      return 0.5;
  }
}

export function detectRegime(args: DetectRegimeArgs): RegimeDetection {
  const thresholds: RegimeThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...args.thresholds,
  };
  const signals = computeSignals(args.bars);
  const { regime, reasoning } = classify(signals, thresholds);
  const confidence = confidenceFrom(signals, regime, thresholds);

  return {
    regime,
    confidence,
    signals,
    reasoning,
    asOfDate: args.asOfDate,
  };
}

export { DEFAULT_THRESHOLDS };
