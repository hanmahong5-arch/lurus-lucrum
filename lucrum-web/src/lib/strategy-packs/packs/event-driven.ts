/**
 * Pack: 事件驱动 — event driven.
 *
 * Abnormal volume spike + price breakout on recent liquidity. Designed
 * as a filler that works across regimes because the catalyst is
 * idiosyncratic. Volume-based only until news/disclosure feed lands.
 *
 * @module lib/strategy-packs/packs/event-driven
 */

import type { StrategyPack } from '../types';

export const EVENT_DRIVEN: StrategyPack = {
  id: 'event-driven',
  name: '事件驱动',
  tagline: '放量突破，催化为王',
  description:
    '以放量突破 + 资金流入为信号，捕捉由业绩预增、回购、并购等事件驱动的阶段性行情。持仓短。',
  regimeFit: ['bull', 'sideways', 'rebound'],
  riskLevel: '高风险',
  holdingHorizon: '短线',

  hardFilter: {
    excludeST: true,
    excludeDelisted: true,
    excludeHalted: true,
    minListingDays: 90,
    minMarketCap: 30,
  },
  factorWeights: [
    { factorId: 'momentum_1m', weight: 1.0 },
    { factorId: 'adv_20d', weight: 1.2 },
    { factorId: 'amihud_illiq_20d', weight: 0.6 },
    { factorId: 'quality_roe', weight: 0.3 },
  ],
  leaderWeight: 0.35,
  klineWindow: 90,
  portfolio: {
    topN: 6,
  },
  expectedProfile: {
    annualReturn: '15–35% (取决于市场宽度)',
    maxDrawdown: '< 25%',
    turnover: '很高 (事件窗口驱动)',
  },
};
