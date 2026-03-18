/**
 * Database K-Line Data Provider
 * 数据库K线数据提供者
 *
 * Provides K-line data from PostgreSQL database with:
 * - Data availability checking
 * - Coverage rate calculation
 * - Fallback support indication
 *
 * Priority: Database → API → Mock
 *
 * @module lib/backtest/db-kline-provider
 */

import { db, stocks, klineDaily } from '@/lib/db';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { KLineData } from '@/lib/data-service/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of K-line data fetch from database
 * 数据库K线数据获取结果
 */
export interface DbKLineResult {
  success: boolean;
  data: KLineData[];
  /** Data source identifier / 数据源标识 */
  source: 'database';
  /** Provider name / 提供商名称 */
  provider: 'postgresql';
  /** Coverage rate (0-1) / 覆盖率 */
  coverage: number;
  /** Total expected trading days / 预期交易日总数 */
  expectedDays: number;
  /** Actual data days / 实际数据天数 */
  actualDays: number;
  /** Stock info if found / 股票信息 */
  stockInfo?: {
    id: number;
    name: string;
    symbol: string;
  };
  /** Error message if failed / 错误信息 */
  error?: string;
}

/**
 * Data availability check result
 * 数据可用性检查结果
 */
export interface DataAvailabilityResult {
  available: boolean;
  stockId: number | null;
  stockName: string | null;
  dataCount: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  coverage: number;
  message: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum coverage rate to use database data
 * 使用数据库数据的最低覆盖率
 */
const MIN_COVERAGE_RATE = 0.85;

/**
 * Approximate trading days per year (China A-share market)
 * 每年大约交易日数（中国A股市场）
 */
const TRADING_DAYS_PER_YEAR = 245;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize stock symbol to database format
 * 标准化股票代码为数据库格式
 *
 * Converts various formats to pure symbol (e.g., "600519.SH" → "600519")
 */
function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';

  // Remove market suffix
  const normalized = symbol.replace(/\.(SH|SZ|BJ|sh|sz|bj)$/i, '');

  // Handle "sh600519" or "sz000001" format
  if (/^(sh|sz|bj)/i.test(normalized)) {
    return normalized.substring(2);
  }

  return normalized;
}

/**
 * Calculate expected trading days between two dates
 * 计算两个日期之间的预期交易日数
 */
function calculateExpectedTradingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Rough estimate: 5/7 of total days are weekdays, ~95% of weekdays are trading days
  return Math.ceil(totalDays * (5 / 7) * 0.95);
}

/**
 * Check if a date is a weekend
 * 检查日期是否为周末
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Check data availability for a stock in database
 * 检查股票在数据库中的数据可用性
 *
 * @param symbol - Stock symbol / 股票代码
 * @param startDate - Start date (YYYY-MM-DD) / 开始日期
 * @param endDate - End date (YYYY-MM-DD) / 结束日期
 */
export async function checkDataAvailability(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<DataAvailabilityResult> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return {
      available: false,
      stockId: null,
      stockName: null,
      dataCount: 0,
      dateRange: { earliest: null, latest: null },
      coverage: 0,
      message: 'Invalid symbol',
    };
  }

  try {
    // Find stock in database
    const stockResult = await db
      .select({
        id: stocks.id,
        name: stocks.name,
        symbol: stocks.symbol,
      })
      .from(stocks)
      .where(eq(stocks.symbol, normalizedSymbol))
      .limit(1);

    if (stockResult.length === 0) {
      return {
        available: false,
        stockId: null,
        stockName: null,
        dataCount: 0,
        dateRange: { earliest: null, latest: null },
        coverage: 0,
        message: `Stock ${normalizedSymbol} not found in database`,
      };
    }

    const stock = stockResult[0]!;

    // Count available data points within date range
    const countResult = await db
      .select({
        count: sql<number>`count(*)::int`,
        minDate: sql<string>`min(date)`,
        maxDate: sql<string>`max(date)`,
      })
      .from(klineDaily)
      .where(
        and(
          eq(klineDaily.stockId, stock.id),
          gte(klineDaily.date, startDate),
          lte(klineDaily.date, endDate)
        )
      );

    const stats = countResult[0]!;
    const dataCount = stats.count || 0;
    const expectedDays = calculateExpectedTradingDays(startDate, endDate);
    const coverage = expectedDays > 0 ? dataCount / expectedDays : 0;

    return {
      available: coverage >= MIN_COVERAGE_RATE,
      stockId: stock.id,
      stockName: stock.name,
      dataCount,
      dateRange: {
        earliest: stats.minDate || null,
        latest: stats.maxDate || null,
      },
      coverage,
      message:
        coverage >= MIN_COVERAGE_RATE
          ? `Database data available with ${(coverage * 100).toFixed(1)}% coverage`
          : `Database coverage too low: ${(coverage * 100).toFixed(1)}% (minimum ${MIN_COVERAGE_RATE * 100}% required)`,
    };
  } catch (error) {
    console.error('[DbKLineProvider] checkDataAvailability error:', error);
    return {
      available: false,
      stockId: null,
      stockName: null,
      dataCount: 0,
      dateRange: { earliest: null, latest: null },
      coverage: 0,
      message: error instanceof Error ? error.message : 'Database query failed',
    };
  }
}

