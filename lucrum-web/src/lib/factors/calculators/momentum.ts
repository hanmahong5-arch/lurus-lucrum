/**
 * Momentum factors: n-day total return on adjusted close.
 *
 * `momentum_12m_1m` skips the most recent month to avoid the 1-month
 * reversal effect, as is standard in academic momentum research.
 *
 * @module lib/factors/calculators/momentum
 */

import type { FactorContext, FactorDefinition, FactorValues } from '../types';
import { registerFactor } from '../registry';
import { adjustedClose } from './kline-helpers';

async function runMomentum(
  ctx: FactorContext,
  lookbackDays: number,
  skipRecentDays = 0
): Promise<FactorValues> {
  const out = new Map<string, number | null>();
  for (const symbol of ctx.symbols) {
    const bars = await ctx.getKlines(symbol);
    const required = lookbackDays + skipRecentDays + 1;
    if (bars.length < required) {
      out.set(symbol, null);
      continue;
    }
    const endIdx = bars.length - 1 - skipRecentDays;
    const startIdx = endIdx - lookbackDays;
    const end = bars[endIdx];
    const start = bars[startIdx];
    if (!end || !start) {
      out.set(symbol, null);
      continue;
    }
    const endPx = adjustedClose(end);
    const startPx = adjustedClose(start);
    if (startPx <= 0 || endPx <= 0) {
      out.set(symbol, null);
      continue;
    }
    out.set(symbol, endPx / startPx - 1);
  }
  return out;
}

const MOMENTUM_1M: FactorDefinition = {
  id: 'momentum_1m',
  name: '动量 1M',
  category: 'momentum',
  direction: 'higher-better',
  description: '过去 21 个交易日的累计收益率。',
  minKlineBars: 22,
  compute: (ctx) => runMomentum(ctx, 21),
};

const MOMENTUM_3M: FactorDefinition = {
  id: 'momentum_3m',
  name: '动量 3M',
  category: 'momentum',
  direction: 'higher-better',
  description: '过去 63 个交易日的累计收益率。',
  minKlineBars: 64,
  compute: (ctx) => runMomentum(ctx, 63),
};

const MOMENTUM_6M: FactorDefinition = {
  id: 'momentum_6m',
  name: '动量 6M',
  category: 'momentum',
  direction: 'higher-better',
  description: '过去 126 个交易日的累计收益率。',
  minKlineBars: 127,
  compute: (ctx) => runMomentum(ctx, 126),
};

const MOMENTUM_12M_1M: FactorDefinition = {
  id: 'momentum_12m_1m',
  name: '动量 12M-1M',
  category: 'momentum',
  direction: 'higher-better',
  description: '过去 252 个交易日但剔除最近 21 天（规避短期反转）。',
  minKlineBars: 253,
  compute: (ctx) => runMomentum(ctx, 252 - 21, 21),
};

export const MOMENTUM_FACTORS: ReadonlyArray<FactorDefinition> = [
  MOMENTUM_1M,
  MOMENTUM_3M,
  MOMENTUM_6M,
  MOMENTUM_12M_1M,
];

for (const f of MOMENTUM_FACTORS) registerFactor(f);
