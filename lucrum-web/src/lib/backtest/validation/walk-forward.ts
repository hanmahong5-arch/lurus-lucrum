/**
 * Walk-forward validation.
 *
 * Splits a return series into K non-overlapping (train, test) folds and,
 * for each fold, runs a caller-supplied `selectBestParams` over the train
 * window and scores the chosen params on the test window.
 *
 * The pipeline is agnostic to what "parameters" means — strategy knobs,
 * factor weights, position-sizing constants — because the caller hands us
 * a function that turns params into a daily return series.
 *
 * Output reveals:
 *   - Avg train vs test Sharpe → generalisation ratio.
 *   - Which params won each fold → stability indicator.
 *
 * @module lib/backtest/validation/walk-forward
 */

import { annualisedSharpe } from './stats-helpers';
import type {
  FoldResult,
  ReturnSeries,
  WalkForwardFold,
  WalkForwardReport,
} from './types';

export interface ParameterCandidate {
  readonly id: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface BuildFoldsArgs {
  readonly seriesLength: number;
  readonly folds: number;
  /** Fraction of each fold used for training (0 < trainRatio < 1). */
  readonly trainRatio: number;
  /** Minimum bars each train window must cover. Folds below this are dropped. */
  readonly minTrainBars?: number;
}

export function buildFolds(args: BuildFoldsArgs): ReadonlyArray<WalkForwardFold> {
  const { seriesLength, folds, trainRatio, minTrainBars = 20 } = args;
  if (folds < 1 || trainRatio <= 0 || trainRatio >= 1) return [];

  const out: WalkForwardFold[] = [];
  const foldSize = Math.floor(seriesLength / folds);
  if (foldSize < minTrainBars + 5) return [];

  for (let i = 0; i < folds; i++) {
    const foldStart = i * foldSize;
    const foldEnd = i === folds - 1 ? seriesLength - 1 : foldStart + foldSize - 1;
    const trainEnd = foldStart + Math.floor((foldEnd - foldStart + 1) * trainRatio) - 1;
    const testStart = trainEnd + 1;
    if (trainEnd - foldStart + 1 < minTrainBars) continue;
    if (testStart > foldEnd) continue;
    out.push({
      index: i,
      trainStart: foldStart,
      trainEnd,
      testStart,
      testEnd: foldEnd,
    });
  }
  return out;
}

export interface RunWalkForwardArgs {
  /**
   * Full daily return series indexed alongside `candidates`. For each
   * candidate the caller must produce the full-length series so the
   * module can slice train/test windows consistently.
   */
  readonly candidates: ReadonlyArray<ParameterCandidate>;
  readonly candidateSeries: (candidateId: string) => ReturnSeries;
  readonly seriesLength: number;
  readonly folds?: number;
  readonly trainRatio?: number;
  readonly minTrainBars?: number;
}

export function runWalkForward(args: RunWalkForwardArgs): WalkForwardReport {
  const folds =
    args.folds ??
    Math.min(6, Math.max(3, Math.floor(args.seriesLength / 60)));
  const trainRatio = args.trainRatio ?? 0.7;

  const windows = buildFolds({
    seriesLength: args.seriesLength,
    folds,
    trainRatio,
    minTrainBars: args.minTrainBars,
  });

  const results: FoldResult[] = [];
  for (const fold of windows) {
    let best: { cand: ParameterCandidate; sharpe: number; series: ReturnSeries } | null = null;

    for (const cand of args.candidates) {
      const full = args.candidateSeries(cand.id);
      if (full.length !== args.seriesLength) continue;
      const trainSlice = full.slice(fold.trainStart, fold.trainEnd + 1);
      const sh = annualisedSharpe(trainSlice);
      if (best === null || sh > best.sharpe) {
        best = { cand, sharpe: sh, series: full };
      }
    }
    if (!best) continue;

    const testSlice = best.series.slice(fold.testStart, fold.testEnd + 1);
    const testSharpe = annualisedSharpe(testSlice);

    results.push({
      fold,
      trainSharpe: best.sharpe,
      testSharpe,
      bestParamsId: best.cand.id,
    });
  }

  const avgTrain =
    results.length === 0
      ? 0
      : results.reduce((a, r) => a + r.trainSharpe, 0) / results.length;
  const avgTest =
    results.length === 0
      ? 0
      : results.reduce((a, r) => a + r.testSharpe, 0) / results.length;
  const gen = avgTrain === 0 ? 0 : avgTest / avgTrain;

  return {
    folds: results,
    avgTrainSharpe: avgTrain,
    avgTestSharpe: avgTest,
    generalisationRatio: gen,
  };
}
