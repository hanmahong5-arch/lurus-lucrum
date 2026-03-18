/**
 * On-Demand Data Fetch API
 * 按需数据采集API
 *
 * POST /api/data/fetch - Fetch and persist K-line data for a stock
 *
 * This API allows manual triggering of data collection:
 * 1. Check if data exists in database with sufficient coverage
 * 2. If not, fetch from EastMoney API
 * 3. Persist to database for future use
 * 4. Return data status and statistics
 *
 * Request body:
 * {
 *   symbol: string,           // Stock symbol (e.g., "600519" or "600519.SH")
 *   startDate?: string,       // Start date (YYYY-MM-DD), default: 1 year ago
 *   endDate?: string,         // End date (YYYY-MM-DD), default: today
 *   forceRefresh?: boolean,   // Force refresh from API even if database has data
 *   timeframe?: string,       // Timeframe (default: "1d")
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     symbol: string,
 *     source: "database" | "api" | "none",
 *     recordCount: number,
 *     coverage: number,
 *     dateRange: { earliest: string, latest: string },
 *     persisted: boolean,
 *     persistedCount: number,
 *     stockName?: string,
 *   },
 *   message: string,
 * }
 *
 * @module api/data/fetch
 */

import { NextRequest, NextResponse } from "next/server";
import { withOptionalUser, type UserContext } from "@/lib/auth";
import { getKLineData } from "@/lib/data-service";
import { getKLineFromDatabase, checkDataAvailability, getDataStatistics } from "@/lib/backtest/db-kline-provider";
import { persistKLinesToDatabase, findOrCreateStock } from "@/lib/backtest/kline-persister";

// =============================================================================
// Types
// =============================================================================

interface FetchRequest {
  symbol: string;
  startDate?: string;
  endDate?: string;
  forceRefresh?: boolean;
  timeframe?: string;
}

interface FetchResponse {
  success: boolean;
  data: {
    symbol: string;
    source: "database" | "api" | "none";
    recordCount: number;
    coverage: number;
    dateRange: {
      earliest: string | null;
      latest: string | null;
    };
    persisted: boolean;
    persistedCount: number;
    stockName?: string;
    processingTime: number;
  } | null;
  message: string;
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get default start date (1 year ago)
 * 获取默认开始日期（1年前）
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0] || "";
}

/**
 * Get today's date
 * 获取今天的日期
 */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0] || "";
}

/**
 * Validate date format (YYYY-MM-DD)
 * 验证日期格式
 */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// =============================================================================
// Main Handler
// =============================================================================

