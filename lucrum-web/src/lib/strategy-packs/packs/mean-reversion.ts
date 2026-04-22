/**
 * Pack: 反转博弈 — mean reversion.
 *
 * Short-term oversold + medium-term trend intact + no fundamental damage.
 * Use cautiously: works in rebound/sideways, fails hard in strong trends.
 *
 * @module lib/strategy-packs/packs/mean-reversion
 */

import type { StrategyPack } from '../types';

export const MEAN_REVERSION: StrategyPack = {
  id: 'mean-reversion',
  name: '反转博弈',
  tagline: '超跌反弹，胜率优先',
  description:
    '选短期大跌但基本面未破坏的标的，博弈短线均值回归。仓位要分散，持仓周期 5-15 天。',
  regimeFit: ['sideways', 'rebound'],
  riskLevel: '高风险',
  holdingHorizon: '短线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 120,
    minMarketCap: 30,
  },
  factorWeights: [
    // Negative weight on momentum_1m = prefer recent laggards.
    { factorId: 'momentum_1m', weight: -1.0 },
    // But medium trend must still be intact — keeps us out of falling knives.
    { factorId: 'momentum_6m', weight: 0.5 },
    { factorId: 'quality_roe', weight: 0.6 },
    { factorId: 'value_pe_ttm', weight: 0.4 },
    { factorId: 'adv_20d', weight: 0.8 },
    { factorId: 'volatility_realized_20d', weight: 0.3 },
  ],
  leaderWeight: 0.1,
  klineWindow: 180,
  portfolio: {
    topN: 8,
  },
  expectedProfile: {
    annualReturn: '10–25% (胜率 55%+)',
    maxDrawdown: '< 20%',
    turnover: '很高 (周频以内)',
  },
};
