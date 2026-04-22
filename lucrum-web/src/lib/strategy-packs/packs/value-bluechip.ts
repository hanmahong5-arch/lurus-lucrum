/**
 * Pack: 价值蓝筹 — value bluechip.
 *
 * Low PE/PB + high ROE/dividend + strict liquidity floor. Works best in
 * bear/sideways markets; underperforms in late-stage bull runs.
 *
 * @module lib/strategy-packs/packs/value-bluechip
 */

import type { StrategyPack } from '../types';

export const VALUE_BLUECHIP: StrategyPack = {
  id: 'value-bluechip',
  name: '价值蓝筹',
  tagline: '低估值 + 高质量，防守为先',
  description:
    '选取 PE/PB 处于低位、ROE 稳定、现金流充沛的成熟企业。适合震荡和熊市环境，收益慢但回撤可控。',
  regimeFit: ['bear', 'sideways'],
  riskLevel: '低风险',
  holdingHorizon: '长线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 252, // prefer seasoned names
    minMarketCap: 100, // 亿元
  },
  factorWeights: [
    { factorId: 'value_pe_ttm', weight: 1.0 },
    { factorId: 'value_pb', weight: 0.8 },
    { factorId: 'value_dividend_yield', weight: 0.8 },
    { factorId: 'quality_roe', weight: 1.0 },
    { factorId: 'quality_gross_margin', weight: 0.5 },
    { factorId: 'quality_debt_to_asset', weight: 0.5 },
    { factorId: 'volatility_realized_20d', weight: 0.5 },
    { factorId: 'adv_20d', weight: 0.3 },
  ],
  leaderWeight: 0.1, // valuation-driven, leadership matters little
  klineWindow: 260,
  portfolio: {
    topN: 10,
  },
  expectedProfile: {
    annualReturn: '8–15%',
    maxDrawdown: '< 15%',
    turnover: '低 (季度再平衡)',
  },
};
