/**
 * Cross-sectional scorer.
 *
 * Given a FactorMatrix and weights, produce a composite score per symbol:
 *   1. Winsorise each factor column at [lo, hi] percentiles.
 *   2. Z-score each column on the cross-section.
 *   3. Flip sign for `lower-better` factors.
 *   4. Weighted sum of z-scores (skipping factors with all-null values).
 *   5. Map composite to [0, 1] via cumulative distribution rank.
 *
 * @module lib/factors/cross-section-scorer
 */

import type {
  FactorDefinition,
  FactorId,
  FactorMatrix,
  FactorValues,
} from './types';
import { mean, sampleStdev } from './calculators/kline-helpers';

export interface FactorWeight {
  readonly factorId: FactorId;
  readonly weight: number;
}

export interface ComputeFactorMatrixArgs {
  readonly symbols: ReadonlyArray<string>;
  readonly factors: ReadonlyArray<FactorDefinition>;
  readonly compute: (def: FactorDefinition) => Promise<FactorValues>;
}

export async function computeFactorMatrix(
  args: ComputeFactorMatrixArgs
): Promise<FactorMatrix> {
  const values = new Map<FactorId, FactorValues>();
  for (const f of args.factors) {
    values.set(f.id, await args.compute(f));
  }
  return {
    symbols: args.symbols,
    factorIds: args.factors.map((f) => f.id),
    values,
  };
}

export interface ScoreOptions {
  /** Percentile clips for winsorisation (default 1% / 99%). */
  readonly winsorLow?: number;
  readonly winsorHigh?: number;
  /** Minimum finite observations before a factor column is used. */
  readonly minCoverage?: number;
}

export interface SymbolScore {
  readonly symbol: string;
  /** Final composite in [0, 1] via CDF rank. */
  readonly score: number;
  /** Raw weighted-z composite pre-rank mapping. */
  readonly raw: number;
  /** Per-factor z-score breakdown (after direction flip). */
  readonly breakdown: Readonly<Record<FactorId, number | null>>;
}

export interface CrossSectionScoreResult {
  readonly scores: ReadonlyArray<SymbolScore>;
  readonly factorsUsed: ReadonlyArray<FactorId>;
  readonly factorsSkipped: ReadonlyArray<FactorId>;
  readonly warnings: ReadonlyArray<string>;
}

function percentileClip(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    Math.max(0, Math.floor(p * (sorted.length - 1))),
    sorted.length - 1
  );
  return sorted[idx] ?? 0;
}

function winsoriseAndStandardise(
  raw: ReadonlyArray<number | null>,
  winsorLow: number,
  winsorHigh: number
): Array<number | null> {
  const finite = raw.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length < 3) {
    // Not enough observations — return nulls.
    return raw.map(() => null);
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const lo = percentileClip(sorted, winsorLow);
  const hi = percentileClip(sorted, winsorHigh);

  const clipped = raw.map((v) =>
    v === null ? null : Math.min(hi, Math.max(lo, v))
  );
  const cf = clipped.filter((v): v is number => v !== null);
  const m = mean(cf);
  const s = sampleStdev(cf);
  if (s === 0) {
    return clipped.map(() => 0);
  }
  return clipped.map((v) => (v === null ? null : (v - m) / s));
}

function cdfRank(values: ReadonlyArray<number>): number[] {
  // Map each value to its percentile rank in (0, 1].
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of values) {
    // Average-rank approach for ties.
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const midVal = sorted[mid];
      if (midVal === undefined || midVal < v) lo = mid + 1;
      else hi = mid;
    }
    let hi2 = lo;
    while (hi2 < sorted.length && sorted[hi2] === v) hi2 += 1;
    const rank = (lo + hi2) / 2;
    out.push((rank + 0.5) / sorted.length);
  }
  return out;
}

export function scoreCrossSection(
  matrix: FactorMatrix,
  definitions: ReadonlyArray<FactorDefinition>,
  weights: ReadonlyArray<FactorWeight>,
  options: ScoreOptions = {}
): CrossSectionScoreResult {
  const winsorLow = options.winsorLow ?? 0.01;
  const winsorHigh = options.winsorHigh ?? 0.99;
  const minCoverage = options.minCoverage ?? 3;

  const defById = new Map(definitions.map((d) => [d.id, d]));
  const warnings: string[] = [];
  const used: FactorId[] = [];
  const skipped: FactorId[] = [];

  // Column-oriented: factorId → array aligned to matrix.symbols.
  const zScoreColumns = new Map<FactorId, Array<number | null>>();
  const normalisedWeights = new Map<FactorId, number>();

  let totalWeight = 0;
  for (const w of weights) {
    const def = defById.get(w.factorId);
    const col = matrix.values.get(w.factorId);
    if (!def || !col) {
      skipped.push(w.factorId);
      warnings.push(`factor ${w.factorId} missing from matrix; skipped`);
      continue;
    }
    const raw: Array<number | null> = matrix.symbols.map(
      (s) => col.get(s) ?? null
    );
    const finite = raw.filter((v) => v !== null && Number.isFinite(v));
    if (finite.length < minCoverage) {
      skipped.push(w.factorId);
      warnings.push(
        `factor ${w.factorId} coverage ${finite.length} < min ${minCoverage}; skipped`
      );
      continue;
    }
    let z = winsoriseAndStandardise(raw, winsorLow, winsorHigh);
    if (def.direction === 'lower-better') {
      z = z.map((v) => (v === null ? null : -v));
    }
    zScoreColumns.set(w.factorId, z);
    normalisedWeights.set(w.factorId, w.weight);
    totalWeight += Math.abs(w.weight);
    used.push(w.factorId);
  }

  if (totalWeight === 0) {
    return {
      scores: matrix.symbols.map((s) => ({
        symbol: s,
        score: 0,
        raw: 0,
        breakdown: {},
      })),
      factorsUsed: [],
      factorsSkipped: skipped,
      warnings: [...warnings, 'no factors contributed to score'],
    };
  }

  const raw: number[] = [];
  const breakdowns: Array<Record<FactorId, number | null>> = [];

  for (let i = 0; i < matrix.symbols.length; i++) {
    let sum = 0;
    let weightAcc = 0;
    const breakdown: Record<FactorId, number | null> = {};
    for (const fid of used) {
      const col = zScoreColumns.get(fid);
      if (!col) continue;
      const v = col[i] ?? null;
      breakdown[fid] = v;
      if (v === null || !Number.isFinite(v)) continue;
      const w = normalisedWeights.get(fid) ?? 0;
      sum += v * w;
      weightAcc += Math.abs(w);
    }
    const rawScore = weightAcc === 0 ? 0 : sum / weightAcc;
    raw.push(rawScore);
    breakdowns.push(breakdown);
  }

  const rankScores = cdfRank(raw);

  const scores: SymbolScore[] = matrix.symbols.map((symbol, i) => ({
    symbol,
    score: rankScores[i] ?? 0,
    raw: raw[i] ?? 0,
    breakdown: breakdowns[i] ?? {},
  }));

  return { scores, factorsUsed: used, factorsSkipped: skipped, warnings };
}
