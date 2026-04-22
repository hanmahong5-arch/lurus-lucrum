/**
 * Capacity test — estimates how Sharpe degrades as AUM grows.
 *
 * The idea: a strategy that works at 10 万 likely does not at 10 亿 because
 * per-trade slippage scales with order size. We approximate the slippage
 * curve with a square-root impact model:
 *
 *   slippage(capital) = baseBps + k * sqrt(capital / ADV)
 *
 * where k calibrates how sensitive the market is to size (typical A-share
 * small cap: k ≈ 10 bps when capital == ADV). For each capital level we
 * subtract the extra slippage from each trade's return and recompute
 * Sharpe. Output is a curve the UI can render alongside a recommended
 * capacity ceiling.
 *
 * @module lib/backtest/validation/capacity-test
 */

import { annualisedSharpe } from './stats-helpers';
import type { ReturnSeries } from './types';

export interface CapacityPoint {
  readonly capitalCny: number;
  readonly estimatedSharpe: number;
  readonly estimatedAnnualReturn: number;
  readonly slippageBps: number;
}

export interface CapacityTestArgs {
  readonly series: ReturnSeries;
  /** Daily number of trades (rough avg). Used to scale slippage drag. */
  readonly tradesPerDay: number;
  /** Average daily volume in CNY of the tradeable universe. */
  readonly averageDailyVolumeCny: number;
  /** Capital points to evaluate (CNY). */
  readonly capitals: ReadonlyArray<number>;
  /** Baseline slippage in basis points (paid even at zero participation). */
  readonly baseSlippageBps?: number;
  /** Impact coefficient — bps per sqrt(capital / ADV). */
  readonly impactCoefficient?: number;
}

export interface CapacityTestResult {
  readonly curve: ReadonlyArray<CapacityPoint>;
  /** Suggested capacity where Sharpe drops to 70% of small-size Sharpe. */
  readonly suggestedCeilingCny: number | null;
}

const TRADING_DAYS_PER_YEAR = 252;

export function runCapacityTest(args: CapacityTestArgs): CapacityTestResult {
  const baseBps = args.baseSlippageBps ?? 5;
  const k = args.impactCoefficient ?? 10;
  const baselineSharpe = annualisedSharpe(args.series);

  const curve: CapacityPoint[] = [];
  for (const capital of args.capitals) {
    const participation = Math.max(0, capital / Math.max(1, args.averageDailyVolumeCny));
    const slippageBps = baseBps + k * Math.sqrt(participation);
    const slippageDaily = (slippageBps / 10000) * args.tradesPerDay;
    const adjusted = args.series.map((r) => r - slippageDaily);
    const sharpe = annualisedSharpe(adjusted);
    let sum = 0;
    for (const v of adjusted) sum += v;
    const annReturn = (sum / Math.max(1, adjusted.length)) * TRADING_DAYS_PER_YEAR;
    curve.push({
      capitalCny: capital,
      estimatedSharpe: sharpe,
      estimatedAnnualReturn: annReturn,
      slippageBps,
    });
  }

  const threshold = baselineSharpe * 0.7;
  const firstFail = curve.find((p) => p.estimatedSharpe < threshold);
  const suggestedCeiling =
    firstFail === undefined
      ? null
      : (() => {
          // Return the last capital whose Sharpe was still above threshold.
          const idx = curve.indexOf(firstFail);
          return idx > 0 ? curve[idx - 1]!.capitalCny : null;
        })();

  return { curve, suggestedCeilingCny: suggestedCeiling };
}
