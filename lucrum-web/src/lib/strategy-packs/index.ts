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

export { runPack, runPackDirect } from './pack-runner';
export type {
  PackRunOutput,
  RunPackOptions,
  RunPackDirectOptions,
} from './pack-runner';

export { synthesizePack, validateDial, DEFAULT_DIAL } from './style-dial';
export type { StyleDial } from './style-dial';

export { applyOverride, validateOverride } from './pack-override';
export type { PackOverride } from './pack-override';

export { recommendPacks } from './pack-recommender';
export type { PackRecommendation } from './pack-recommender';
