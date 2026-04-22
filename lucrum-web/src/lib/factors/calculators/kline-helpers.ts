/**
 * Shared numeric helpers for kline-based factor calculators.
 *
 * @module lib/factors/calculators/kline-helpers
 */

import type { FactorKlineBar } from '../types';

export function adjustedClose(bar: FactorKlineBar): number {
  return bar.close * (bar.adjFactor || 1);
}

export function adjustedHigh(bar: FactorKlineBar): number {
  return bar.high * (bar.adjFactor || 1);
}

export function adjustedLow(bar: FactorKlineBar): number {
  return bar.low * (bar.adjFactor || 1);
}

/**
 * Log returns from a series of adjusted closes.
 * Returns an array of length n-1; rejects non-positive prices.
 */
export function logReturns(closes: ReadonlyArray<number>): number[] {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (
      prev === undefined ||
      curr === undefined ||
      prev <= 0 ||
      curr <= 0
    ) {
      continue;
    }
    rets.push(Math.log(curr / prev));
  }
  return rets;
}

export function sampleStdev(xs: ReadonlyArray<number>): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  let mean = 0;
  for (const v of xs) mean += v;
  mean /= n;
  let sq = 0;
  for (const v of xs) sq += (v - mean) ** 2;
  return Math.sqrt(sq / (n - 1));
}

export function mean(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}
