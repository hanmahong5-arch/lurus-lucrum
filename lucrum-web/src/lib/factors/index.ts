/**
 * Factor system barrel.
 *
 * Importing this file also triggers registration of all built-in factors
 * via the side-effect module `./calculators`.
 *
 * @module lib/factors
 */

// Side-effect import: registers built-in factors with the registry.
import './calculators';

export type {
  FactorCategory,
  FactorDefinition,
  FactorDirection,
  FactorId,
  FactorContext,
  FactorKlineBar,
  FactorMatrix,
  FactorValues,
} from './types';

export {
  registerFactor,
  getFactor,
  listFactors,
  listFactorsByCategory,
  listFactorIds,
} from './registry';

export { buildKlineFetcher } from './kline-fetcher';
export type { BuildKlineFetcherArgs, KlineFetcher } from './kline-fetcher';

export {
  computeFactorMatrix,
  scoreCrossSection,
} from './cross-section-scorer';
export type {
  FactorWeight,
  ScoreOptions,
  SymbolScore,
  CrossSectionScoreResult,
  ComputeFactorMatrixArgs,
} from './cross-section-scorer';

export {
  computeIC,
  computeRankIC,
  computeIR,
  summariseICSeries,
} from './ic-calculator';
export type { ICPoint, ICSummary } from './ic-calculator';

export { BUILTIN_FACTORS } from './calculators';
