/**
 * Pack override — apply user-edited knobs on top of a base StrategyPack.
 *
 * L3 (Stepper) users start from a preset pack and adjust individual
 * knobs. The override shape accepts partial edits and the merger produces
 * a validated, bounded, and clamped StrategyPack ready for runPackDirect.
 *
 * Only fields the UI exposes can be overridden; identity/meta (id, name,
 * description, regimeFit, expectedProfile) stay from the base.
 *
 * @module lib/strategy-packs/pack-override
 */

import { listFactorIds, type FactorWeight } from '@/lib/factors';
import type { StrategyPack } from './types';

export interface PackOverride {
  readonly factorWeights?: ReadonlyArray<FactorWeight>;
  readonly leaderWeight?: number;
  readonly klineWindow?: number;
  readonly topN?: number;
  readonly minListingDays?: number;
  readonly minMarketCap?: number;
}

const MIN_TOP_N = 1;
const MAX_TOP_N = 50;
const MIN_KLINE = 60;
const MAX_KLINE = 520;
const MIN_LISTING = 0;
const MAX_LISTING = 1500;
const MIN_MCAP = 0;
const MAX_MCAP = 5000;
const MAX_FACTORS = 24;
const MAX_WEIGHT = 5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function applyOverride(
  base: StrategyPack,
  override: PackOverride
): StrategyPack {
  const validFactorIds = new Set(listFactorIds());
  const factorWeights = normalizeFactorWeights(
    override.factorWeights ?? base.factorWeights,
    validFactorIds
  );

  return {
    ...base,
    factorWeights,
    leaderWeight:
      override.leaderWeight !== undefined
        ? clamp(override.leaderWeight, 0, 1)
        : base.leaderWeight,
    klineWindow:
      override.klineWindow !== undefined
        ? Math.round(clamp(override.klineWindow, MIN_KLINE, MAX_KLINE))
        : base.klineWindow,
    portfolio: {
      ...base.portfolio,
      topN:
        override.topN !== undefined
          ? Math.round(clamp(override.topN, MIN_TOP_N, MAX_TOP_N))
          : base.portfolio.topN,
    },
    hardFilter: {
      ...base.hardFilter,
      minListingDays:
        override.minListingDays !== undefined
          ? Math.round(clamp(override.minListingDays, MIN_LISTING, MAX_LISTING))
          : base.hardFilter.minListingDays,
      minMarketCap:
        override.minMarketCap !== undefined
          ? Math.round(clamp(override.minMarketCap, MIN_MCAP, MAX_MCAP))
          : base.hardFilter.minMarketCap,
    },
  };
}

function normalizeFactorWeights(
  weights: ReadonlyArray<FactorWeight>,
  validIds: ReadonlySet<string>
): ReadonlyArray<FactorWeight> {
  const seen = new Set<string>();
  const out: FactorWeight[] = [];
  for (const w of weights) {
    if (out.length >= MAX_FACTORS) break;
    if (!w || typeof w.factorId !== 'string') continue;
    if (seen.has(w.factorId)) continue;
    if (!validIds.has(w.factorId)) continue;
    const weight = clamp(Number(w.weight) || 0, -MAX_WEIGHT, MAX_WEIGHT);
    if (Math.abs(weight) < 0.01) continue;
    seen.add(w.factorId);
    out.push({ factorId: w.factorId, weight });
  }
  return out;
}

export function validateOverride(raw: unknown): PackOverride | string {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object') return 'override must be object';
  const r = raw as Record<string, unknown>;

  const override: Record<string, unknown> = {};
  for (const numKey of [
    'leaderWeight',
    'klineWindow',
    'topN',
    'minListingDays',
    'minMarketCap',
  ] as const) {
    const v = r[numKey];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return `${numKey} must be a finite number`;
    }
    override[numKey] = v;
  }

  if (r.factorWeights !== undefined) {
    if (!Array.isArray(r.factorWeights)) return 'factorWeights must be array';
    const parsed: FactorWeight[] = [];
    for (const item of r.factorWeights) {
      if (!item || typeof item !== 'object') {
        return 'factorWeights entries must be objects';
      }
      const e = item as Record<string, unknown>;
      if (typeof e.factorId !== 'string') {
        return 'factorWeights entry needs factorId:string';
      }
      if (typeof e.weight !== 'number' || !Number.isFinite(e.weight)) {
        return 'factorWeights entry needs weight:number';
      }
      parsed.push({ factorId: e.factorId, weight: e.weight });
    }
    override.factorWeights = parsed;
  }

  return override as PackOverride;
}
