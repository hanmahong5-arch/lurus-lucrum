/**
 * Style dial — synthesize a StrategyPack from three continuous axes.
 *
 * Axes (all 0-100):
 *   - yield        (0 保本 → 100 进取) risk appetite
 *   - concentration (0 分散 → 100 集中) position concentration
 *   - horizon      (0 短线 → 100 长线) holding horizon
 *
 * Output is a fully-populated pack with a synthetic id 'custom-dial'.
 * Consumers route this through runPackDirect (not the registry).
 *
 * @module lib/strategy-packs/style-dial
 */

import type { FactorWeight } from '@/lib/factors';
import type { Regime } from '@/lib/regime';
import type {
  HoldingHorizon,
  RiskLevel,
  StrategyPack,
  StrategyPackId,
} from './types';

export interface StyleDial {
  readonly yield: number;
  readonly concentration: number;
  readonly horizon: number;
}

export const DEFAULT_DIAL: StyleDial = {
  yield: 50,
  concentration: 50,
  horizon: 50,
};

const CUSTOM_DIAL_ID = 'custom-dial' as StrategyPackId;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function triangle(peak: number, x: number): number {
  return Math.max(0, 1 - Math.abs(x - peak) * 2);
}

export function synthesizePack(dial: StyleDial): StrategyPack {
  const risk = clamp01(dial.yield / 100);
  const conc = clamp01(dial.concentration / 100);
  const hz = clamp01(dial.horizon / 100);

  const momAggr = 0.3 + risk * 0.7;
  const m1 = Math.max(0, 1 - hz * 2) * momAggr;
  const m3 = triangle(0.33, hz) * (0.4 + risk * 0.5);
  const m6 = triangle(0.66, hz) * (0.4 + risk * 0.5);
  const m12 = Math.max(0, hz * 2 - 1) * momAggr;

  const defensive = 1 - risk;
  const valuePe = defensive * 1.0;
  const valuePb = defensive * 0.7;
  const valueDiv = defensive * (0.4 + hz * 0.4);

  const qRoe = 0.4 + defensive * 0.4;
  const qMargin = 0.2 + defensive * 0.3;
  const qDebt = defensive * 0.4;

  const vol = 0.2 + defensive * 0.4;
  const adv = 0.3 + conc * 0.2 + hz * 0.2;

  const raw: ReadonlyArray<readonly [string, number]> = [
    ['momentum_1m', m1],
    ['momentum_3m', m3],
    ['momentum_6m', m6],
    ['momentum_12m_1m', m12],
    ['value_pe_ttm', valuePe],
    ['value_pb', valuePb],
    ['value_dividend_yield', valueDiv],
    ['quality_roe', qRoe],
    ['quality_gross_margin', qMargin],
    ['quality_debt_to_asset', qDebt],
    ['volatility_realized_20d', vol],
    ['adv_20d', adv],
  ];

  const factorWeights: ReadonlyArray<FactorWeight> = raw
    .filter(([, w]) => w >= 0.05)
    .map(([factorId, weight]) => ({
      factorId,
      weight: round2(weight),
    }));

  const topN = Math.max(5, Math.round(20 - conc * 15));
  const leaderWeight = round2(0.1 + risk * 0.2 + conc * 0.1);
  const klineWindow = Math.round(120 + hz * 200);
  const minListingDays = Math.round(60 + defensive * 200);
  const minMarketCap = Math.round(20 + defensive * 100);

  const riskLevel: RiskLevel =
    risk < 0.34 ? '低风险' : risk < 0.67 ? '中风险' : '高风险';
  const holdingHorizon: HoldingHorizon =
    hz < 0.34 ? '短线' : hz < 0.67 ? '中线' : '长线';

  return {
    id: CUSTOM_DIAL_ID,
    name: 'Dial 自定义',
    tagline: `${riskLevel} · ${holdingHorizon} · Top ${topN}`,
    description: '按收益/集中/持仓三滑块合成的自定义风格。',
    regimeFit: inferRegimeFit(risk, hz),
    riskLevel,
    holdingHorizon,
    hardFilter: {
      excludeST: true,
      excludeDelisted: true,
      excludeHalted: true,
      minListingDays,
      minMarketCap,
    },
    factorWeights,
    leaderWeight,
    klineWindow,
    portfolio: { topN },
    expectedProfile: inferExpectedProfile(risk, hz),
  };
}

function inferRegimeFit(risk: number, hz: number): ReadonlyArray<Regime> {
  if (risk > 0.66) return hz > 0.5 ? ['bull'] : ['bull', 'rebound'];
  if (risk < 0.34) return ['bear', 'sideways'];
  return ['sideways', 'rebound'];
}

function inferExpectedProfile(
  risk: number,
  hz: number
): StrategyPack['expectedProfile'] {
  const annualMin = Math.round(8 + risk * 18);
  const annualMax = Math.round(15 + risk * 30);
  const mddCap = Math.round(10 + risk * 25);
  const turnoverLabel =
    hz < 0.34 ? '高 (月内调仓)' : hz < 0.67 ? '中 (月度再平衡)' : '低 (季度再平衡)';
  return {
    annualReturn: `${annualMin}–${annualMax}%`,
    maxDrawdown: `< ${mddCap}%`,
    turnover: turnoverLabel,
  };
}

export function validateDial(dial: unknown): StyleDial | string {
  if (!dial || typeof dial !== 'object') return 'dial must be object';
  const d = dial as Record<string, unknown>;
  for (const key of ['yield', 'concentration', 'horizon'] as const) {
    const v = d[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
      return `dial.${key} must be 0-100`;
    }
  }
  return {
    yield: d.yield as number,
    concentration: d.concentration as number,
    horizon: d.horizon as number,
  };
}