/**
 * Get K-line data from database
 * 从数据库获取K线数据
 *
 * @param symbol - Stock symbol / 股票代码
 * @param startDate - Start date (YYYY-MM-DD) / 开始日期
 * @param endDate - End date (YYYY-MM-DD) / 结束日期
 * @param limit - Maximum number of records / 最大记录数
 */
export async function getKLineFromDatabase(
  symbol: string,
  startDate: string,
  endDate: string,
  limit: number = 500
): Promise<DbKLineResult> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return {
      success: false,
      data: [],
      source: 'database',
      provider: 'postgresql',
      coverage: 0,
      expectedDays: 0,
      actualDays: 0,
      error: 'Invalid symbol',
    };
  }

  try {
    // First check availability
    const availability = await checkDataAvailability(normalizedSymbol, startDate, endDate);

    if (!availability.available || !availability.stockId) {
      return {
        success: false,
        data: [],
        source: 'database',
        provider: 'postgresql',
        coverage: availability.coverage,
        expectedDays: calculateExpectedTradingDays(startDate, endDate),
        actualDays: availability.dataCount,
        error: availability.message,
      };
    }

    // Fetch K-line data
    const klineResult = await db
      .select({
        date: klineDaily.date,
        open: klineDaily.open,
        high: klineDaily.high,
        low: klineDaily.low,
        close: klineDaily.close,
        volume: klineDaily.volume,
        amount: klineDaily.amount,
        adjFactor: klineDaily.adjFactor,
      })
      .from(klineDaily)
      .where(
        and(
          eq(klineDaily.stockId, availability.stockId),
          gte(klineDaily.date, startDate),
          lte(klineDaily.date, endDate)
        )
      )
      .orderBy(klineDaily.date)
      .limit(limit);

    // Convert to KLineData format
    const data: KLineData[] = klineResult.map((row) => ({
      // Convert date string to Unix timestamp (seconds)
      time: Math.floor(new Date(row.date).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      amount: row.amount ?? undefined,
    }));

    return {
      success: true,
      data,
      source: 'database',
      provider: 'postgresql',
      coverage: availability.coverage,
      expectedDays: calculateExpectedTradingDays(startDate, endDate),
      actualDays: data.length,
      stockInfo: {
        id: availability.stockId,
        name: availability.stockName || normalizedSymbol,
        symbol: normalizedSymbol,
      },
    };
  } catch (error) {
    console.error('[DbKLineProvider] getKLineFromDatabase error:', error);
    return {
      success: false,
      data: [],
      source: 'database',
      provider: 'postgresql',
      coverage: 0,
      expectedDays: calculateExpectedTradingDays(startDate, endDate),
      actualDays: 0,
      error: error instanceof Error ? error.message : 'Database query failed',
    };
  }
}

/**
 * Get stock info from database
 * 从数据库获取股票信息
 *
 * @param symbol - Stock symbol / 股票代码
 */
export async function getStockInfo(
  symbol: string
): Promise<{ id: number; name: string; symbol: string } | null> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) return null;

  try {
    const result = await db
      .select({
        id: stocks.id,
        name: stocks.name,
        symbol: stocks.symbol,
      })
      .from(stocks)
      .where(eq(stocks.symbol, normalizedSymbol))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('[DbKLineProvider] getStockInfo error:', error);
    return null;
  }
}

/**
 * Get latest available date for a stock in database
 * 获取股票在数据库中的最新可用日期
 *
 * @param symbol - Stock symbol / 股票代码
 */
export async function getLatestDataDate(symbol: string): Promise<string | null> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) return null;

  try {
    const stockInfo = await getStockInfo(normalizedSymbol);
    if (!stockInfo) return null;

    const result = await db
      .select({
        date: klineDaily.date,
      })
      .from(klineDaily)
      .where(eq(klineDaily.stockId, stockInfo.id))
      .orderBy(desc(klineDaily.date))
      .limit(1);

    return result[0]?.date || null;
  } catch (error) {
    console.error('[DbKLineProvider] getLatestDataDate error:', error);
    return null;
  }
}

/**
 * Get data statistics for a stock
 * 获取股票的数据统计
 *
 * @param symbol - Stock symbol / 股票代码
 */
export async function getDataStatistics(
  symbol: string
): Promise<{
  totalRecords: number;
  earliestDate: string | null;
  latestDate: string | null;
  stockName: string | null;
} | null> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) return null;

  try {
    const stockInfo = await getStockInfo(normalizedSymbol);
    if (!stockInfo) return null;

    const result = await db
      .select({
        count: sql<number>`count(*)::int`,
        minDate: sql<string>`min(date)`,
        maxDate: sql<string>`max(date)`,
      })
      .from(klineDaily)
      .where(eq(klineDaily.stockId, stockInfo.id));

    const stats = result[0];

    return {
      totalRecords: stats?.count || 0,
      earliestDate: stats?.minDate || null,
      latestDate: stats?.maxDate || null,
      stockName: stockInfo.name,
    };
  } catch (error) {
    console.error('[DbKLineProvider] getDataStatistics error:', error);
    return null;
  }
}
