/**
 * Incremental K-Line Data Updater
 *
 * Fetches only missing date ranges for each stock, avoiding redundant
 * full re-fetches. Designed for the daily cron job (18:00 CST) and
 * on-demand triggered updates.
 *
 * Key behaviors:
 * - Detects per-stock missing date ranges
 * - Batch processes with concurrency control
 * - Rate limits API calls between batches
 * - Continues on individual stock failure (graceful degradation)
 * - Produces structured JSON log output
 *
 * @module lib/cron/incremental-updater
 */

import { db } from "@/lib/db";
import { stocks, klineDaily, dataUpdateLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getLastTradingDay } from "./data-freshness";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of an incremental update run
 */
export interface IncrementalUpdateResult {
  success: boolean;
  stocksChecked: number;
  stocksUpdated: number;
  recordsInserted: number;
  recordsFailed: number;
  failedSymbols: string[];
  durationMs: number;
}

/**
 * Missing date range for a stock
 */
export interface MissingDateRange {
  startDate: string;
  endDate: string;
  missingDays: number;
}

/**
 * Options for the incremental update
 */
export interface IncrementalUpdateOptions {
  /** Specific symbols to update (default: all active) */
  symbols?: string[];
  /** Force update even if data exists */
  force?: boolean;
  /** Maximum concurrent API requests per batch */
  batchSize?: number;
  /** Delay between batches in ms */
  batchDelayMs?: number;
  /** Maximum API retries per stock */
  maxRetries?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default batch size for concurrent API requests
 */
const DEFAULT_BATCH_SIZE = 50;

/**
 * Default delay between batches in milliseconds (rate limiting)
 */
const DEFAULT_BATCH_DELAY_MS = 1000;

/**
 * Default max retries per stock API call
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default lookback days when a stock has no existing data.
 * Fetches approximately 1 year of historical data.
 */
const DEFAULT_NO_DATA_LOOKBACK_DAYS = 30;

/**
 * EastMoney API base URL for K-line data
 */
const EASTMONEY_KLINE_URL =
  "https://push2his.eastmoney.com/api/qt/stock/kline/get";

/**
 * User-Agent header for API requests
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Referer header for API requests
 */
const REFERER = "https://quote.eastmoney.com/";

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Build an array of date strings between start and end (inclusive).
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of date strings
 */
export function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

/**
 * Detect the missing date range for a stock.
 *
 * @param latestDbDate - Latest date in DB (YYYY-MM-DD) or null
 * @param lastTradingDay - Last completed trading day (YYYY-MM-DD)
 * @returns Missing date range info
 */
export function detectMissingDateRange(
  latestDbDate: string | null,
  lastTradingDay: string,
): MissingDateRange {
  if (!latestDbDate) {
    // No data exists: fetch last N days
    const start = new Date(lastTradingDay);
    start.setDate(start.getDate() - DEFAULT_NO_DATA_LOOKBACK_DAYS);
    const startStr = formatDate(start);

    return {
      startDate: startStr,
      endDate: lastTradingDay,
      missingDays: DEFAULT_NO_DATA_LOOKBACK_DAYS,
    };
  }

  if (latestDbDate >= lastTradingDay) {
    return {
      startDate: lastTradingDay,
      endDate: lastTradingDay,
      missingDays: 0,
    };
  }

  // Start from the day after the latest DB date
  const nextDay = new Date(latestDbDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const startDate = formatDate(nextDay);

  const start = new Date(startDate);
  const end = new Date(lastTradingDay);
  const diffDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    startDate,
    endDate: lastTradingDay,
    missingDays: diffDays + 1,
  };
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

// =============================================================================
// API FETCHING
// =============================================================================

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch K-line data from EastMoney API for a date range.
 *
 * @param symbol - Stock symbol (e.g., "600519")
 * @param exchange - Exchange code ("SH" or "SZ")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param maxRetries - Maximum retry attempts
 * @returns Array of parsed K-line records, or null on failure
 */
async function fetchKLineRange(
  symbol: string,
  exchange: string,
  startDate: string,
  endDate: string,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<
  Array<{
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
    amount: number;
  }> | null
> {
  const secId = exchange === "SH" ? `1.${symbol}` : `0.${symbol}`;
  const beg = startDate.replace(/-/g, "");
  const end = endDate.replace(/-/g, "");

  // Calculate limit based on date range
  const daysDiff = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const limit = Math.max(daysDiff + 10, 50); // Buffer for non-trading days

  const url = `${EASTMONEY_KLINE_URL}?secid=${secId}&klt=101&fqt=1&lmt=${limit}&beg=${beg}&end=${end}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: REFERER,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (
        !data ||
        !data.data ||
        !data.data.klines ||
        data.data.klines.length === 0
      ) {
        return []; // No data for this range (non-trading days)
      }

      return (data.data.klines as string[]).map((klineStr: string) => {
        const parts = klineStr.split(",");
        return {
          date: parts[0] ?? "",
          open: parseFloat(parts[1] ?? "0"),
          close: parseFloat(parts[2] ?? "0"),
          high: parseFloat(parts[3] ?? "0"),
          low: parseFloat(parts[4] ?? "0"),
          volume: parseFloat(parts[5] ?? "0"),
          amount: parseFloat(parts[6] ?? "0"),
        };
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[IncrementalUpdater] Attempt ${attempt}/${maxRetries} failed for ${symbol}: ${errMsg}`,
      );

      if (attempt === maxRetries) {
        return null;
      }

      // Exponential backoff: 1s, 2s, 4s
      await delay(Math.pow(2, attempt - 1) * 1000);
    }
  }

