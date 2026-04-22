/**
 * Regime detection barrel.
 *
 * @module lib/regime
 */

export type { Regime, RegimeSignals, RegimeDetection } from './types';

export {
  detectRegime,
  DEFAULT_THRESHOLDS,
} from './regime-detector';
export type {
  DetectRegimeArgs,
  RegimeThresholds,
} from './regime-detector';

export {
  recommendPacksForRegime,
  topPacksForRegime,
} from './strategy-regime-matcher';
export type { StrategyPackRecommendation } from './strategy-regime-matcher';
