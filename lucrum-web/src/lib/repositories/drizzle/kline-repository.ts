/**
 * Drizzle ORM implementation of IKlineRepository
 *
 * Handles daily K-line data persistence and batch retrieval.
 *
 * @module lib/repositories/drizzle/kline-repository
 */

import { eq, and, gte, lte, inArray, asc, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { stocks, klineDaily, type KLineDaily } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type { IKlineRepository, KlineBar } from '../interfaces';

export class DrizzleKlineRepository implements IKlineRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async getDaily(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<KLineDaily[]> {
    const stock = await this.resolveStockId(symbol);
    if (!stock) return [];

    return this.db
      .select()
      .from(klineDaily)
      .where(
        and(
          eq(klineDaily.stockId, stock.id),
          gte(klineDaily.date, startDate),
          lte(klineDaily.date, endDate),
        ),
      )
      .orderBy(asc(klineDaily.date));
  }

  async upsertDaily(stockId: number, bars: KlineBar[]): Promise<void> {
    if (bars.length === 0) return;

    // Process in batches of 500 to avoid parameter limit
    const BATCH_SIZE = 500;
    for (let i = 0; i < bars.length; i += BATCH_SIZE) {
      const batch = bars.slice(i, i + BATCH_SIZE);
      const values = batch.map((bar) => ({
        stockId,
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        amount: bar.amount,
        adjFactor: bar.adjFactor,
      }));

      await this.db
        .insert(klineDaily)
        .values(values)
        .onConflictDoUpdate({
          target: [klineDaily.stockId, klineDaily.date],
          set: {
            open: klineDaily.open,
            high: klineDaily.high,
            low: klineDaily.low,
            close: klineDaily.close,
            volume: klineDaily.volume,
            amount: klineDaily.amount,
            adjFactor: klineDaily.adjFactor,
          },
        });
    }
  }

  async getLatestDate(symbol: string): Promise<string | null> {
    const stock = await this.resolveStockId(symbol);
    if (!stock) return null;

    const result = await this.db
      .select({ date: klineDaily.date })
      .from(klineDaily)
      .where(eq(klineDaily.stockId, stock.id))
      .orderBy(desc(klineDaily.date))
      .limit(1);

    return result[0]?.date ?? null;
  }

  async getBatch(
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Map<string, KLineDaily[]>> {
    if (symbols.length === 0) return new Map();

    // Resolve all symbols to stock IDs
    const stocksList = await this.db
      .select()
      .from(stocks)
      .where(inArray(stocks.symbol, symbols));

    const idToSymbol = new Map(stocksList.map((s) => [s.id, s.symbol]));
    const stockIds = stocksList.map((s) => s.id);
    if (stockIds.length === 0) return new Map();

    // Single batch query for all stocks
    const klineData = await this.db
      .select()
      .from(klineDaily)
      .where(
        and(
          inArray(klineDaily.stockId, stockIds),
          gte(klineDaily.date, startDate),
          lte(klineDaily.date, endDate),
        ),
      )
      .orderBy(asc(klineDaily.stockId), asc(klineDaily.date));

    // Group results by symbol
    const result = new Map<string, KLineDaily[]>();
    for (const row of klineData) {
      const sym = idToSymbol.get(row.stockId);
      if (!sym) continue;
      if (!result.has(sym)) {
        result.set(sym, []);
      }
      result.get(sym)!.push(row);
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async resolveStockId(
    symbol: string,
  ): Promise<{ id: number } | null> {
    const result = await this.db
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.symbol, symbol))
      .limit(1);
    return result[0] ?? null;
  }
}
