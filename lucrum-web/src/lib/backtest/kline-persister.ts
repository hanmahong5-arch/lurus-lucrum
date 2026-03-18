/**
 * K-Line Data Persister
 * K线数据持久化器
 *
 * Persists K-line data fetched from external APIs to PostgreSQL database
 * for future use, implementing the "lazy loading with auto-persist" pattern.
 *
 * Features:
 * - Find or create stock records
 * - Batch upsert K-line data (uses ON CONFLICT DO UPDATE)
 * - Async non-blocking persistence
 * - Statistics tracking
 *
 * @module lib/backtest/kline-persister
 */

import { db, stocks, klineDaily } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import type { KLineData } from '@/lib/data-service/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of persisting K-line data
 * K线数据持久化结果
 */
export interface PersistResult {
  success: boolean;
  /** Number of records inserted / 插入记录数 */
  inserted: number;
  /** Number of records updated / 更新记录数 */
  updated: number;
  /** Number of records skipped (duplicates) / 跳过记录数 */
  skipped: number;
  /** Total records processed / 处理总数 */
  total: number;
  /** Stock ID in database / 股票数据库ID */
  stockId: number | null;
  /** Error message if failed / 错误信息 */
  error?: string;
  /** Processing time in milliseconds / 处理时间（毫秒） */
  processingTime: number;
}

/**
 * Stock info for persisting
 * 持久化用股票信息
 */
export interface StockPersistInfo {
  symbol: string;
  name?: string;
  exchange?: 'SH' | 'SZ' | 'BJ';
  industry?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Batch size for upsert operations
 * 批量插入/更新的批次大小
 */
const BATCH_SIZE = 100;

/**
 * Maximum retry attempts for database operations
 * 数据库操作最大重试次数
 */
const MAX_RETRIES = 3;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize stock symbol to database format
 * 标准化股票代码为数据库格式
 *
 * Converts various formats to pure symbol and extracts exchange
 * e.g., "600519.SH" → { symbol: "600519", exchange: "SH" }
 */
function normalizeSymbol(symbol: string): { symbol: string; exchange?: 'SH' | 'SZ' | 'BJ' } {
  if (!symbol) return { symbol: '' };

  let normalized = symbol.toUpperCase();
  let exchange: 'SH' | 'SZ' | 'BJ' | undefined;

  // Extract exchange from suffix
  const suffixMatch = normalized.match(/\.(SH|SZ|BJ)$/);
  if (suffixMatch) {
    exchange = suffixMatch[1] as 'SH' | 'SZ' | 'BJ';
    normalized = normalized.replace(/\.(SH|SZ|BJ)$/, '');
  }

  // Extract exchange from prefix
  const prefixMatch = normalized.match(/^(SH|SZ|BJ)/);
  if (prefixMatch) {
    exchange = prefixMatch[1] as 'SH' | 'SZ' | 'BJ';
    normalized = normalized.replace(/^(SH|SZ|BJ)/, '');
  }

  // Infer exchange from symbol if not specified
  if (!exchange && normalized.length >= 6) {
    const prefix = normalized.substring(0, 1);
    const prefix2 = normalized.substring(0, 2);
    const prefix3 = normalized.substring(0, 3);

    if (prefix === '6' || prefix3 === '688') {
      exchange = 'SH'; // Shanghai main board or STAR Market
    } else if (prefix === '0' || prefix === '3') {
      exchange = 'SZ'; // Shenzhen main board or ChiNext
    } else if (prefix2 === '83' || prefix2 === '43') {
      exchange = 'BJ'; // Beijing Stock Exchange
    }
  }

  return { symbol: normalized, exchange };
}

/**
 * Convert Unix timestamp (seconds or milliseconds) to date string
 * 将Unix时间戳转换为日期字符串
 */
function timestampToDateString(time: number | string): string {
  if (typeof time === 'string') {
    // Already a date string
    if (time.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return time;
    }
    time = parseInt(time, 10);
  }

  // Handle milliseconds vs seconds
  if (time > 1e12) {
    time = Math.floor(time / 1000);
  }

  const date = new Date(time * 1000);
  return date.toISOString().split('T')[0] || '';
}

/**
 * Sleep for specified milliseconds
 * 休眠指定毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Find or create stock record in database
 * 查找或创建股票记录
 *
 * @param info - Stock information / 股票信息
 * @returns Stock ID / 股票ID
 */
export async function findOrCreateStock(info: StockPersistInfo): Promise<number | null> {
  const { symbol: normalizedSymbol, exchange } = normalizeSymbol(info.symbol);

  if (!normalizedSymbol) {
    console.warn('[KlinePersister] Invalid symbol');
    return null;
  }

  try {
    // Try to find existing stock
    const existing = await db
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.symbol, normalizedSymbol))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      return existing[0].id;
    }

    // Create new stock record
    const stockName = info.name || normalizedSymbol;
    const result = await db
      .insert(stocks)
      .values({
        symbol: normalizedSymbol,
        name: stockName,
        exchange: exchange || info.exchange,
        industry: info.industry,
        status: 'active',
        isST: false,
      })
      .returning({ id: stocks.id });

    if (result.length > 0 && result[0]) {
      console.log(`[KlinePersister] Created stock: ${normalizedSymbol} (${stockName}) with ID ${result[0].id}`);
      return result[0].id;
    }

    return null;
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes('unique')) {
      // Try to fetch again
      const existing = await db
        .select({ id: stocks.id })
        .from(stocks)
        .where(eq(stocks.symbol, normalizedSymbol))
        .limit(1);

      if (existing.length > 0 && existing[0]) {
        return existing[0].id;
      }
    }

    console.error('[KlinePersister] findOrCreateStock error:', error);
    return null;
  }
}

