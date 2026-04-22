/**
 * Bootstrap confidence intervals for backtest metrics.
 *
 * Produces a percentile CI for any caller-supplied statistic by resampling
 * the return series with replacement. For return statistics like
 * annualised return or Sharpe this gives a model-free confidence band —
 * particularly useful when the return distribution is non-normal.
 *
 * The RNG is a deterministic xorshift128+ seeded from the run id so
 * results are reproducible across invocations.
 *
 * @module lib/backtest/validation/bootstrap-ci
 */

import { annualisedSharpe } from './stats-helpers';
import type { ReturnSeries } from './types';

const TRADING_DAYS_PER_YEAR = 252;

export interface BootstrapArgs<T> {
  readonly series: ReturnSeries;
  readonly statistic: (sample: ReturnSeries) => T;
  readonly resamples?: number;
  /** Confidence level — default 95%. */
  readonly confidence?: number;
  /** Optional deterministic seed (integer). */
  readonly seed?: number;
}

export interface BootstrapResult<T> {
  readonly point: T;
  readonly lower: T;
  readonly upper: T;
  readonly resamples: number;
}

/** xorshift32 PRNG — small, fast, deterministic. */
function makeRng(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function resample<T>(
  xs: ReturnSeries,
  n: number,
  rng: () => number
): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * xs.length) % xs.length;
    out[i] = xs[idx] ?? 0;
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

export function bootstrapNumber(
  args: BootstrapArgs<number>
): BootstrapResult<number> {
  const resamples = args.resamples ?? 1000;
  const conf = args.confidence ?? 0.95;
  const seed = args.seed ?? 0xC0FFEE;
  const rng = makeRng(seed);

  const n = args.series.length;
  if (n < 20) {
    const point = args.statistic(args.series);
    return { point, lower: point, upper: point, resamples: 0 };
  }

  const estimates: number[] = new Array(resamples);
  for (let i = 0; i < resamples; i++) {
    const sample = resample(args.series, n, rng);
    estimates[i] = args.statistic(sample);
  }
  estimates.sort((a, b) => a - b);

  const alpha = (1 - conf) / 2;
  return {
    point: args.statistic(args.series),
    lower: percentile(estimates, alpha),
    upper: percentile(estimates, 1 - alpha),
    resamples,
  };
}

/** Convenience wrapper for annualised Sharpe CI. */
export function bootstrapSharpeCI(
  series: ReturnSeries,
  resamples = 1000,
  seed?: number
): BootstrapResult<number> {
  return bootstrapNumber({
    series,
    statistic: (s) => annualisedSharpe(s),
    resamples,
    seed,
  });
}

/** Convenience wrapper for annualised return CI. */
export function bootstrapAnnualReturnCI(
  series: ReturnSeries,
  resamples = 1000,
  seed?: number
): BootstrapResult<number> {
  return bootstrapNumber({
    series,
    statistic: (s) => {
      if (s.length === 0) return 0;
      let sum = 0;
      for (const v of s) sum += v;
      return (sum / s.length) * TRADING_DAYS_PER_YEAR;
    },
    resamples,
    seed,
  });
}
