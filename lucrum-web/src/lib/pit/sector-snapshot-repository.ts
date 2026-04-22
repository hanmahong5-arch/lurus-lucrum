/**
 * Drizzle implementation of IPitSectorSnapshotRepository.
 *
 * @module lib/pit/sector-snapshot-repository
 */

import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sectorComponentSnapshots } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type { IPitSectorSnapshotRepository } from './interfaces';

export class DrizzlePitSectorSnapshotRepository
  implements IPitSectorSnapshotRepository
{
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getComponents(sectorCode: string, asOfDate: string): Promise<string[]> {
    // Find the most recent snapshot date ≤ asOfDate for this sector
    const latest = await this.db
      .select({ asOfDate: sectorComponentSnapshots.asOfDate })
      .from(sectorComponentSnapshots)
      .where(
        and(
          eq(sectorComponentSnapshots.sectorCode, sectorCode),
          lte(sectorComponentSnapshots.asOfDate, asOfDate)
        )
      )
      .orderBy(desc(sectorComponentSnapshots.asOfDate))
      .limit(1);

    const snapshotDate = latest[0]?.asOfDate;
    if (!snapshotDate) return [];

    const rows = await this.db
      .select({ symbol: sectorComponentSnapshots.symbol })
      .from(sectorComponentSnapshots)
      .where(
        and(
          eq(sectorComponentSnapshots.sectorCode, sectorCode),
          eq(sectorComponentSnapshots.asOfDate, snapshotDate)
        )
      );

    return rows.map((r) => r.symbol);
  }

  async getSectorsForStock(symbol: string, asOfDate: string): Promise<string[]> {
    // Subquery: for each sector, what is the most recent snapshot date ≤ asOfDate that contains this symbol?
    // Simpler approach: fetch all entries for symbol with date ≤ asOfDate, group by sector, take latest.
    const rows = await this.db
      .select({
        sectorCode: sectorComponentSnapshots.sectorCode,
        asOfDate: sectorComponentSnapshots.asOfDate,
      })
      .from(sectorComponentSnapshots)
      .where(
        and(
          eq(sectorComponentSnapshots.symbol, symbol),
          lte(sectorComponentSnapshots.asOfDate, asOfDate)
        )
      )
      .orderBy(desc(sectorComponentSnapshots.asOfDate));

    // Keep the most recent snapshot per sector and confirm membership at that date.
    const latestBySector = new Map<string, string>();
    for (const r of rows) {
      if (!latestBySector.has(r.sectorCode)) {
        latestBySector.set(r.sectorCode, r.asOfDate);
      }
    }
    return Array.from(latestBySector.keys());
  }

  async replaceSnapshot(
    asOfDate: string,
    sectorCode: string,
    entries: ReadonlyArray<{ symbol: string; weight?: number }>
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Remove any existing snapshot for (date, sector)
      await tx
        .delete(sectorComponentSnapshots)
        .where(
          and(
            eq(sectorComponentSnapshots.asOfDate, asOfDate),
            eq(sectorComponentSnapshots.sectorCode, sectorCode)
          )
        );

      if (entries.length === 0) return;

      const values = entries.map((e) => ({
        asOfDate,
        sectorCode,
        symbol: e.symbol,
        weight: e.weight ?? 1.0,
      }));

      // Chunk to avoid PG parameter limits (~65k params; 4 cols/row)
      const CHUNK = 5000;
      for (let i = 0; i < values.length; i += CHUNK) {
        await tx
          .insert(sectorComponentSnapshots)
          .values(values.slice(i, i + CHUNK));
      }
    });
  }

  async listSnapshotDates(sectorCode: string, limit = 100): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ asOfDate: sectorComponentSnapshots.asOfDate })
      .from(sectorComponentSnapshots)
      .where(eq(sectorComponentSnapshots.sectorCode, sectorCode))
      .orderBy(desc(sectorComponentSnapshots.asOfDate))
      .limit(limit);
    return rows.map((r) => r.asOfDate);
  }
}
