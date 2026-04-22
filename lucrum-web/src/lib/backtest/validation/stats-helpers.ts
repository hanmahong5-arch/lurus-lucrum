/**
 * Numeric helpers shared by validation modules.
 *
 * Kept private to `validation/` so the public Statistics module isn't
 * forced to grow for test-only helpers.
 *
 * @module lib/backtest/validation/stats-helpers
 */

import type { ReturnSeries } from './types';

const TRADING_DAYS_PER_YEAR = 252;

export function mean(xs: ReturnSeries): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

export function stdev(xs: ReturnSeries): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let sq = 0;
  for (const v of xs) sq += (v - m) ** 2;
  return Math.sqrt(sq / (xs.length - 1));
}

export function skewness(xs: ReturnSeries): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = stdev(xs);
  if (s === 0) return 0;
  let sum3 = 0;
  for (const v of xs) sum3 += ((v - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum3;
}

export function kurtosis(xs: ReturnSeries): number {
  // Excess kurtosis (0 for normal).
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = stdev(xs);
  if (s === 0) return 0;
  let sum4 = 0;
  for (const v of xs) sum4 += ((v - m) / s) ** 4;
  const num = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const penalty = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return num * sum4 - penalty;
}

export function annualisedSharpe(
  returns: ReturnSeries,
  riskFree = 0
): number {
  if (returns.length < 2) return 0;
  const m = mean(returns) - riskFree / TRADING_DAYS_PER_YEAR;
  const s = stdev(returns);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Standard-normal CDF via Abramowitz & Stegun 26.2.17. Accurate to ~7 decimals.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}
