/**
 * Drizzle implementation of IPitCalendarRepository.
 *
 * @module lib/pit/calendar-repository
 */

import { and, asc, desc, eq, gte, lte, or, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  tradingCalendar,
  stockHaltCalendar,
  stockStatusHistory,
} from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type {
  IPitCalendarRepository,
  TradingDayInfo,
  HaltWindow,
  StockStatus,
} from './interfaces';

export class DrizzlePitCalendarRepository implements IPitCalendarRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async isTradingDay(date: string): Promise<boolean> {
    const row = await this.db
      .select({ isTrading: tradingCalendar.isTrading })
      .from(tradingCalendar)
      .where(eq(tradingCalendar.date, date))
      .limit(1);

    if (row[0]) return row[0].isTrading;

    // Fallback when calendar not populated: weekday heuristic.
    // Callers that need authoritative answers should ensure ETL has run.
    const d = new Date(date);
    const weekday = d.getUTCDay();
    return weekday !== 0 && weekday !== 6;
  }

  async listTradingDays(startDate: string, endDate: string): Promise<string[]> {
    const rows = await this.db
      .select({ date: tradingCalendar.date })
      .from(tradingCalendar)
      .where(
        and(
          eq(tradingCalendar.isTrading, true),
          gte(tradingCalendar.date, startDate),
          lte(tradingCalendar.date, endDate)
        )
      )
      .orderBy(asc(tradingCalendar.date));
    return rows.map((r) => r.date);
  }

  async upsertTradingDays(days: ReadonlyArray<TradingDayInfo>): Promise<void> {
    if (days.length === 0) return;
    const values = days.map((d) => ({
      date: d.date,
      isTrading: d.isTrading,
      sessionType: d.sessionType,
    }));
    await this.db
      .insert(tradingCalendar)
      .values(values)
      .onConflictDoUpdate({
        target: tradingCalendar.date,
        set: {
          isTrading: sql`excluded.is_trading`,
          sessionType: sql`excluded.session_type`,
        },
      });
  }

  async isHalted(symbol: string, date: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: stockHaltCalendar.id })
      .from(stockHaltCalendar)
      .where(
        and(
          eq(stockHaltCalendar.symbol, symbol),
          lte(stockHaltCalendar.haltDate, date),
          or(
            isNull(stockHaltCalendar.resumeDate),
            gte(stockHaltCalendar.resumeDate, date)
          )
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async listHalts(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<HaltWindow[]> {
    const rows = await this.db
      .select()
      .from(stockHaltCalendar)
      .where(
        and(
          eq(stockHaltCalendar.symbol, symbol),
          lte(stockHaltCalendar.haltDate, endDate),
          or(
            isNull(stockHaltCalendar.resumeDate),
            gte(stockHaltCalendar.resumeDate, startDate)
          )
        )
      )
      .orderBy(asc(stockHaltCalendar.haltDate));

    return rows.map((r) => ({
      symbol: r.symbol,
      haltDate: r.haltDate,
      resumeDate: r.resumeDate,
      reason: r.reason,
    }));
  }

  async upsertHalts(
    rows: ReadonlyArray<HaltWindow & { announceDate?: string | null }>
  ): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((r) => ({
      symbol: r.symbol,
      haltDate: r.haltDate,
      resumeDate: r.resumeDate,
      reason: r.reason,
      announceDate: r.announceDate ?? null,
    }));
    // No unique constraint on (symbol, halt_date), so dedupe in app layer first.
    // Insert blindly; ETL is responsible for idempotency via natural-key checks.
    await this.db.insert(stockHaltCalendar).values(values);
  }

  async getStatusAt(symbol: string, asOfDate: string): Promise<StockStatus> {
    const rows = await this.db
      .select({ status: stockStatusHistory.status })
      .from(stockStatusHistory)
      .where(
        and(
          eq(stockStatusHistory.symbol, symbol),
          lte(stockStatusHistory.fromDate, asOfDate),
          or(
            isNull(stockStatusHistory.toDate),
            gte(stockStatusHistory.toDate, asOfDate)
          )
        )
      )
      .orderBy(desc(stockStatusHistory.fromDate))
      .limit(1);

    const raw = rows[0]?.status;
    if (raw === 'ST' || raw === 'suspended' || raw === 'delisted' || raw === 'active') {
      return raw;
    }
    return 'active';
  }

  async recordStatusChange(row: {
    symbol: string;
    fromDate: string;
    toDate?: string | null;
    status: StockStatus;
    reason?: string | null;
    announceDate?: string | null;
  }): Promise<void> {
    await this.db.insert(stockStatusHistory).values({
      symbol: row.symbol,
      fromDate: row.fromDate,
      toDate: row.toDate ?? null,
      status: row.status,
      reason: row.reason ?? null,
      announceDate: row.announceDate ?? null,
    });
  }
}
