/**
 * Liquidity factors.
 *
 * - `adv_20d`: 20-day average daily CNY turnover (成交额); bigger = more liquid.
 * - `amihud_illiq_20d`: mean(|return| / turnover); smaller = more liquid.
 *
 * Amihud illiquidity is scaled by 1e8 (turnover in 亿元) so it fits in a
 * numeric range where z-scores behave well.
 *
 * @module lib/factors/calculators/liquidity
 */

import type { FactorContext, FactorDefinition, FactorValues } from '../types';
import { registerFactor } from '../registry';
import { adjustedClose } from './kline-helpers';

const AMIHUD_SCALE = 1e8;

async function adv20d(ctx: FactorContext): Promise<FactorValues> {
  const out = new Map<string, number | null>();
  const period = 20;
  for (const symbol of ctx.symbols) {
    const bars = await ctx.getKlines(symbol);
    if (bars.length < period) {
      out.set(symbol, null);
      continue;
    }
    const slice = bars.slice(-period);
    let sum = 0;
    let n = 0;
    for (const b of slice) {
      if (b.amount !== null && b.amount > 0) {
        sum += b.amount;
        n += 1;
      }
    }
    if (n === 0) {
      out.set(symbol, null);
      continue;
    }
    out.set(symbol, sum / n);
  }
  return out;
}

async function amihudIlliq20d(ctx: FactorContext): Promise<FactorValues> {
  const out = new Map<string, number | null>();
  const period = 20;
  for (const symbol of ctx.symbols) {
    const bars = await ctx.getKlines(symbol);
    if (bars.length < period + 1) {
      out.set(symbol, null);
      continue;
    }
    const slice = bars.slice(-(period + 1));
    const ratios: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      const curr = slice[i];
      const prev = slice[i - 1];
      if (!curr || !prev) continue;
      const pc = adjustedClose(prev);
      const cc = adjustedClose(curr);
      if (pc <= 0 || cc <= 0) continue;
      const ret = Math.abs(cc / pc - 1);
      if (curr.amount === null || curr.amount <= 0) continue;
      ratios.push((ret * AMIHUD_SCALE) / curr.amount);
    }
    if (ratios.length === 0) {
      out.set(symbol, null);
      continue;
    }
    let sum = 0;
    for (const r of ratios) sum += r;
    out.set(symbol, sum / ratios.length);
  }
  return out;
}

const ADV_20D: FactorDefinition = {
  id: 'adv_20d',
  name: '平均日成交额 20D',
  category: 'liquidity',
  direction: 'higher-better',
  description: '过去 20 日的平均日 CNY 成交额（越大越流动）。',
  minKlineBars: 20,
  compute: adv20d,
};

const AMIHUD_ILLIQ_20D: FactorDefinition = {
  id: 'amihud_illiq_20d',
  name: 'Amihud 非流动性 20D',
  category: 'liquidity',
  direction: 'lower-better',
  description: '过去 20 日 mean(|收益率| / 成交额) × 1e8（越小越流动）。',
  minKlineBars: 21,
  compute: amihudIlliq20d,
};

export const LIQUIDITY_FACTORS: ReadonlyArray<FactorDefinition> = [
  ADV_20D,
  AMIHUD_ILLIQ_20D,
];

for (const f of LIQUIDITY_FACTORS) registerFactor(f);
