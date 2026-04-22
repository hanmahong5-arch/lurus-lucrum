/**
 * Drizzle implementation of IPitDisclosureRepository.
 *
 * @module lib/pit/disclosure-repository
 */

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { financialDisclosures } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type {
  IPitDisclosureRepository,
  DisclosureEntry,
} from './interfaces';

export class DrizzlePitDisclosureRepository
  implements IPitDisclosureRepository
{
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getLatestAnnounceDate(
    symbol: string,
    reportType: string,
    asOfDate: string
  ): Promise<string | null> {
    const rows = await this.db
      .select({ announceDate: financialDisclosures.announceDate })
      .from(financialDisclosures)
      .where(
        and(
          eq(financialDisclosures.symbol, symbol),
          eq(financialDisclosures.reportType, reportType),
          lte(financialDisclosures.announceDate, asOfDate)
        )
      )
      .orderBy(desc(financialDisclosures.announceDate))
      .limit(1);
    return rows[0]?.announceDate ?? null;
  }

  async listByAnnounceWindow(
    startDate: string,
    endDate: string
  ): Promise<DisclosureEntry[]> {
    const rows = await this.db
      .select()
      .from(financialDisclosures)
      .where(
        and(
          gte(financialDisclosures.announceDate, startDate),
          lte(financialDisclosures.announceDate, endDate)
        )
      )
      .orderBy(asc(financialDisclosures.announceDate));

    return rows.map((r) => ({
      symbol: r.symbol,
      reportPeriod: r.reportPeriod,
      reportType: r.reportType,
      announceDate: r.announceDate,
    }));
  }

  async upsert(rows: ReadonlyArray<DisclosureEntry>): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((r) => ({
      symbol: r.symbol,
      reportPeriod: r.reportPeriod,
      reportType: r.reportType,
      announceDate: r.announceDate,
    }));

    const CHUNK = 5000;
    for (let i = 0; i < values.length; i += CHUNK) {
      await this.db
        .insert(financialDisclosures)
        .values(values.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: [
            financialDisclosures.symbol,
            financialDisclosures.reportPeriod,
            financialDisclosures.reportType,
          ],
          set: {
            announceDate: sql`excluded.announce_date`,
          },
        });
    }
  }
}
