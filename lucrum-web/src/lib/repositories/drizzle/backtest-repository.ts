/**
 * Drizzle ORM implementation of IBacktestRepository
 *
 * Manages persistence and query of backtest history records,
 * including joined strategy information and aggregate statistics.
 *
 * @module lib/repositories/drizzle/backtest-repository
 */

import { eq, and, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  backtestHistory,
  strategyHistory,
  type BacktestHistory,
  type NewBacktestHistory,
} from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type {
  IBacktestRepository,
  BacktestHistoryFilter,
  BacktestHistoryRow,
  BacktestHistoryStats,
  PaginationOptions,
  PaginatedResult,
  SymbolEntry,
} from '../interfaces';

// Column mapping for safe dynamic ordering
const SORT_COLUMNS = {
  createdAt: backtestHistory.createdAt,
  totalReturn: backtestHistory.totalReturn,
  sharpeRatio: backtestHistory.sharpeRatio,
} as const;

type SortableColumn = keyof typeof SORT_COLUMNS;

export class DrizzleBacktestRepository implements IBacktestRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(data: NewBacktestHistory): Promise<number> {
    const result = await this.db
      .insert(backtestHistory)
      .values(data)
      .returning({ id: backtestHistory.id });

    const row = result[0];
    if (!row) {
      throw new Error('Failed to insert backtest history: no ID returned');
    }
    return row.id;
  }

  async findById(id: number): Promise<BacktestHistory | null> {
    const result = await this.db
      .select()
      .from(backtestHistory)
      .where(eq(backtestHistory.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByUser(
    userId: string,
    filters: BacktestHistoryFilter,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<BacktestHistoryRow>> {
    const conditions = [eq(backtestHistory.userId, userId)];

    if (filters.symbol) {
      conditions.push(like(backtestHistory.symbol, `%${filters.symbol}%`));
    }
    if (filters.startDate) {
      conditions.push(
        gte(backtestHistory.createdAt, new Date(filters.startDate)),
      );
    }
    if (filters.endDate) {
      conditions.push(
        lte(backtestHistory.createdAt, new Date(filters.endDate)),
      );
    }

    const whereClause = and(...conditions);

    // Resolve sort column (default to createdAt for safety)
    const sortKey = (pagination.sortBy ?? 'createdAt') as string;
    const orderColumn =
      sortKey in SORT_COLUMNS
        ? SORT_COLUMNS[sortKey as SortableColumn]
        : SORT_COLUMNS.createdAt;

    // Fetch rows with joined strategy info
    const rows = await this.db
      .select({
        id: backtestHistory.id,
        symbol: backtestHistory.symbol,
        stockName: backtestHistory.stockName,
        startDate: backtestHistory.startDate,
        endDate: backtestHistory.endDate,
        timeframe: backtestHistory.timeframe,
        dataSource: backtestHistory.dataSource,
        dataCoverage: backtestHistory.dataCoverage,
        totalReturn: backtestHistory.totalReturn,
        sharpeRatio: backtestHistory.sharpeRatio,
        maxDrawdown: backtestHistory.maxDrawdown,
        winRate: backtestHistory.winRate,
        executionTime: backtestHistory.executionTime,
        notes: backtestHistory.notes,
        createdAt: backtestHistory.createdAt,
        strategyId: strategyHistory.id,
        strategyName: strategyHistory.strategyName,
        strategyType: strategyHistory.strategyType,
      })
      .from(backtestHistory)
      .leftJoin(
        strategyHistory,
        eq(backtestHistory.strategyHistoryId, strategyHistory.id),
      )
      .where(whereClause)
      .orderBy(
        pagination.sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn),
      )
      .limit(pagination.limit)
      .offset(pagination.offset);

    // Total count for pagination
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(backtestHistory)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    return {
      items: rows,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + rows.length < total,
    };
  }

  async deleteById(id: number): Promise<void> {
    await this.db
      .delete(backtestHistory)
      .where(eq(backtestHistory.id, id));
  }

  async getDistinctSymbols(userId: string): Promise<SymbolEntry[]> {
    return this.db
      .selectDistinct({
        symbol: backtestHistory.symbol,
        stockName: backtestHistory.stockName,
      })
      .from(backtestHistory)
      .where(eq(backtestHistory.userId, userId))
      .limit(50);
  }

  async getStats(userId: string): Promise<BacktestHistoryStats> {
    const result = await this.db
      .select({
        avgReturn: sql<number | null>`avg(${backtestHistory.totalReturn})`,
        avgSharpe: sql<number | null>`avg(${backtestHistory.sharpeRatio})`,
        avgWinRate: sql<number | null>`avg(${backtestHistory.winRate})`,
        bestReturn: sql<number | null>`max(${backtestHistory.totalReturn})`,
        worstReturn: sql<number | null>`min(${backtestHistory.totalReturn})`,
      })
      .from(backtestHistory)
      .where(eq(backtestHistory.userId, userId));

    const row = result[0];
    return {
      avgReturn: row?.avgReturn ?? null,
      avgSharpe: row?.avgSharpe ?? null,
      avgWinRate: row?.avgWinRate ?? null,
      bestReturn: row?.bestReturn ?? null,
      worstReturn: row?.worstReturn ?? null,
    };
  }
}
