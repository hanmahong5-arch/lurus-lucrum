/**
 * Point-in-Time Repository Layer — Barrel Exports & Singleton Factory.
 *
 * Mirrors the structure of `@/lib/repositories` for consistency.
 *
 * @module lib/pit
 */

import { db } from '@/lib/db';
import type {
  IPitCalendarRepository,
  IPitSectorSnapshotRepository,
  IPitDisclosureRepository,
  IPitFactsRepository,
} from './interfaces';
import { DrizzlePitCalendarRepository } from './calendar-repository';
import { DrizzlePitSectorSnapshotRepository } from './sector-snapshot-repository';
import { DrizzlePitDisclosureRepository } from './disclosure-repository';
import { DrizzlePitFactsRepository } from './facts-repository';

export type {
  IPitCalendarRepository,
  IPitSectorSnapshotRepository,
  IPitDisclosureRepository,
  IPitFactsRepository,
  TradingDayInfo,
  HaltWindow,
  StatusSnapshot,
  StockStatus,
  SectorSnapshotEntry,
  DisclosureEntry,
  PitFactEntry,
} from './interfaces';

export { DrizzlePitCalendarRepository } from './calendar-repository';
export { DrizzlePitSectorSnapshotRepository } from './sector-snapshot-repository';
export { DrizzlePitDisclosureRepository } from './disclosure-repository';
export { DrizzlePitFactsRepository } from './facts-repository';

let _calendar: IPitCalendarRepository | null = null;
let _sectorSnap: IPitSectorSnapshotRepository | null = null;
let _disclosure: IPitDisclosureRepository | null = null;
let _facts: IPitFactsRepository | null = null;

export function getPitCalendarRepository(): IPitCalendarRepository {
  if (!_calendar) _calendar = new DrizzlePitCalendarRepository(db);
  return _calendar;
}

export function getPitSectorSnapshotRepository(): IPitSectorSnapshotRepository {
  if (!_sectorSnap) _sectorSnap = new DrizzlePitSectorSnapshotRepository(db);
  return _sectorSnap;
}

export function getPitDisclosureRepository(): IPitDisclosureRepository {
  if (!_disclosure) _disclosure = new DrizzlePitDisclosureRepository(db);
  return _disclosure;
}

export function getPitFactsRepository(): IPitFactsRepository {
  if (!_facts) _facts = new DrizzlePitFactsRepository(db);
  return _facts;
}

export function _resetPitRepositories(): void {
  _calendar = null;
  _sectorSnap = null;
  _disclosure = null;
  _facts = null;
}
