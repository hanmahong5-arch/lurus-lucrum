/**
 * Strategy pack system barrel.
 *
 * @module lib/strategy-packs
 */

export type {
  StrategyPack,
  StrategyPackId,
  PackRunRequest,
  RiskLevel,
  HoldingHorizon,
} from './types';

export {
  ALL_PACKS,
  getPack,
  listPacks,
  VALUE_BLUECHIP,
  GROWTH_MOMENTUM,
  SECTOR_LEADER,
  LOW_VOL_STABLE,
  MEAN_REVERSION,
  EVENT_DRIVEN,
} from './packs';

export { runPack } from './pack-runner';
export type { PackRunOutput, RunPackOptions } from './pack-runner';

export { recommendPacks } from './pack-recommender';
export type { PackRecommendation } from './pack-recommender';
