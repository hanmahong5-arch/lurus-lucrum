/**
 * Drizzle implementation of IPitFactsRepository.
 *
 * Versioned fundamental data store. A single (symbol, field, reportPeriod)
 * may have multiple rows when the value is restated — always pick the most
 * recent `as_of_date` ≤ query date.
 *
 * @module lib/pit/facts-repository
 */

import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { financialFactsPit } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type {
  IPitFactsRepository,
  PitFactEntry,
} from './interfaces';

export class DrizzlePitFactsRepository implements IPitFactsRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getFactAt(
    symbol: string,
    field: string,
    asOfDate: string
  ): Promise<number | null> {
    const rows = await this.db
      .select({ value: financialFactsPit.value })
      .from(financialFactsPit)
      .where(
        and(
          eq(financialFactsPit.symbol, symbol),
          eq(financialFactsPit.field, field),
          lte(financialFactsPit.asOfDate, asOfDate)
        )
      )
      .orderBy(desc(financialFactsPit.asOfDate))
      .limit(1);

    const raw = rows[0]?.value;
    return raw !== undefined && raw !== null ? Number(raw) : null;
  }

  async getFactsAt(
    symbols: ReadonlyArray<string>,
    field: string,
    asOfDate: string
  ): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>();
    if (symbols.length === 0) return result;

    // Use DISTINCT ON for per-symbol latest version. Drizzle lacks a first-class
    // DISTINCT ON builder for this shape, so fall back to raw SQL.
    const rowsRaw = await this.db.execute<{
      symbol: string;
      value: string | null;
    }>(sql`
      SELECT DISTINCT ON (symbol) symbol, value
      FROM ${financialFactsPit}
      WHERE symbol = ANY(${sql.raw(`ARRAY[${symbols.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::varchar[]`)})
        AND field = ${field}
        AND as_of_date <= ${asOfDate}
      ORDER BY symbol, as_of_date DESC
    `);

    const rows = (rowsRaw as unknown as { rows?: Array<{ symbol: string; value: string | null }> }).rows
      ?? (rowsRaw as unknown as Array<{ symbol: string; value: string | null }>);

    for (const s of symbols) result.set(s, null);
    for (const r of rows ?? []) {
      result.set(r.symbol, r.value !== null ? Number(r.value) : null);
    }
    return result;
  }

  async getVersions(
    symbol: string,
    field: string,
    reportPeriod: string
  ): Promise<PitFactEntry[]> {
    const rows = await this.db
      .select()
      .from(financialFactsPit)
      .where(
        and(
          eq(financialFactsPit.symbol, symbol),
          eq(financialFactsPit.field, field),
          eq(financialFactsPit.reportPeriod, reportPeriod)
        )
      )
      .orderBy(desc(financialFactsPit.asOfDate));

    return rows.map((r) => ({
      symbol: r.symbol,
      field: r.field,
      value: r.value !== null ? Number(r.value) : null,
      reportPeriod: r.reportPeriod,
      asOfDate: r.asOfDate,
      source: r.source,
    }));
  }

  async insertFact(row: PitFactEntry): Promise<void> {
    await this.db.insert(financialFactsPit).values({
      symbol: row.symbol,
      field: row.field,
      value: row.value !== null ? String(row.value) : null,
      reportPeriod: row.reportPeriod,
      asOfDate: row.asOfDate,
      source: row.source,
    });
  }

  async insertFactsBulk(rows: ReadonlyArray<PitFactEntry>): Promise<number> {
    if (rows.length === 0) return 0;
    const values = rows.map((r) => ({
      symbol: r.symbol,
      field: r.field,
      value: r.value !== null ? String(r.value) : null,
      reportPeriod: r.reportPeriod,
      asOfDate: r.asOfDate,
      source: r.source,
    }));

    let inserted = 0;
    const CHUNK = 5000;
    for (let i = 0; i < values.length; i += CHUNK) {
      const slice = values.slice(i, i + CHUNK);
      const result = await this.db
        .insert(financialFactsPit)
        .values(slice)
        .onConflictDoNothing({
          target: [
            financialFactsPit.symbol,
            financialFactsPit.field,
            financialFactsPit.reportPeriod,
            financialFactsPit.asOfDate,
          ],
        })
        .returning({ id: financialFactsPit.id });
      inserted += result.length;
    }
    return inserted;
  }
}
