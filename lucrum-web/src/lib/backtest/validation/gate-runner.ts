/**
 * Gate runner — one-shot aggregator over all validation checks.
 *
 * Strategy packs must PASS before being listed in the user-facing
 * recommendation surface. Anything that FAILS is still usable in the
 * "实验室" (sandbox) but won't be shown as a vetted pack.
 *
 * Default thresholds (tunable per call):
 *   - Annualised Sharpe       ≥ 1.0
 *   - Bootstrap lower 95% SR  ≥ 0
 *   - PBO                     ≤ 0.30
 *   - DSR probability         ≥ 0.90
 *   - Walk-forward gen. ratio ≥ 0.60 (when folds available)
 *
 * @module lib/backtest/validation/gate-runner
 */

import { annualisedSharpe } from './stats-helpers';
import { computePBO } from './pbo';
import { computeDSR } from './deflated-sharpe';
import { bootstrapSharpeCI } from './bootstrap-ci';
import { runWalkForward, type ParameterCandidate } from './walk-forward';
import type { ReturnSeries } from './types';

export interface GateThresholds {
  readonly minSharpe: number;
  readonly minBootstrapLower: number;
  readonly maxPBO: number;
  readonly minDSRProbability: number;
  readonly minGeneralisation: number;
}

export const DEFAULT_GATE_THRESHOLDS: GateThresholds = {
  minSharpe: 1.0,
  minBootstrapLower: 0,
  maxPBO: 0.3,
  minDSRProbability: 0.9,
  minGeneralisation: 0.6,
};

export interface GateInput {
  /** Selected strategy's daily return series. */
  readonly selectedReturns: ReturnSeries;
  /**
   * Return series for *all* trial candidates the parameter search
   * considered. If omitted, PBO/DSR will be skipped.
   */
  readonly trialReturns?: ReadonlyArray<ReturnSeries>;
  /** Number of trials in the search space. Default = trialReturns.length. */
  readonly trialsCount?: number;
  /** Candidate list for walk-forward, if provided. */
  readonly walkForwardCandidates?: ReadonlyArray<ParameterCandidate>;
  readonly walkForwardSeries?: (candidateId: string) => ReturnSeries;
  readonly walkForwardSeriesLength?: number;
  readonly thresholds?: Partial<GateThresholds>;
}

export interface GateCheckDetail {
  readonly name: string;
  readonly passed: boolean;
  readonly value: number | null;
  readonly threshold: number;
  readonly note: string;
}

export interface GateReport {
  readonly passed: boolean;
  readonly overallScore: number;
  readonly checks: ReadonlyArray<GateCheckDetail>;
  readonly warnings: ReadonlyArray<string>;
  readonly details: {
    readonly sharpe: number;
    readonly bootstrap: { readonly lower: number; readonly upper: number; readonly point: number };
    readonly pbo: number | null;
    readonly dsrProbability: number | null;
    readonly generalisationRatio: number | null;
  };
}

export function runGates(input: GateInput): GateReport {
  const thresholds: GateThresholds = {
    ...DEFAULT_GATE_THRESHOLDS,
    ...input.thresholds,
  };
  const warnings: string[] = [];

  const sharpe = annualisedSharpe(input.selectedReturns);
  const bootstrap = bootstrapSharpeCI(input.selectedReturns, 1000, 0xC0FFEE);

  let pboValue: number | null = null;
  let dsrProb: number | null = null;
  if (input.trialReturns && input.trialReturns.length >= 2) {
    const pboRes = computePBO({ candidates: input.trialReturns });
    warnings.push(...pboRes.warnings);
    pboValue = pboRes.pbo;

    // Variance of Sharpe across trials for DSR correction.
    const allSharpes = input.trialReturns.map((r) => annualisedSharpe(r));
    const meanSR =
      allSharpes.reduce((a, b) => a + b, 0) / Math.max(1, allSharpes.length);
    let variance = 0;
    for (const s of allSharpes) variance += (s - meanSR) ** 2;
    variance /= Math.max(1, allSharpes.length - 1);

    const dsr = computeDSR({
      returns: input.selectedReturns,
      observedSharpe: sharpe,
      sharpeVariance: variance,
      trials: input.trialsCount ?? input.trialReturns.length,
    });
    warnings.push(...dsr.warnings);
    dsrProb = dsr.probabilitySharpeGtZero;
  } else {
    warnings.push('trialReturns missing or < 2; PBO/DSR skipped');
  }

  let generalisation: number | null = null;
  if (
    input.walkForwardCandidates &&
    input.walkForwardSeries &&
    input.walkForwardSeriesLength
  ) {
    const wf = runWalkForward({
      candidates: input.walkForwardCandidates,
      candidateSeries: input.walkForwardSeries,
      seriesLength: input.walkForwardSeriesLength,
    });
    generalisation = wf.generalisationRatio;
  }

  const checks: GateCheckDetail[] = [];

  checks.push({
    name: 'sharpe',
    passed: sharpe >= thresholds.minSharpe,
    value: sharpe,
    threshold: thresholds.minSharpe,
    note: `annualised Sharpe ${sharpe.toFixed(2)} vs min ${thresholds.minSharpe}`,
  });
  checks.push({
    name: 'bootstrap-lower',
    passed: bootstrap.lower >= thresholds.minBootstrapLower,
    value: bootstrap.lower,
    threshold: thresholds.minBootstrapLower,
    note: `95% lower CI ${bootstrap.lower.toFixed(2)}`,
  });
  if (pboValue !== null) {
    checks.push({
      name: 'pbo',
      passed: pboValue <= thresholds.maxPBO,
      value: pboValue,
      threshold: thresholds.maxPBO,
      note: `PBO ${(pboValue * 100).toFixed(1)}% vs max ${(thresholds.maxPBO * 100).toFixed(0)}%`,
    });
  }
  if (dsrProb !== null) {
    checks.push({
      name: 'dsr',
      passed: dsrProb >= thresholds.minDSRProbability,
      value: dsrProb,
      threshold: thresholds.minDSRProbability,
      note: `DSR P(SR>0) = ${(dsrProb * 100).toFixed(1)}%`,
    });
  }
  if (generalisation !== null) {
    checks.push({
      name: 'walk-forward-generalisation',
      passed: generalisation >= thresholds.minGeneralisation,
      value: generalisation,
      threshold: thresholds.minGeneralisation,
      note: `test/train Sharpe ratio = ${generalisation.toFixed(2)}`,
    });
  }

  const passed = checks.every((c) => c.passed);
  const overallScore =
    checks.length === 0
      ? 0
      : checks.filter((c) => c.passed).length / checks.length;

  return {
    passed,
    overallScore,
    checks,
    warnings,
    details: {
      sharpe,
      bootstrap,
      pbo: pboValue,
      dsrProbability: dsrProb,
      generalisationRatio: generalisation,
    },
  };
}
