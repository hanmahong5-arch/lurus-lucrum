/**
 * Probability of Backtest Overfitting (PBO) — Bailey & López de Prado.
 *
 * We use the Combinatorially Symmetric Cross-Validation (CSCV) procedure:
 *
 *   1. Concatenate M candidate strategies' daily returns into an N×M matrix.
 *   2. Split rows into S equal consecutive chunks (S even; S=16 by default).
 *   3. For every way to pick S/2 chunks as "training":
 *        a. Best-in-train strategy m* = argmax Sharpe over the selected chunks.
 *        b. Look up m*'s rank across all M strategies in the *remaining*
 *           chunks (smaller rank = better test performance).
 *        c. Compute logit ω = rank-fraction / (1 - rank-fraction); if the
 *           in-sample winner ends up in the bottom half out-of-sample
 *           (ω < 1 → λ = ln(ω) < 0) count the partition as overfit.
 *   4. PBO = #overfit-partitions / #total-partitions ∈ [0, 1].
 *
 * References: Bailey, Borwein, López de Prado, Zhu (2014).
 * "The Probability of Backtest Overfitting".
 *
 * @module lib/backtest/validation/pbo
 */

import { annualisedSharpe } from './stats-helpers';
import type { ReturnSeries } from './types';

export interface PBOArgs {
  /** One ReturnSeries per candidate strategy. All must have the same length. */
  readonly candidates: ReadonlyArray<ReturnSeries>;
  /** Even integer; number of chunks to split the series into. Default 16. */
  readonly chunks?: number;
}

export interface PBOResult {
  readonly pbo: number;
  readonly partitions: number;
  readonly overfitPartitions: number;
  /** Distribution of logit-ω across partitions for histogram plotting. */
  readonly logits: ReadonlyArray<number>;
  readonly warnings: ReadonlyArray<string>;
}

function enumerateCombinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const picks: number[] = [];
  const walk = (start: number) => {
    if (picks.length === k) {
      result.push([...picks]);
      return;
    }
    for (let i = start; i < n; i++) {
      picks.push(i);
      walk(i + 1);
      picks.pop();
    }
  };
  walk(0);
  return result;
}

/**
 * Rank-fraction of strategy index m in an array of Sharpes (1 = best).
 * Returns value in (0, 1] — exactly 0 would make the logit undefined so
 * we clamp to [1/(M+1), M/(M+1)] before taking the logit.
 */
function rankFraction(sharpes: number[], m: number): number {
  const target = sharpes[m] ?? 0;
  // Rank: 1 = highest Sharpe.
  let strictlyGreater = 0;
  let equal = 0;
  for (let i = 0; i < sharpes.length; i++) {
    const v = sharpes[i] ?? 0;
    if (v > target) strictlyGreater += 1;
    else if (v === target) equal += 1;
  }
  const rank = strictlyGreater + (equal + 1) / 2;
  return rank / (sharpes.length + 1);
}

export function computePBO(args: PBOArgs): PBOResult {
  const warnings: string[] = [];
  const M = args.candidates.length;
  if (M < 2) {
    return {
      pbo: 0,
      partitions: 0,
      overfitPartitions: 0,
      logits: [],
      warnings: ['PBO requires at least 2 candidate strategies'],
    };
  }
  const N = args.candidates[0]?.length ?? 0;
  if (N < 40) {
    return {
      pbo: 0,
      partitions: 0,
      overfitPartitions: 0,
      logits: [],
      warnings: [`series too short (${N} bars) for meaningful PBO`],
    };
  }
  for (const c of args.candidates) {
    if (c.length !== N) {
      return {
        pbo: 0,
        partitions: 0,
        overfitPartitions: 0,
        logits: [],
        warnings: ['all candidate series must share the same length'],
      };
    }
  }

  const S = (() => {
    const requested = args.chunks ?? 16;
    if (requested % 2 !== 0 || requested < 4) return 16;
    return requested;
  })();

  if (N < S * 2) {
    warnings.push(
      `series length ${N} < 2 * chunks ${S}; shrinking chunks`
    );
  }
  const effectiveS = Math.max(4, Math.min(S, Math.floor(N / 5)));
  const effectiveEven = effectiveS % 2 === 0 ? effectiveS : effectiveS - 1;
  if (effectiveEven < 4) {
    return {
      pbo: 0,
      partitions: 0,
      overfitPartitions: 0,
      logits: [],
      warnings: [
        ...warnings,
        `unable to form ≥4 chunks from ${N} bars; PBO skipped`,
      ],
    };
  }

  // Chunk indices (inclusive ranges).
  const chunkSize = Math.floor(N / effectiveEven);
  const chunks: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < effectiveEven; i++) {
    const start = i * chunkSize;
    const end = i === effectiveEven - 1 ? N - 1 : start + chunkSize - 1;
    chunks.push({ start, end });
  }

  const combos = enumerateCombinations(effectiveEven, effectiveEven / 2);

  const logits: number[] = [];
  let overfit = 0;

  for (const combo of combos) {
    const trainFlags = new Array<boolean>(effectiveEven).fill(false);
    for (const idx of combo) trainFlags[idx] = true;

    const trainSharpe: number[] = [];
    const testSharpe: number[] = [];

    for (let m = 0; m < M; m++) {
      const series = args.candidates[m]!;
      const trainParts: number[] = [];
      const testParts: number[] = [];
      for (let c = 0; c < effectiveEven; c++) {
        const { start, end } = chunks[c]!;
        const slice = series.slice(start, end + 1);
        if (trainFlags[c]) trainParts.push(...slice);
        else testParts.push(...slice);
      }
      trainSharpe.push(annualisedSharpe(trainParts));
      testSharpe.push(annualisedSharpe(testParts));
    }

    // argmax train Sharpe.
    let bestM = 0;
    for (let i = 1; i < M; i++) {
      if ((trainSharpe[i] ?? 0) > (trainSharpe[bestM] ?? 0)) bestM = i;
    }

    const rf = rankFraction(testSharpe, bestM);
    // Clamp away from boundaries.
    const rc = Math.min(M / (M + 1), Math.max(1 / (M + 1), rf));
    const omega = (1 - rc) / rc; // rf=0.5 → omega=1 → λ=0
    const lambda = Math.log(omega);
    logits.push(lambda);
    if (lambda < 0) overfit += 1;
  }

  return {
    pbo: combos.length === 0 ? 0 : overfit / combos.length,
    partitions: combos.length,
    overfitPartitions: overfit,
    logits,
    warnings,
  };
}
