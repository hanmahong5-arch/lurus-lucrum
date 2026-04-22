/**
 * Volatility factors.
 *
 * - `volatility_realized_20d`: annualized realized vol from 20-day daily returns.
 * - `atr_14`: 14-day Average True Range normalised by close.
 *
 * @module lib/factors/calculators/volatility
 */

import type { FactorContext, FactorDefinition, FactorValues } from '../types';
import { registerFactor } from '../registry';
import {
  adjustedClose,
  adjustedHigh,
  adjustedLow,
  logReturns,
  sampleStdev,
} from './kline-helpers';

const TRADING_DAYS_PER_YEAR = 252;

async function realizedVol20d(ctx: FactorContext): Promise<FactorValues> {
  const out = new Map<string, number | null>();
  for (const symbol of ctx.symbols) {
    const bars = await ctx.getKlines(symbol);
    if (bars.length < 22) {
      out.set(symbol, null);
      continue;
    }
    const slice = bars.slice(-21);
    const closes = slice.map(adjustedClose);
    const rets = logReturns(closes);
    if (rets.length < 5) {
      out.set(symbol, null);
      continue;
    }
    out.set(symbol, sampleStdev(rets) * Math.sqrt(TRADING_DAYS_PER_YEAR));
  }
  return out;
}

async function atr14(ctx: FactorContext): Promise<FactorValues> {
  const out = new Map<string, number | null>();
  const period = 14;
  for (const symbol of ctx.symbols) {
    const bars = await ctx.getKlines(symbol);
    if (bars.length < period + 1) {
      out.set(symbol, null);
      continue;
    }
    const slice = bars.slice(-(period + 1));
    const trs: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      const curr = slice[i];
      const prev = slice[i - 1];
      if (!curr || !prev) continue;
      const h = adjustedHigh(curr);
      const l = adjustedLow(curr);
      const pc = adjustedClose(prev);
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      trs.push(tr);
    }
    if (trs.length === 0) {
      out.set(symbol, null);
      continue;
    }
    let atr = 0;
    for (const v of trs) atr += v;
    atr /= trs.length;

    const lastBar = slice[slice.length - 1];
    if (!lastBar) {
      out.set(symbol, null);
      continue;
    }
    const lastClose = adjustedClose(lastBar);
    if (lastClose <= 0) {
      out.set(symbol, null);
      continue;
    }
    // Normalize by last close so values are comparable across price levels.
    out.set(symbol, atr / lastClose);
  }
  return out;
}

const VOL_REALIZED_20D: FactorDefinition = {
  id: 'volatility_realized_20d',
  name: '已实现波动率 20D',
  category: 'volatility',
  direction: 'lower-better',
  description: '过去 20 日对数收益率标准差的年化值。',
  minKlineBars: 22,
  compute: realizedVol20d,
};

const ATR_14: FactorDefinition = {
  id: 'atr_14',
  name: 'ATR 14 (归一化)',
  category: 'volatility',
  direction: 'lower-better',
  description: '14 日平均真实波幅除以当前收盘价。',
  minKlineBars: 15,
  compute: atr14,
};

export const VOLATILITY_FACTORS: ReadonlyArray<FactorDefinition> = [
  VOL_REALIZED_20D,
  ATR_14,
];

for (const f of VOLATILITY_FACTORS) registerFactor(f);
