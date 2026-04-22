/**
 * Deflated Sharpe Ratio (DSR).
 *
 * Raw Sharpe ratios are systematically inflated by:
 *   1. The number of trials (parameter combinations) explored.
 *   2. Non-normal return distributions (negative skew, fat tails).
 *
 * The Deflated Sharpe Ratio corrects for both. It returns the probability
 * that the *true* Sharpe is > 0 given these biases. A DSR > 0.95 is a
 * standard quant threshold for "this isn't just noise".
 *
 * Reference: Bailey, López de Prado (2014), "The Deflated Sharpe Ratio:
 * Correcting for Selection Bias, Backtest Overfitting, and Non-Normality".
 *
 * @module lib/backtest/validation/deflated-sharpe
 */

import { normalCdf, skewness, kurtosis } from './stats-helpers';
import type { ReturnSeries } from './types';

const EULER_MASCHERONI = 0.5772156649015329;
const TRADING_DAYS_PER_YEAR = 252;

export interface DSRArgs {
  readonly returns: ReturnSeries;
  /** Observed (un-deflated) annualised Sharpe of the selected strategy. */
  readonly observedSharpe: number;
  /**
   * Variance of Sharpes across all trials (parameter search space).
   * If unavailable, supply 1 (effectively no selection-bias correction).
   */
  readonly sharpeVariance: number;
  /** Number of independent trials the search visited. Must be >= 1. */
  readonly trials: number;
}

export interface DSRResult {
  readonly deflatedSharpe: number;
  readonly probabilitySharpeGtZero: number;
  readonly expectedMaxSharpeUnderNull: number;
  readonly threshold95: boolean;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Expected max of N iid standard normals using Clark & Bailey approximation.
 * Used to estimate how much "best among N trials" inflates Sharpe under the
 * null hypothesis of zero true skill.
 */
function expectedMaxOfStdNormal(n: number): number {
  if (n <= 1) return 0;
  // E[max Z_i] ≈ (1 - γ) · Φ⁻¹(1 - 1/N) + γ · Φ⁻¹(1 - 1/(N·e))
  const invCdf1 = inverseNormalCdf(1 - 1 / n);
  const invCdf2 = inverseNormalCdf(1 - 1 / (n * Math.E));
  return (1 - EULER_MASCHERONI) * invCdf1 + EULER_MASCHERONI * invCdf2;
}

/**
 * Beasley-Springer-Moro style inverse normal CDF. Accurate to ~1e-9 in
 * the central 99.9% of the distribution.
 */
function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]! /
          ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!
      ) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  q = p - 0.5;
  const r = q * q;
  return (
    (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) *
    q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

export function computeDSR(args: DSRArgs): DSRResult {
  const warnings: string[] = [];
  const { returns, observedSharpe, sharpeVariance } = args;
  const trials = Math.max(1, Math.floor(args.trials));
  const n = returns.length;

  if (n < 30) {
    warnings.push(`return series only ${n} bars; DSR unreliable`);
  }

  const skew = skewness(returns);
  const kurt = kurtosis(returns) + 3; // kurtosis() returns excess; here we need raw
  const sharpeDaily = observedSharpe / Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Expected max SR under null hypothesis (zero true Sharpe):
  // SR* = sqrt(V[SR]) * E[max Z_N]
  const expectedMaxUnderNull =
    Math.sqrt(Math.max(0, sharpeVariance)) * expectedMaxOfStdNormal(trials);

  // Test statistic (annualised Sharpe scale).
  const numerator = (observedSharpe - expectedMaxUnderNull) * Math.sqrt(n - 1);
  const denomSquared =
    1 - skew * sharpeDaily + ((kurt - 1) / 4) * sharpeDaily * sharpeDaily;
  const denom = Math.sqrt(Math.max(1e-9, denomSquared));
  const dsr = numerator / denom;
  const probability = normalCdf(dsr);

  return {
    deflatedSharpe: dsr,
    probabilitySharpeGtZero: probability,
    expectedMaxSharpeUnderNull: expectedMaxUnderNull,
    threshold95: probability > 0.95,
    warnings,
  };
}
