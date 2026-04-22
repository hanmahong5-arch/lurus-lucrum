/**
 * Strategy-regime matcher.
 *
 * Small lookup table from regime → recommended strategy packs. The packs
 * themselves are defined in Phase 5; this module only encodes the
 * heuristic mapping so it can be read and tuned in one place.
 *
 * @module lib/regime/strategy-regime-matcher
 */

import type { Regime } from './types';

export interface StrategyPackRecommendation {
  readonly packId: string;
  /** 0-1 fit score; ordering already reflects priority for that regime. */
  readonly fit: number;
  readonly rationale: string;
}

const TABLE: Readonly<Record<Regime, ReadonlyArray<StrategyPackRecommendation>>> = {
  bull: [
    {
      packId: 'growth-momentum',
      fit: 0.95,
      rationale: '趋势向上，动量 + 成长加速最适配',
    },
    {
      packId: 'sector-leader',
      fit: 0.85,
      rationale: '牛市龙头吃涨幅大头',
    },
    {
      packId: 'event-driven',
      fit: 0.65,
      rationale: '牛市资金推动事件股溢价',
    },
  ],
  bear: [
    {
      packId: 'low-vol-stable',
      fit: 0.9,
      rationale: '熊市低波 + 高股息防御',
    },
    {
      packId: 'value-bluechip',
      fit: 0.8,
      rationale: '价值蓝筹提供下行保护',
    },
  ],
  sideways: [
    {
      packId: 'mean-reversion',
      fit: 0.85,
      rationale: '震荡市反转策略胜率高',
    },
    {
      packId: 'value-bluechip',
      fit: 0.7,
      rationale: '震荡时价值风格相对稳定',
    },
    {
      packId: 'event-driven',
      fit: 0.6,
      rationale: '事件催化可独立于大盘',
    },
  ],
  rebound: [
    {
      packId: 'mean-reversion',
      fit: 0.9,
      rationale: '超跌反弹，反转策略弹性最大',
    },
    {
      packId: 'growth-momentum',
      fit: 0.75,
      rationale: '反弹后期高弹性成长股接力',
    },
    {
      packId: 'sector-leader',
      fit: 0.7,
      rationale: '反弹龙头常先启动',
    },
  ],
};

/**
 * Return the ordered list of pack recommendations for a given regime.
 */
export function recommendPacksForRegime(
  regime: Regime
): ReadonlyArray<StrategyPackRecommendation> {
  return TABLE[regime];
}

/**
 * Convenience: top N picks.
 */
export function topPacksForRegime(
  regime: Regime,
  n: number
): ReadonlyArray<StrategyPackRecommendation> {
  return TABLE[regime].slice(0, Math.max(0, n));
}
