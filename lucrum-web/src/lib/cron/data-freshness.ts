/**
 * Data Freshness Detection Module
 *
 * Provides utilities for determining whether K-line data in the database
 * is up-to-date relative to the latest trading day. Accounts for weekends,
 * China public holidays, and market close time (15:30 CST).
 *
 * @module lib/cron/data-freshness
 */

import { db } from "@/lib/db";
import { stocks, klineDaily } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data freshness evaluation result
 */
export interface DataFreshness {
  /** Whether the data is considered fresh (staleDays <= 1) */
  isFresh: boolean;
  /** Latest date available in the database for this symbol */
  latestDbDate: string | null;
  /** The last completed trading day */
  lastTradingDay: string;
  /** Number of trading days the data is behind */
  staleDays: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Market close hour in China Standard Time (CST / UTC+8).
 * Data for the current day is only considered available after this hour.
 */
const MARKET_CLOSE_HOUR = 15;

/**
 * Market close minute in CST.
 * After 15:30, the current day's data should be available from providers.
 */
const MARKET_CLOSE_MINUTE = 30;

/**
 * Staleness threshold in trading days.
 * Data older than this many trading days triggers an on-demand update.
 */
const STALENESS_THRESHOLD = 1;

/**
 * Default lookback days when no DB data exists.
 * Limits the initial fetch to a reasonable window.
 */
const DEFAULT_LOOKBACK_DAYS = 365;

/**
 * Static list of China public holidays (month-day ranges).
 * This is a simplified heuristic; real holiday data requires annual updates.
 * Format: { month, startDay, endDay } (1-indexed month)
 */
const CHINA_HOLIDAY_RANGES = [
  { month: 1, startDay: 1, endDay: 3 }, // New Year
  { month: 1, startDay: 28, endDay: 31 }, // Spring Festival (approximate)
  { month: 2, startDay: 1, endDay: 6 }, // Spring Festival (approximate)
  { month: 4, startDay: 4, endDay: 6 }, // Qingming
  { month: 5, startDay: 1, endDay: 5 }, // Labor Day
  { month: 6, startDay: 14, endDay: 16 }, // Dragon Boat (approximate)
  { month: 9, startDay: 15, endDay: 17 }, // Mid-Autumn (approximate)
  { month: 10, startDay: 1, endDay: 7 }, // National Day
];

// =============================================================================
// TRADING DAY UTILITIES
// =============================================================================

/**
 * Check if a date is a weekday (Monday-Friday).
 * Uses UTC day to avoid timezone issues when given a properly offset Date.
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Check if a date string falls on a known China public holiday.
 * This is a heuristic approximation; lunar-calendar holidays shift annually.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 */
export function isChinaHoliday(dateStr: string): boolean {
  const parts = dateStr.split("-");
  const month = parseInt(parts[1] ?? "0", 10);
  const day = parseInt(parts[2] ?? "0", 10);

  return CHINA_HOLIDAY_RANGES.some(
    (h) => h.month === month && day >= h.startDay && day <= h.endDay,
  );
}

/**
 * Check if a date is a potential trading day (weekday and not a known holiday).
 */
export function isTradingDay(date: Date): boolean {
  if (!isWeekday(date)) return false;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return !isChinaHoliday(dateStr);
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the last completed trading day relative to the given time.
 *
 * If the current time is after market close (15:30 CST) on a trading day,
 * returns today. Otherwise, returns the most recent previous trading day.
 *
 * @param now - Reference time (defaults to current time)
 * @returns Date string in YYYY-MM-DD format
 */
export function getLastTradingDay(now: Date = new Date()): string {
  // Convert to China timezone offset
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const chinaDate = new Date(utcMs + chinaOffsetMs);

  const chinaHour = chinaDate.getHours();
  const chinaMinute = chinaDate.getMinutes();

  // Check if market has closed today
  const marketClosed =
    chinaHour > MARKET_CLOSE_HOUR ||
    (chinaHour === MARKET_CLOSE_HOUR && chinaMinute >= MARKET_CLOSE_MINUTE);

  // Start from today if market closed, otherwise start from yesterday
  let candidate = new Date(chinaDate);
  if (!marketClosed) {
    candidate.setDate(candidate.getDate() - 1);
  }

  // Walk backwards to find the last trading day (skip weekends and holidays)
  const maxIterations = 10; // Safety limit
  for (let i = 0; i < maxIterations; i++) {
    if (isTradingDay(candidate)) {
      return formatDate(candidate);
    }
    candidate.setDate(candidate.getDate() - 1);
  }

  // Fallback: should never reach here
  return formatDate(candidate);
}

// =============================================================================
// STALENESS CALCULATION
// =============================================================================

/**
 * Calculate the number of trading days between the latest DB date
 * and the last completed trading day.
 *
 * @param latestDbDate - Latest date in DB (YYYY-MM-DD) or null if no data
 * @param now - Reference time
 * @returns Number of stale trading days (0 = fresh, Infinity = no data)
 */
export function calculateStaleDays(
  latestDbDate: string | null,
  now: Date = new Date(),
): number {
  if (!latestDbDate) return Infinity;

  const lastTrading = getLastTradingDay(now);

  if (latestDbDate >= lastTrading) return 0;

  // Count trading days between latestDbDate and lastTrading
  const start = new Date(latestDbDate);
  const end = new Date(lastTrading);
  let count = 0;

  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1); // Start from the day after

  const maxIterations = 500; // Safety limit
  for (let i = 0; i < maxIterations && cursor <= end; i++) {
    if (isTradingDay(cursor)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

// =============================================================================
// DATA FRESHNESS CHECK
// =============================================================================

/**
 * Check data freshness for a specific stock symbol.
 *
 * Queries the database for the latest available date and compares
 * it against the last completed trading day.
 *
 * @param symbol - Stock symbol (e.g., "600519")
 * @param now - Reference time (defaults to current time)
 * @returns DataFreshness result
 */
export async function checkDataFreshness(
  symbol: string,
  now: Date = new Date(),
): Promise<DataFreshness> {
  const lastTradingDay = getLastTradingDay(now);

  try {
    // Find stock in DB
    const stockResult = await db
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.symbol, symbol))
      .limit(1);

    if (stockResult.length === 0) {
      return {
        isFresh: false,
        latestDbDate: null,
        lastTradingDay,
        staleDays: Infinity,
      };
    }

    const stockId = stockResult[0]!.id;

    // Get latest date in kline_daily
    const latestResult = await db
      .select({ date: klineDaily.date })
      .from(klineDaily)
      .where(eq(klineDaily.stockId, stockId))
      .orderBy(desc(klineDaily.date))
      .limit(1);

    const latestDbDate =
      latestResult.length > 0 ? (latestResult[0]!.date ?? null) : null;
    const staleDays = calculateStaleDays(latestDbDate, now);

    return {
      isFresh: staleDays <= STALENESS_THRESHOLD,
      latestDbDate,
      lastTradingDay,
      staleDays,
    };
  } catch (error) {
    console.error(
      "[DataFreshness] Failed to check freshness:",
      error instanceof Error ? error.message : String(error),
    );

    return {
      isFresh: false,
      latestDbDate: null,
      lastTradingDay,
      staleDays: Infinity,
    };
  }
}

/**
 * Check data freshness for multiple symbols in batch.
 *
 * @param symbols - Array of stock symbols
 * @param now - Reference time
 * @returns Map of symbol to DataFreshness
 */
export async function checkBatchFreshness(
  symbols: string[],
  now: Date = new Date(),
): Promise<Map<string, DataFreshness>> {
  const results = new Map<string, DataFreshness>();

  // Process sequentially to avoid overwhelming the DB
  for (const symbol of symbols) {
    const freshness = await checkDataFreshness(symbol, now);
    results.set(symbol, freshness);
  }

  return results;
}
