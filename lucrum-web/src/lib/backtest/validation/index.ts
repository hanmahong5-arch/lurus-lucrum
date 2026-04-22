/**
 * Backtest validation barrel.
 *
 * @module lib/backtest/validation
 */

export type {
  ReturnSeries,
  WalkForwardFold,
  FoldResult,
  WalkForwardReport,
  GateVerdict,
} from './types';

export {
  annualisedSharpe,
  mean,
  stdev,
  skewness,
  kurtosis,
  normalCdf,
} from './stats-helpers';

export { buildFolds, runWalkForward } from './walk-forward';
export type {
  BuildFoldsArgs,
  ParameterCandidate,
  RunWalkForwardArgs,
} from './walk-forward';

export { computePBO } from './pbo';
export type { PBOArgs, PBOResult } from './pbo';

export { computeDSR } from './deflated-sharpe';
export type { DSRArgs, DSRResult } from './deflated-sharpe';

export {
  bootstrapNumber,
  bootstrapSharpeCI,
  bootstrapAnnualReturnCI,
} from './bootstrap-ci';
export type { BootstrapArgs, BootstrapResult } from './bootstrap-ci';

export { runCapacityTest } from './capacity-test';
export type {
  CapacityPoint,
  CapacityTestArgs,
  CapacityTestResult,
} from './capacity-test';

export {
  runGates,
  DEFAULT_GATE_THRESHOLDS,
} from './gate-runner';
export type {
  GateInput,
  GateReport,
  GateCheckDetail,
  GateThresholds,
} from './gate-runner';
