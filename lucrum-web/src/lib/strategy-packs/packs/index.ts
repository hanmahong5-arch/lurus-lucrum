/**
 * Registry of all built-in strategy packs.
 *
 * @module lib/strategy-packs/packs
 */

import type { StrategyPack, StrategyPackId } from '../types';
import { VALUE_BLUECHIP } from './value-bluechip';
import { GROWTH_MOMENTUM } from './growth-momentum';
import { SECTOR_LEADER } from './sector-leader';
import { LOW_VOL_STABLE } from './low-vol-stable';
import { MEAN_REVERSION } from './mean-reversion';
import { EVENT_DRIVEN } from './event-driven';

export const ALL_PACKS: ReadonlyArray<StrategyPack> = [
  VALUE_BLUECHIP,
  GROWTH_MOMENTUM,
  SECTOR_LEADER,
  LOW_VOL_STABLE,
  MEAN_REVERSION,
  EVENT_DRIVEN,
];

const PACK_BY_ID: ReadonlyMap<StrategyPackId, StrategyPack> = new Map(
  ALL_PACKS.map((p) => [p.id, p])
);

export function getPack(id: StrategyPackId): StrategyPack | undefined {
  return PACK_BY_ID.get(id);
}

export function listPacks(): ReadonlyArray<StrategyPack> {
  return ALL_PACKS;
}

export {
  VALUE_BLUECHIP,
  GROWTH_MOMENTUM,
  SECTOR_LEADER,
  LOW_VOL_STABLE,
  MEAN_REVERSION,
  EVENT_DRIVEN,
};