  return null;
}

// =============================================================================
// INCREMENTAL UPDATE ENGINE
// =============================================================================

/**
 * Run an incremental update for all active stocks or a subset.
 *
 * For each stock:
 * 1. Query the latest date in kline_daily
 * 2. If stale, fetch only the missing date range from API
 * 3. Upsert new records into kline_daily
 * 4. Continue on individual failure (graceful degradation)
 *
 * @param options - Update options
 * @returns Structured update result
 */
export async function runIncrementalUpdate(
  options: IncrementalUpdateOptions = {},
): Promise<IncrementalUpdateResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const batchDelayMs = options.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const lastTradingDay = getLastTradingDay();

  let stocksChecked = 0;
  let stocksUpdated = 0;
  let recordsInserted = 0;
  let recordsFailed = 0;
  const failedSymbols: string[] = [];

  try {
    // Get stocks to update
    const allStocks = options.symbols
      ? await db
          .select({
            id: stocks.id,
            symbol: stocks.symbol,
            exchange: stocks.exchange,
          })
          .from(stocks)
          .where(eq(stocks.status, "active"))
      : await db
          .select({
            id: stocks.id,
            symbol: stocks.symbol,
            exchange: stocks.exchange,
          })
          .from(stocks)
          .where(eq(stocks.status, "active"));

    // Filter by requested symbols if provided
    const targetStocks = options.symbols
      ? allStocks.filter((s) => options.symbols!.includes(s.symbol))
      : allStocks;

    stocksChecked = targetStocks.length;

    console.log(
      JSON.stringify({
        event: "incremental_update_start",
        stocksChecked,
        lastTradingDay,
        batchSize,
        timestamp: new Date().toISOString(),
      }),
    );

    // Create update log entry
    let logEntryId: number | null = null;
    try {
      const [logEntry] = await db
        .insert(dataUpdateLog)
        .values({
          updateDate: lastTradingDay,
          updateType: "incremental",
          startTime: new Date(),
          status: "running",
        })
        .returning();
      logEntryId = logEntry?.id ?? null;
    } catch {
      // Non-critical: continue even if logging fails
    }

    // Process in batches
    for (let i = 0; i < targetStocks.length; i += batchSize) {
      const batch = targetStocks.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (stock) => {
          try {
            // Get latest date for this stock
            const latestResult = await db
              .select({ date: klineDaily.date })
              .from(klineDaily)
              .where(eq(klineDaily.stockId, stock.id))
              .orderBy(desc(klineDaily.date))
              .limit(1);

            const latestDbDate =
              latestResult.length > 0 ? (latestResult[0]?.date ?? null) : null;

            // Check if update is needed
            if (!options.force && latestDbDate && latestDbDate >= lastTradingDay) {
              return; // Already up to date
            }

            // Detect missing range
            const missing = detectMissingDateRange(latestDbDate, lastTradingDay);

            if (missing.missingDays === 0) {
              return; // No missing data
            }

            // Fetch from API
            const klineData = await fetchKLineRange(
              stock.symbol,
              stock.exchange || "SZ",
              missing.startDate,
              missing.endDate,
              maxRetries,
            );

            if (klineData === null) {
              recordsFailed++;
              failedSymbols.push(stock.symbol);
              return;
            }

            if (klineData.length === 0) {
              return; // No data for this range (non-trading days)
            }

            // Upsert records
            for (const record of klineData) {
              try {
                await db
                  .insert(klineDaily)
                  .values({
                    stockId: stock.id,
                    date: record.date,
                    open: record.open,
                    high: record.high,
                    low: record.low,
                    close: record.close,
                    volume: record.volume,
                    amount: record.amount,
                  })
                  .onConflictDoUpdate({
                    target: [klineDaily.stockId, klineDaily.date],
                    set: {
                      open: record.open,
                      high: record.high,
                      low: record.low,
                      close: record.close,
                      volume: record.volume,
                      amount: record.amount,
                    },
                  });

                recordsInserted++;
              } catch (insertErr) {
                recordsFailed++;
                console.error(
                  `[IncrementalUpdater] Insert failed for ${stock.symbol} ${record.date}:`,
                  insertErr instanceof Error
                    ? insertErr.message
                    : String(insertErr),
                );
              }
            }

            stocksUpdated++;
          } catch (stockErr) {
            recordsFailed++;
            failedSymbols.push(stock.symbol);
            console.error(
              `[IncrementalUpdater] Failed to update ${stock.symbol}:`,
              stockErr instanceof Error
                ? stockErr.message
                : String(stockErr),
            );
          }
        }),
      );

      // Rate limiting: delay between batches
      if (i + batchSize < targetStocks.length) {
        await delay(batchDelayMs);
      }

      // Progress log
      const progress = Math.min(i + batchSize, targetStocks.length);
      console.log(
        JSON.stringify({
          event: "incremental_update_progress",
          progress,
          total: targetStocks.length,
          percent: Math.round((progress / targetStocks.length) * 100),
        }),
      );
    }

    const durationMs = Date.now() - startTime;
    const success = recordsFailed === 0;

    // Update log entry
    if (logEntryId !== null) {
      try {
        await db
          .update(dataUpdateLog)
          .set({
            endTime: new Date(),
            status: success ? "success" : "partial",
            recordsUpdated: recordsInserted,
            recordsFailed,
            errorMessage:
              failedSymbols.length > 0
                ? `Failed symbols: ${failedSymbols.slice(0, 20).join(", ")}`
                : null,
          })
          .where(eq(dataUpdateLog.id, logEntryId));
      } catch {
        // Non-critical: continue even if log update fails
      }
    }

    const result: IncrementalUpdateResult = {
      success,
      stocksChecked,
      stocksUpdated,
      recordsInserted,
      recordsFailed,
      failedSymbols,
      durationMs,
    };

    console.log(
      JSON.stringify({
        event: "incremental_update_complete",
        ...result,
        timestamp: new Date().toISOString(),
      }),
    );

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify({
        event: "incremental_update_error",
        error: errMsg,
        stocksChecked,
        stocksUpdated,
        recordsInserted,
        recordsFailed,
        durationMs,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      success: false,
      stocksChecked,
      stocksUpdated,
      recordsInserted,
      recordsFailed,
      failedSymbols,
      durationMs,
    };
  }
}

/**
 * Run an incremental update for a single symbol.
 * Convenience wrapper for on-demand updates triggered by backtest.
 *
 * @param symbol - Stock symbol
 * @returns Update result
 */
export async function updateSingleStock(
  symbol: string,
): Promise<IncrementalUpdateResult> {
  return runIncrementalUpdate({
    symbols: [symbol],
    batchSize: 1,
    batchDelayMs: 0,
  });
}
