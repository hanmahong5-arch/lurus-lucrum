/**
 * Quality factors — point-in-time profitability and efficiency metrics.
 *
 * Returns `null` for any symbol whose PIT facts have not been loaded.
 *
 * @module lib/factors/calculators/quality
 */

import type { FactorContext, FactorDefinition, FactorValues } from '../types';
import { registerFactor } from '../registry';
import { getPitFactsRepository } from '@/lib/pit';

function makePitFactorCompute(field: string) {
  return async (ctx: FactorContext): Promise<FactorValues> => {
    const repo = getPitFactsRepository();
    return repo.getFactsAt(ctx.symbols, field, ctx.asOfDate);
  };
}

const ROE: FactorDefinition = {
  id: 'quality_roe',
  name: 'ROE',
  category: 'quality',
  direction: 'higher-better',
  description: '股东权益回报率（年化，越高越好）。',
  compute: makePitFactorCompute('roe'),
};

const ROIC: FactorDefinition = {
  id: 'quality_roic',
  name: 'ROIC',
  category: 'quality',
  direction: 'higher-better',
  description: '投入资本回报率（剔除现金/杠杆差异）。',
  compute: makePitFactorCompute('roic'),
};

const GROSS_MARGIN: FactorDefinition = {
  id: 'quality_gross_margin',
  name: '毛利率',
  category: 'quality',
  direction: 'higher-better',
  description: '(营业收入 - 营业成本) / 营业收入。',
  compute: makePitFactorCompute('gross_margin'),
};

const NET_MARGIN: FactorDefinition = {
  id: 'quality_net_margin',
  name: '净利率',
  category: 'quality',
  direction: 'higher-better',
  description: '归母净利润 / 营业收入。',
  compute: makePitFactorCompute('net_margin'),
};

const DEBT_TO_ASSET: FactorDefinition = {
  id: 'quality_debt_to_asset',
  name: '资产负债率',
  category: 'quality',
  direction: 'lower-better',
  description: '总负债 / 总资产（越低杠杆越轻）。',
  compute: makePitFactorCompute('debt_to_asset'),
};

export const QUALITY_FACTORS: ReadonlyArray<FactorDefinition> = [
  ROE,
  ROIC,
  GROSS_MARGIN,
  NET_MARGIN,
  DEBT_TO_ASSET,
];

for (const f of QUALITY_FACTORS) registerFactor(f);
