/**
 * Leader detection barrel.
 *
 * @module lib/leader
 */

export type {
  LeaderSignals,
  LeaderScore,
  LeaderDetectionResult,
} from './types';

export { detectLeaders } from './sector-leader-detector';
export type { DetectLeadersArgs } from './sector-leader-detector';

export {
  findFirstLimitUp,
  priceLimitBand,
} from './first-limit-up-tracker';
export type { FirstLimitUpArgs } from './first-limit-up-tracker';
