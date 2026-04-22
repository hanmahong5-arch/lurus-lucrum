/**
 * Strategy pack — the "opinionated preset" users pick when they don't
 * want to configure every knob of the selection funnel.
 *
 * A pack ties together:
 *   - Hard-filter defaults (ST exclusion, min liquidity, etc.)
 *   - Factor basket and weights for stage 04.
 *   - Leader-detection strength for stage 05.
 *   - Portfolio construction (Top N, constraints).
 *   - Which regime(s) this pack is designed for.
 *
 * @module lib/strategy-packs/types
 */

import type { FactorWeight } from '@/lib/factors';
import type { HardFilterOptions } from '@/lib/funnel/stages/01-hard-filter';
import type { PortfolioConstructionOptions } from '@/lib/funnel/stages/06-portfolio-construction';
import type { Regime } from '@/lib/regime';

export type StrategyPackId =
  | 'value-bluechip'
  | 'growth-momentum'
  | 'sector-leader'
  | 'low-vol-stable'
  | 'mean-reversion'
  | 'event-driven';

export type RiskLevel = '低风险' | '中风险' | '高风险';
export type HoldingHorizon = '短线' | '中线' | '长线';

export interface StrategyPack {
  readonly id: StrategyPackId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly regimeFit: ReadonlyArray<Regime>;
  readonly riskLevel: RiskLevel;
  readonly holdingHorizon: HoldingHorizon;

  readonly hardFilter: HardFilterOptions;
  readonly factorWeights: ReadonlyArray<FactorWeight>;
  readonly leaderWeight: number;
  readonly klineWindow: number;
  readonly portfolio: PortfolioConstructionOptions;

  /** Informational — what the user should expect, in prose, for the UI. */
  readonly expectedProfile: {
    readonly annualReturn: string;
    readonly maxDrawdown: string;
    readonly winRate?: string;
    readonly turnover: string;
  };
}

export interface PackRunRequest {
  readonly packId: StrategyPackId;
  readonly universe: {
    readonly kind: 'sector' | 'symbols';
    readonly sectorCode?: string;
    readonly symbols?: ReadonlyArray<string>;
  };
  readonly asOfDate?: string;
  readonly topN?: number;
  readonly userId?: string;
}