export async function POST(request: NextRequest) {
  return withOptionalUser<FetchResponse>(request, async (req: NextRequest, user: UserContext | null) => {
    const startTime = Date.now();

    try {
      const body = await req.json() as FetchRequest;
      const { symbol, startDate, endDate, forceRefresh = false, timeframe = "1d" } = body;

      // Validate required fields
      if (!symbol || typeof symbol !== "string") {
        return NextResponse.json<FetchResponse>(
          {
            success: false,
            data: null,
            message: "Symbol is required",
            error: "MISSING_SYMBOL",
          },
          { status: 400 }
        );
      }

      // Only support daily timeframe for database storage
      if (timeframe !== "1d") {
        return NextResponse.json<FetchResponse>(
          {
            success: false,
            data: null,
            message: "Only daily (1d) timeframe is supported for database storage",
            error: "UNSUPPORTED_TIMEFRAME",
          },
          { status: 400 }
        );
      }

      // Set default dates
      const effectiveStartDate = startDate || getDefaultStartDate();
      const effectiveEndDate = endDate || getTodayDate();

      // Validate dates
      if (!isValidDate(effectiveStartDate) || !isValidDate(effectiveEndDate)) {
        return NextResponse.json<FetchResponse>(
          {
            success: false,
            data: null,
            message: "Invalid date format. Use YYYY-MM-DD",
            error: "INVALID_DATE_FORMAT",
          },
          { status: 400 }
        );
      }

      // Validate date range
      if (new Date(effectiveStartDate) > new Date(effectiveEndDate)) {
        return NextResponse.json<FetchResponse>(
          {
            success: false,
            data: null,
            message: "Start date must be before end date",
            error: "INVALID_DATE_RANGE",
          },
          { status: 400 }
        );
      }

      console.log(`[DataFetch] Request: symbol=${symbol}, startDate=${effectiveStartDate}, endDate=${effectiveEndDate}, forceRefresh=${forceRefresh}`);

      // Check database availability (unless force refresh)
      let source: "database" | "api" | "none" = "none";
      let recordCount = 0;
      let coverage = 0;
      let dateRange: { earliest: string | null; latest: string | null } = { earliest: null, latest: null };
      let persisted = false;
      let persistedCount = 0;
      let stockName: string | undefined;

      if (!forceRefresh) {
        // Check if database has sufficient data
        const availability = await checkDataAvailability(symbol, effectiveStartDate, effectiveEndDate);

        if (availability.available) {
          // Database has sufficient data
          const dbResult = await getKLineFromDatabase(symbol, effectiveStartDate, effectiveEndDate);
          if (dbResult.success) {
            source = "database";
            recordCount = dbResult.data.length;
            coverage = dbResult.coverage;
            dateRange = { earliest: effectiveStartDate, latest: effectiveEndDate };
            stockName = dbResult.stockInfo?.name;

            console.log(`[DataFetch] Database hit: ${recordCount} records, coverage ${(coverage * 100).toFixed(1)}%`);

            return NextResponse.json<FetchResponse>({
              success: true,
              data: {
                symbol,
                source,
                recordCount,
                coverage,
                dateRange,
                persisted: false,
                persistedCount: 0,
                stockName,
                processingTime: Date.now() - startTime,
              },
              message: `Data retrieved from database with ${(coverage * 100).toFixed(1)}% coverage`,
            });
          }
        }

        console.log(`[DataFetch] Database miss: ${availability.message}`);
      }

      // Fetch from API
      console.log(`[DataFetch] Fetching from API for ${symbol}...`);

      // Calculate days for API request
      const days = Math.ceil(
        (new Date(effectiveEndDate).getTime() - new Date(effectiveStartDate).getTime()) / (24 * 60 * 60 * 1000)
      );

      const klineResult = await getKLineData(symbol, "1d", Math.min(days + 60, 800));

      if (!klineResult.success || !klineResult.data || klineResult.data.length === 0) {
        console.log(`[DataFetch] API fetch failed: ${klineResult.error || "No data"}`);

        return NextResponse.json<FetchResponse>(
          {
            success: false,
            data: null,
            message: `Failed to fetch data from API: ${klineResult.error || "No data available"}`,
            error: "API_FETCH_FAILED",
          },
          { status: 404 }
        );
      }

      source = "api";
      recordCount = klineResult.data.length;

      // Persist to database
      console.log(`[DataFetch] Persisting ${recordCount} records to database...`);

      const persistResult = await persistKLinesToDatabase(symbol, klineResult.data, {
        stockName: undefined,
      });

      if (persistResult.success) {
        persisted = true;
        persistedCount = persistResult.inserted;
        stockName = persistResult.stockId ? await getStockName(persistResult.stockId) : undefined;

        // Get updated statistics
        const stats = await getDataStatistics(symbol);
        if (stats) {
          dateRange = { earliest: stats.earliestDate, latest: stats.latestDate };
          stockName = stats.stockName || undefined;
        }

        // Recalculate coverage after persist
        const newAvailability = await checkDataAvailability(symbol, effectiveStartDate, effectiveEndDate);
        coverage = newAvailability.coverage;

        console.log(`[DataFetch] Persisted ${persistedCount} records, new coverage: ${(coverage * 100).toFixed(1)}%`);
      } else {
        console.warn(`[DataFetch] Persist failed: ${persistResult.error}`);
      }

      return NextResponse.json<FetchResponse>({
        success: true,
        data: {
          symbol,
          source,
          recordCount,
          coverage,
          dateRange,
          persisted,
          persistedCount,
          stockName,
          processingTime: Date.now() - startTime,
        },
        message: persisted
          ? `Fetched ${recordCount} records from API and persisted ${persistedCount} to database`
          : `Fetched ${recordCount} records from API (persist failed)`,
      });
    } catch (error) {
      console.error("[DataFetch] Error:", error);
      return NextResponse.json<FetchResponse>(
        {
          success: false,
          data: null,
          message: error instanceof Error ? error.message : "Internal server error",
          error: "INTERNAL_ERROR",
        },
        { status: 500 }
      );
    }
  });
}

/**
 * Get stock name by ID
 * 根据ID获取股票名称
 */
async function getStockName(stockId: number): Promise<string | undefined> {
  try {
    const { db, stocks } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");

    const result = await db
      .select({ name: stocks.name })
      .from(stocks)
      .where(eq(stocks.id, stockId))
      .limit(1);

    return result[0]?.name;
  } catch {
    return undefined;
  }
}

/**
 * GET handler - Get data status for a symbol
 * GET处理器 - 获取股票的数据状态
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const startDate = searchParams.get("startDate") || getDefaultStartDate();
  const endDate = searchParams.get("endDate") || getTodayDate();

  if (!symbol) {
    return NextResponse.json(
      { success: false, error: "Symbol is required", message: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  try {
    // Check availability
    const availability = await checkDataAvailability(symbol, startDate, endDate);

    // Get statistics
    const stats = await getDataStatistics(symbol);

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        available: availability.available,
        coverage: availability.coverage,
        dataCount: availability.dataCount,
        dateRange: availability.dateRange,
        totalRecords: stats?.totalRecords || 0,
        stockName: availability.stockName || stats?.stockName,
        message: availability.message,
      },
    });
  } catch (error) {
    console.error("[DataFetch] GET error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
