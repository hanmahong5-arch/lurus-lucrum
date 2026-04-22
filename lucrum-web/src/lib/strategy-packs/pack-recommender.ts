/**
 * Pack recommender — given a market regime, list packs in fit order.
 *
 * Thin wrapper over `@/lib/regime` with a lookup against our pack list
 * to ensure we only recommend packs that actually exist in the registry.
 *
 * @module lib/strategy-packs/pack-recommender
 */

import { recommendPacksForRegime } from '@/lib/regime';
import type { Regime } from '@/lib/regime';
import type { StrategyPack } from './types';
import { getPack } from './packs';

export interface PackRecommendation {
  readonly pack: StrategyPack;
  readonly fit: number;
  readonly rationale: string;
}

export function recommendPacks(regime: Regime): ReadonlyArray<PackRecommendation> {
  const raw = recommendPacksForRegime(regime);
  const out: PackRecommendation[] = [];
  for (const r of raw) {
    const pack = getPack(r.packId as StrategyPack['id']);
    if (!pack) continue;
    out.push({ pack, fit: r.fit, rationale: r.rationale });
  }
  return out;
}
