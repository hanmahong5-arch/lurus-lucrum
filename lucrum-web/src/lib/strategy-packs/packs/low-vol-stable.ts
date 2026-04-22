/**
 * Pack: 低波稳健 — low volatility.
 *
 * Low realized vol + low beta + high dividend. All-weather defensive; the
 * smallest drawdowns in the roster at the cost of capped upside.
 *
 * @module lib/strategy-packs/packs/low-vol-stable
 */

import type { StrategyPack } from '../types';

export const LOW_VOL_STABLE: StrategyPack = {
  id: 'low-vol-stable',
  name: '低波稳健',
  tagline: '波动最小，回撤最小',
  description:
    '选 20 日已实现波动率最低的股票，叠加股息率与资产负债率过滤。任何市场都可持有，但预期收益有限。',
  regimeFit: ['bear', 'sideways'],
  riskLevel: '低风险',
  holdingHorizon: '长线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 252,
    minMarketCap: 80,
  },
  factorWeights: [
    { factorId: 'volatility_realized_20d', weight: 1.2 },
    { factorId: 'atr_14', weight: 0.6 },
    { factorId: 'value_dividend_yield', weight: 0.8 },
    { factorId: 'quality_roe', weight: 0.6 },
    { factorId: 'quality_debt_to_asset', weight: 0.5 },
    { factorId: 'adv_20d', weight: 0.3 },
  ],
  leaderWeight: 0.05,
  klineWindow: 180,
  portfolio: {
    topN: 15,
  },
  expectedProfile: {
    annualReturn: '6–12%',
    maxDrawdown: '< 10%',
    turnover: '很低 (半年再平衡)',
  },
};