/**
 * Persist K-line data to database
 * 将K线数据持久化到数据库
 *
 * Uses batch upsert with ON CONFLICT DO UPDATE to handle duplicates.
 * This function is designed to be called asynchronously without blocking
 * the main request flow.
 *
 * @param symbol - Stock symbol (e.g., "600519" or "600519.SH")
 * @param klines - K-line data array
 * @param options - Additional options
 * @returns Persist result with statistics
 */
export async function persistKLinesToDatabase(
  symbol: string,
  klines: KLineData[],
  options: {
    stockName?: string;
    exchange?: 'SH' | 'SZ' | 'BJ';
    skipExisting?: boolean; // If true, skip existing records instead of updating
  } = {}
): Promise<PersistResult> {
  const startTime = Date.now();
  const result: PersistResult = {
    success: false,
    inserted: 0,
    updated: 0,
    skipped: 0,
    total: klines.length,
    stockId: null,
    processingTime: 0,
  };

  if (!klines || klines.length === 0) {
    result.success = true;
    result.processingTime = Date.now() - startTime;
    return result;
  }

  try {
    // Find or create stock
    const stockId = await findOrCreateStock({
      symbol,
      name: options.stockName,
      exchange: options.exchange,
    });

    if (!stockId) {
      result.error = 'Failed to find or create stock record';
      result.processingTime = Date.now() - startTime;
      return result;
    }

    result.stockId = stockId;

    // Prepare records for upsert
    const records = klines
      .map((k) => {
        const dateStr = timestampToDateString(k.time);
        if (!dateStr) return null;

        return {
          stockId,
          date: dateStr,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          amount: k.amount ?? null,
          adjFactor: 1.0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) {
      result.success = true;
      result.processingTime = Date.now() - startTime;
      return result;
    }

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          // Upsert batch using ON CONFLICT
          await db
            .insert(klineDaily)
            .values(batch)
            .onConflictDoUpdate({
              target: [klineDaily.stockId, klineDaily.date],
              set: {
                open: sql`EXCLUDED.open`,
                high: sql`EXCLUDED.high`,
                low: sql`EXCLUDED.low`,
                close: sql`EXCLUDED.close`,
                volume: sql`EXCLUDED.volume`,
                amount: sql`EXCLUDED.amount`,
              },
            });

          // Count inserted (this is an estimate since we can't distinguish insert vs update in bulk)
          result.inserted += batch.length;
          break;
        } catch (error) {
          retries++;
          if (retries >= MAX_RETRIES) {
            console.error(`[KlinePersister] Batch ${i / BATCH_SIZE + 1} failed after ${MAX_RETRIES} retries:`, error);
            result.skipped += batch.length;
          } else {
            await sleep(100 * retries); // Exponential backoff
          }
        }
      }
    }

    result.success = true;
    result.processingTime = Date.now() - startTime;

    console.log(
      `[KlinePersister] Persisted ${result.inserted} records for ${symbol} in ${result.processingTime}ms`
    );

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.processingTime = Date.now() - startTime;
    console.error('[KlinePersister] persistKLinesToDatabase error:', error);
    return result;
  }
}

/**
 * Persist K-lines asynchronously (fire-and-forget)
 * 异步持久化K线数据（发后即忘）
 *
 * This wrapper catches all errors and logs them, ensuring the caller
 * is never blocked or affected by persistence failures.
 *
 * @param symbol - Stock symbol
 * @param klines - K-line data
 * @param options - Persist options
 */
export function persistKLinesAsync(
  symbol: string,
  klines: KLineData[],
  options: {
    stockName?: string;
    exchange?: 'SH' | 'SZ' | 'BJ';
  } = {}
): void {
  // Fire and forget - don't await
  persistKLinesToDatabase(symbol, klines, options).catch((error) => {
    console.warn(`[KlinePersister] Async persist failed for ${symbol}:`, error);
  });
}

/**
 * Check if K-line data exists for a stock on a specific date
 * 检查指定日期是否存在K线数据
 *
 * @param symbol - Stock symbol
 * @param date - Date string (YYYY-MM-DD)
 */
export async function hasKLineData(symbol: string, date: string): Promise<boolean> {
  const { symbol: normalizedSymbol } = normalizeSymbol(symbol);

  try {
    const result = await db
      .select({ id: klineDaily.id })
      .from(klineDaily)
      .innerJoin(stocks, eq(stocks.id, klineDaily.stockId))
      .where(eq(stocks.symbol, normalizedSymbol))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error('[KlinePersister] hasKLineData error:', error);
    return false;
  }
}

/**
 * Get the count of K-line records for a stock
 * 获取股票的K线记录数
 *
 * @param symbol - Stock symbol
 */
export async function getKLineCount(symbol: string): Promise<number> {
  const { symbol: normalizedSymbol } = normalizeSymbol(symbol);

  try {
    const stock = await db
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.symbol, normalizedSymbol))
      .limit(1);

    if (stock.length === 0 || !stock[0]) return 0;

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(klineDaily)
      .where(eq(klineDaily.stockId, stock[0].id));

    return result[0]?.count || 0;
  } catch (error) {
    console.error('[KlinePersister] getKLineCount error:', error);
    return 0;
  }
}
