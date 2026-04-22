/**
 * Pack: 成长动量 — growth + momentum.
 *
 * Medium-term momentum + quality growth (ROE, gross margin). Thrives in
 * bull markets and rebound windows; drawdown risk is material in bear.
 *
 * @module lib/strategy-packs/packs/growth-momentum
 */

import type { StrategyPack } from '../types';

export const GROWTH_MOMENTUM: StrategyPack = {
  id: 'growth-momentum',
  name: '成长动量',
  tagline: '顺势而为，抓盈利加速',
  description:
    '叠加 3-12 月价格动量与成长质量因子（ROE/毛利率），放大高弹性标的。牛市 + 反弹市场首选。',
  regimeFit: ['bull', 'rebound'],
  riskLevel: '中风险',
  holdingHorizon: '中线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 120,
    minMarketCap: 30,
  },
  factorWeights: [
    { factorId: 'momentum_3m', weight: 1.0 },
    { factorId: 'momentum_6m', weight: 1.0 },
    { factorId: 'momentum_12m_1m', weight: 0.8 },
    { factorId: 'quality_roe', weight: 0.8 },
    { factorId: 'quality_gross_margin', weight: 0.5 },
    { factorId: 'volatility_realized_20d', weight: 0.3 },
    { factorId: 'adv_20d', weight: 0.5 },
  ],
  leaderWeight: 0.25,
  klineWindow: 280,
  portfolio: {
    topN: 10,
  },
  expectedProfile: {
    annualReturn: '20–40%',
    maxDrawdown: '< 30%',
    turnover: '中 (月度再平衡)',
  },
};
