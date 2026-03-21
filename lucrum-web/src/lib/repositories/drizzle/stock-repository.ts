/**
 * Drizzle ORM implementation of IStockRepository
 *
 * Encapsulates all stock-related database queries using Drizzle's
 * type-safe query builder.
 *
 * @module lib/repositories/drizzle/stock-repository
 */

import { eq, and, or, like, gte, inArray, asc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  stocks,
  sectors,
  stockSectorMapping,
  type Stock,
} from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type {
  IStockRepository,
  StockSearchOptions,
  SectorStockFilter,
} from '../interfaces';

export class DrizzleStockRepository implements IStockRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findBySymbol(symbol: string): Promise<Stock | null> {
    const result = await this.db
      .select()
      .from(stocks)
      .where(eq(stocks.symbol, symbol))
      .limit(1);
    return result[0] ?? null;
  }

  async search(query: string, options?: StockSearchOptions): Promise<Stock[]> {
    const {
      excludeST = false,
      status = 'active',
      limit = 50,
    } = options ?? {};

    return this.db
      .select()
      .from(stocks)
      .where(
        and(
          or(
            like(stocks.symbol, `%${query}%`),
            like(stocks.name, `%${query}%`),
          ),
          eq(stocks.status, status),
          excludeST ? eq(stocks.isST, false) : undefined,
        ),
      )
      .limit(limit);
  }

  async findBySector(
    sectorCode: string,
    filters?: SectorStockFilter,
  ): Promise<Stock[]> {
    const {
      excludeST = false,
      minMarketCap,
      excludeNewStocks = false,
      minListingDays = 60,
      status = 'active',
      maxStocks = 100,
    } = filters ?? {};

    // Look up sector ID from its code
    const sectorRow = await this.db.query.sectors.findFirst({
      where: eq(sectors.code, sectorCode),
    });
    if (!sectorRow) return [];

    // Get stock IDs via the mapping table
    const mappings = await this.db
      .select({ stockId: stockSectorMapping.stockId })
      .from(stockSectorMapping)
      .where(eq(stockSectorMapping.sectorId, sectorRow.id));

    if (mappings.length === 0) return [];

    const stockIds = mappings.map((m) => m.stockId);

    // Fetch full stock details
    const dbStocks = await this.db
      .select()
      .from(stocks)
      .where(inArray(stocks.id, stockIds));

    // Apply in-memory filters that are difficult to express in a single query
    let filtered = dbStocks.filter((s) => s.status === status);

    if (excludeST) {
      filtered = filtered.filter((s) => !s.isST);
    }

    if (minMarketCap !== undefined) {
      filtered = filtered.filter(
        (s) => s.marketCap !== null && s.marketCap >= minMarketCap,
      );
    }

    if (excludeNewStocks && minListingDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - minListingDays);
      const cutoffStr = cutoffDate.toISOString().split('T')[0] ?? '';
      filtered = filtered.filter(
        (s) => !s.listingDate || s.listingDate <= cutoffStr,
      );
    }

    return filtered.slice(0, maxStocks);
  }

  async findBySymbols(symbols: string[]): Promise<Stock[]> {
    if (symbols.length === 0) return [];
    return this.db
      .select()
      .from(stocks)
      .where(inArray(stocks.symbol, symbols));
  }

  async count(options?: StockSearchOptions): Promise<number> {
    const { excludeST = false, status = 'active' } = options ?? {};

    const conditions = [];
    if (status) conditions.push(eq(stocks.status, status));
    if (excludeST) conditions.push(eq(stocks.isST, false));

    const result = await this.db
      .select({ id: stocks.id })
      .from(stocks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result.length;
  }
}
