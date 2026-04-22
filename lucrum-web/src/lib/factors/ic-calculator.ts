/**
 * Information Coefficient (IC) & related factor-quality metrics.
 *
 * IC     — Pearson correlation between factor z-scores and forward returns.
 * RankIC — Spearman rank correlation (more robust to fat tails).
 * IR     — Information Ratio: mean(IC series) / stdev(IC series) over periods.
 *
 * All functions return `null` when the input lacks sufficient overlap.
 *
 * @module lib/factors/ic-calculator
 */

import type { FactorValues } from './types';
import { mean, sampleStdev } from './calculators/kline-helpers';

export interface ICPoint {
  /** Which as-of date the factor snapshot was taken. */
  readonly asOfDate: string;
  /** IC for that date. */
  readonly ic: number;
}

function buildPairs(
  factor: FactorValues,
  forwardReturn: ReadonlyMap<string, number | null>
): Array<{ x: number; y: number }> {
  const pairs: Array<{ x: number; y: number }> = [];
  factor.forEach((fx, symbol) => {
    if (fx === null || !Number.isFinite(fx)) return;
    const fr = forwardReturn.get(symbol);
    if (fr === null || fr === undefined || !Number.isFinite(fr)) return;
    pairs.push({ x: fx, y: fr });
  });
  return pairs;
}

function pearson(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let varx = 0;
  let vary = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    cov += dx * dy;
    varx += dx * dx;
    vary += dy * dy;
  }
  if (varx === 0 || vary === 0) return null;
  return cov / Math.sqrt(varx * vary);
}

function ranks(xs: ReadonlyArray<number>): number[] {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const out = new Array<number>(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (
      j + 1 < indexed.length &&
      indexed[j + 1]!.v === indexed[i]!.v
    ) {
      j += 1;
    }
    // Average rank for ties (1-indexed).
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      out[indexed[k]!.i] = avg;
    }
    i = j + 1;
  }
  return out;
}

/**
 * Pearson correlation between factor values and forward returns.
 * Returns null when fewer than 3 overlapping finite observations.
 */
export function computeIC(
  factor: FactorValues,
  forwardReturn: ReadonlyMap<string, number | null>
): number | null {
  const pairs = buildPairs(factor, forwardReturn);
  if (pairs.length < 3) return null;
  return pearson(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y)
  );
}

/**
 * Spearman rank correlation. More robust to outliers than Pearson.
 */
export function computeRankIC(
  factor: FactorValues,
  forwardReturn: ReadonlyMap<string, number | null>
): number | null {
  const pairs = buildPairs(factor, forwardReturn);
  if (pairs.length < 3) return null;
  const rx = ranks(pairs.map((p) => p.x));
  const ry = ranks(pairs.map((p) => p.y));
  return pearson(rx, ry);
}

/** Information ratio over a series of IC values. */
export function computeIR(ics: ReadonlyArray<number>): number | null {
  if (ics.length < 2) return null;
  const m = mean(ics);
  const s = sampleStdev(ics);
  if (s === 0) return null;
  return m / s;
}

/** Summarise an IC series into headline metrics. */
export interface ICSummary {
  readonly meanIC: number;
  readonly stdevIC: number;
  readonly ir: number | null;
  readonly positiveRatio: number;
  readonly count: number;
}

export function summariseICSeries(points: ReadonlyArray<ICPoint>): ICSummary {
  const ics = points.map((p) => p.ic).filter((v) => Number.isFinite(v));
  if (ics.length === 0) {
    return { meanIC: 0, stdevIC: 0, ir: null, positiveRatio: 0, count: 0 };
  }
  const m = mean(ics);
  const s = sampleStdev(ics);
  const pos = ics.filter((v) => v > 0).length;
  return {
    meanIC: m,
    stdevIC: s,
    ir: s === 0 ? null : m / s,
    positiveRatio: pos / ics.length,
    count: ics.length,
  };
}
