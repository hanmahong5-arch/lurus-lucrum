/**
 * Value factors — read point-in-time fundamentals from the PIT facts store.
 *
 * If PIT facts have not yet been loaded (Phase 0.5 ETL) these factors
 * will return `null` for every symbol; the scorer will drop them from
 * the composite and emit a warning.
 *
 * @module lib/factors/calculators/value
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

const PE_TTM: FactorDefinition = {
  id: 'value_pe_ttm',
  name: 'PE (TTM)',
  category: 'value',
  direction: 'lower-better',
  description: '滚动 12 个月市盈率（越低越便宜）。',
  compute: makePitFactorCompute('pe_ttm'),
};

const PB: FactorDefinition = {
  id: 'value_pb',
  name: 'PB',
  category: 'value',
  direction: 'lower-better',
  description: '市净率（越低越便宜）。',
  compute: makePitFactorCompute('pb'),
};

const PS_TTM: FactorDefinition = {
  id: 'value_ps_ttm',
  name: 'PS (TTM)',
  category: 'value',
  direction: 'lower-better',
  description: '滚动 12 个月市销率。',
  compute: makePitFactorCompute('ps_ttm'),
};

const DIV_YIELD: FactorDefinition = {
  id: 'value_dividend_yield',
  name: '股息率',
  category: 'value',
  direction: 'higher-better',
  description: '过去 12 个月现金分红 ÷ 总市值。',
  compute: makePitFactorCompute('dividend_yield'),
};

export const VALUE_FACTORS: ReadonlyArray<FactorDefinition> = [
  PE_TTM,
  PB,
  PS_TTM,
  DIV_YIELD,
];

for (const f of VALUE_FACTORS) registerFactor(f);
