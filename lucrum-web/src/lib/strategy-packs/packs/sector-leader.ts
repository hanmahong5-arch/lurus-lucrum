/**
 * Pack: 板块龙头 — sector leaders.
 *
 * Identify each sector's top contributors by excess return + first-limit-up
 * timing. High leader weight; designed to be run scoped to a specific
 * sector/concept universe.
 *
 * @module lib/strategy-packs/packs/sector-leader
 */

import type { StrategyPack } from '../types';

export const SECTOR_LEADER: StrategyPack = {
  id: 'sector-leader',
  name: '板块龙头',
  tagline: '吃板块内带动率最强的头部',
  description:
    '在选定板块/概念内放大龙头权重：超额涨幅 + 首板时间 + 大单净流入。波动大，需限定板块使用。',
  regimeFit: ['bull', 'rebound'],
  riskLevel: '高风险',
  holdingHorizon: '短线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 90,
    minMarketCap: 20,
  },
  factorWeights: [
    { factorId: 'momentum_1m', weight: 1.0 },
    { factorId: 'momentum_3m', weight: 0.5 },
    { factorId: 'adv_20d', weight: 0.8 },
    { factorId: 'amihud_illiq_20d', weight: 0.5 },
  ],
  leaderWeight: 0.55,
  klineWindow: 120,
  portfolio: {
    topN: 5,
  },
  expectedProfile: {
    annualReturn: '高弹性，牛市 +40% 以上，熊市回撤可能 > 30%',
    maxDrawdown: '< 35%',
    turnover: '高 (周频再平衡)',
  },
};
