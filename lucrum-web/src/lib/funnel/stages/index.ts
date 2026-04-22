/**
 * Barrel exports for all funnel stages.
 *
 * @module lib/funnel/stages
 */

export { makeUniverseStage } from './00-universe';
export type { UniverseSpec, UniverseStageOptions } from './00-universe';

export { makeHardFilterStage } from './01-hard-filter';
export type { HardFilterOptions } from './01-hard-filter';

export { makeFundamentalHealthStage } from './02-fundamental-health';
export type { FundamentalHealthOptions } from './02-fundamental-health';

export { makeSignalStage } from './03-signal';
export type { SignalStageOptions } from './03-signal';

export { makeFactorScoreStage } from './04-factor-score';
export type { FactorScoreOptions } from './04-factor-score';

export { makeLeaderDetectionStage } from './05-leader-detection';

export { makePortfolioConstructionStage } from './06-portfolio-construction';
export type { PortfolioConstructionOptions } from './06-portfolio-construction';

export { makeBacktestValidationStage } from './07-backtest-validation';

/**
 * Convenience factory: assemble the default funnel for selection runs.
 * Callers can still opt to build a custom pipeline by combining stages
 * directly from this module.
 */
import { buildPipeline } from '../pipeline';
import type { Stage } from '../types';
import type { UniverseStageOptions } from './00-universe';
import type { HardFilterOptions } from './01-hard-filter';
import type { PortfolioConstructionOptions } from './06-portfolio-construction';
import { makeUniverseStage } from './00-universe';
import { makeHardFilterStage } from './01-hard-filter';
import { makeFundamentalHealthStage } from './02-fundamental-health';
import { makeSignalStage } from './03-signal';
import { makeFactorScoreStage } from './04-factor-score';
import { makeLeaderDetectionStage } from './05-leader-detection';
import { makePortfolioConstructionStage } from './06-portfolio-construction';
import { makeBacktestValidationStage } from './07-backtest-validation';

export interface DefaultFunnelOptions {
  readonly universe: UniverseStageOptions;
  readonly hardFilter?: HardFilterOptions;
  readonly portfolio?: PortfolioConstructionOptions;
}

export function makeDefaultFunnel(
  options: DefaultFunnelOptions
): ReadonlyArray<Stage> {
  return buildPipeline([
    makeUniverseStage(options.universe),
    makeHardFilterStage(options.hardFilter),
    makeFundamentalHealthStage(),
    makeSignalStage(),
    makeFactorScoreStage(),
    makeLeaderDetectionStage(),
    makePortfolioConstructionStage(options.portfolio),
    makeBacktestValidationStage(),
  ]);
}
