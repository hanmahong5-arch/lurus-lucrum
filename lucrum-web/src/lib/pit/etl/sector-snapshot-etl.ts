/**
 * Sector Component Snapshot ETL
 *
 * Bootstrap strategy: freeze the current `stock_sector_mapping` as a
 * snapshot dated "today" (or a caller-specified date). After this, a
 * weekly cron should invoke `snapshotAllSectors(today)` to grow history.
 *
 * For deeper history (pre-bootstrap), a separate backfill job will need
 * to query the eastmoney sector API as-of older dates (when supported).
 *
 * @module lib/pit/etl/sector-snapshot-etl
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sectors as sectorsTable,
  stockSectorMapping,
  stocks as stocksTable,
} from '@/lib/db/schema';
import type { IPitSectorSnapshotRepository } from '../interfaces';
import { getPitSectorSnapshotRepository } from '..';

export interface SnapshotSectorOptions {
  readonly sectorCode: string;
  readonly asOfDate: string;
  readonly repo?: IPitSectorSnapshotRepository;
}

export interface SnapshotSectorResult {
  readonly sectorCode: string;
  readonly asOfDate: string;
  readonly symbolCount: number;
}

/** Snapshot a single sector's current membership as of `asOfDate`. */
export async function snapshotSector(
  options: SnapshotSectorOptions
): Promise<SnapshotSectorResult> {
  const { sectorCode, asOfDate } = options;
  const repo = options.repo ?? getPitSectorSnapshotRepository();

  const sector = await db
    .select({ id: sectorsTable.id })
    .from(sectorsTable)
    .where(eq(sectorsTable.code, sectorCode))
    .limit(1);
  const sectorId = sector[0]?.id;
  if (sectorId === undefined) {
    return { sectorCode, asOfDate, symbolCount: 0 };
  }

  const rows = await db
    .select({
      symbol: stocksTable.symbol,
      weight: stockSectorMapping.weight,
    })
    .from(stockSectorMapping)
    .innerJoin(stocksTable, eq(stockSectorMapping.stockId, stocksTable.id))
    .where(eq(stockSectorMapping.sectorId, sectorId));

  await repo.replaceSnapshot(
    asOfDate,
    sectorCode,
    rows.map((r) => ({ symbol: r.symbol, weight: r.weight }))
  );

  return { sectorCode, asOfDate, symbolCount: rows.length };
}

export interface SnapshotAllSectorsResult {
  readonly asOfDate: string;
  readonly sectorCount: number;
  readonly totalSymbols: number;
}

/** Snapshot every known sector. Intended for weekly cron. */
export async function snapshotAllSectors(
  asOfDate: string,
  repo?: IPitSectorSnapshotRepository
): Promise<SnapshotAllSectorsResult> {
  const allSectors = await db
    .select({ code: sectorsTable.code })
    .from(sectorsTable);

  let total = 0;
  for (const s of allSectors) {
    const r = await snapshotSector({ sectorCode: s.code, asOfDate, repo });
    total += r.symbolCount;
  }
  return {
    asOfDate,
    sectorCount: allSectors.length,
    totalSymbols: total,
  };
}
