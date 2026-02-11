/**
 * Backtest API Route
 * 回测API路由
 *
 * POST /api/backtest - Run a backtest with generated strategy
 *
 * Data Source Priority (数据源优先级):
 * 1. PostgreSQL database (kline_daily table) - 数据库优先
 * 2. EastMoney API - 东方财富API
 * 3. Sina API (fallback) - 新浪API降级
 * 4. Mock generator (demo only) - 模拟数据（仅演示）
 *
 * Authentication:
 * - Optional authentication - anonymous users can run backtests
 * - Authenticated users: results saved to history for later reference
 * - Anonymous users: results returned but not persisted
 *
 * Request body:
 * {
 *   strategyCode: string,     // Generated strategy code
 *   config: {
 *     symbol: string,         // Stock symbol (optional, for real data)
 *     initialCapital: number, // Starting capital (default: 100000)
 *     commission: number,     // Commission rate (default: 0.0003)
 *     slippage: number,       // Slippage rate (default: 0.001)
 *     startDate: string,      // Start date ISO string
 *     endDate: string,        // End date ISO string
 *     timeframe: string,      // "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m"
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { withOptionalUser, type UserContext } from "@/lib/auth";
import {
  runBacktest,
  generateBacktestData,
  type BacktestConfig,
  type BacktestKline,
} from "@/lib/backtest/engine";
import { getKLineData } from "@/lib/data-service";
import { getKLineFromDatabase, checkDataAvailability } from "@/lib/backtest/db-kline-provider";
import { persistKLinesAsync } from "@/lib/backtest/kline-persister";

// Data source tracking interface
interface DataSourceInfo {
  type: "real" | "simulated" | "mixed";
  provider: string;
  reason: string;
  fallbackUsed: boolean;
  realDataCount: number;
  simulatedDataCount: number;
  /** Database coverage rate / 数据库覆盖率 */
  dbCoverage?: number;
  /** Stock name from database / 数据库中的股票名称 */
  stockName?: string;
  /** Whether data is being persisted to database / 是否正在持久化到数据库 */
  persistedAsync?: boolean;
}

export async function POST(request: NextRequest) {
  return withOptionalUser<unknown>(request, async (req: NextRequest, user: UserContext | null) => {
    const startTime = Date.now();

    // Track data source information
    let dataSourceInfo: DataSourceInfo = {
      type: "simulated",
      provider: "mock-generator",
      reason: "Default fallback",
      fallbackUsed: false,
      realDataCount: 0,
      simulatedDataCount: 0,
    };

    try {
      const body = await req.json();
    const { strategyCode, config: userConfig } = body;

    // Validate strategy code
    if (!strategyCode || typeof strategyCode !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Strategy code is required",
        },
        { status: 400 }
      );
    }

    // Build config with defaults
    const config: BacktestConfig = {
      symbol: userConfig?.symbol ?? "000001.SZ",
      initialCapital: userConfig?.initialCapital ?? 100000,
      commission: userConfig?.commission ?? 0.0003,
      slippage: userConfig?.slippage ?? 0.001,
      startDate: userConfig?.startDate ?? getDefaultStartDate(),
      endDate: userConfig?.endDate ?? new Date().toISOString().split("T")[0] ?? "",
      timeframe: userConfig?.timeframe ?? "1d",
    };

    // Calculate days from date range
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    // Validate date range
    if (days <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "End date must be after start date",
        },
        { status: 400 }
      );
    }

    if (days > 3650) {
      return NextResponse.json(
        {
          success: false,
          error: "Date range cannot exceed 10 years",
        },
        { status: 400 }
      );
    }

    // Get K-line data with priority: Database → API → Mock
    let klines: BacktestKline[] = [];
    let dataFetchAttempts: string[] = [];

    // Only fetch real data if symbol is provided and not mock mode
    if (config.symbol && config.symbol !== "mock" && config.symbol !== "") {
      // ====================================================================
      // Priority 1: Try PostgreSQL Database First (数据库优先)
      // ====================================================================
      if (config.timeframe === "1d") {
        // Database only supports daily K-line data
        try {
          console.log(`[Backtest] Attempting database fetch for ${config.symbol}...`);
          const dbResult = await getKLineFromDatabase(
            config.symbol,
            config.startDate,
            config.endDate,
            Math.min(days + 60, 800) // Extra bars for indicator calculation
          );

          if (dbResult.success && dbResult.data.length > 0) {
            // Convert to backtest format
            klines = dbResult.data.map((k) => ({
              time: typeof k.time === "number" ? k.time : Math.floor(new Date(String(k.time)).getTime() / 1000),
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
            }));

            // Update data source info for database data
            dataSourceInfo = {
              type: "real",
              provider: "postgresql-database",
              reason: `Database data with ${(dbResult.coverage * 100).toFixed(1)}% coverage`,
              fallbackUsed: false,
              realDataCount: klines.length,
              simulatedDataCount: 0,
              dbCoverage: dbResult.coverage,
              stockName: dbResult.stockInfo?.name,
            };

            console.log(`[Backtest] Database fetch successful: ${klines.length} bars, coverage: ${(dbResult.coverage * 100).toFixed(1)}%`);
          } else {
            dataFetchAttempts.push(`Database: ${dbResult.error || 'No data'}`);
            console.log(`[Backtest] Database fetch failed: ${dbResult.error}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Database error";
          dataFetchAttempts.push(`Database: ${errMsg}`);
          console.warn("[Backtest] Database fetch error:", errMsg);
        }
      } else {
        dataFetchAttempts.push(`Database: Only supports daily (1d) timeframe, requested ${config.timeframe}`);
      }

      // ====================================================================
      // Priority 2 & 3: Try EastMoney/Sina API (API降级)
      // ====================================================================
      if (klines.length === 0) {
        try {
          console.log(`[Backtest] Attempting API fetch for ${config.symbol}...`);
          const klineResult = await getKLineData(
            config.symbol,
            config.timeframe,
            Math.min(days + 60, 500)
          );

          if (klineResult.success && klineResult.data && klineResult.data.length > 0) {
            // Convert to backtest format
            klines = klineResult.data.map((k) => ({
              time: typeof k.time === "number" ? k.time : Math.floor(new Date(String(k.time)).getTime() / 1000),
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
            }));

            // Update data source info for API data
            dataSourceInfo = {
              type: "real",
              provider: klineResult.source || "eastmoney-api",
              reason: dataFetchAttempts.length > 0
                ? `API fallback (DB: ${dataFetchAttempts[0]})`
                : "Successfully fetched from market data API",
              fallbackUsed: dataFetchAttempts.length > 0,
              realDataCount: klines.length,
              simulatedDataCount: 0,
            };

            console.log(`[Backtest] API fetch successful: ${klines.length} bars from ${klineResult.source}`);

            // ================================================================
            // Auto-persist to database for future use (async, non-blocking)
            // 自动持久化到数据库供后续使用（异步，非阻塞）
            // ================================================================
            if (config.timeframe === "1d" && klineResult.data.length > 0) {
              console.log(`[Backtest] Triggering async persist for ${config.symbol}...`);
              persistKLinesAsync(config.symbol, klineResult.data, {
                stockName: undefined, // Will be fetched/created by persister
              });
              dataSourceInfo.persistedAsync = true;
            }
          } else {
            dataFetchAttempts.push(`API: ${klineResult.error || 'No data returned'}`);
            console.log(`[Backtest] API fetch failed: ${klineResult.error}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "API error";
          dataFetchAttempts.push(`API: ${errMsg}`);
          console.warn("[Backtest] API fetch error:", errMsg);
        }
      }
    } else {
      dataFetchAttempts.push(
        config.symbol === "mock"
          ? "Mock mode requested by user"
          : "No symbol provided"
      );
    }

    // ====================================================================
    // Priority 4: Generate Mock Data (模拟数据降级)
    // ====================================================================
    if (klines.length === 0) {
      console.log(`[Backtest] Generating mock data for ${days} days...`);
      klines = generateBacktestData(days, 50 + Math.random() * 100, 0.02);

      // Update data source info for simulated data
      dataSourceInfo = {
        type: "simulated",
        provider: "mock-generator",
        reason: dataFetchAttempts.length > 0
          ? `Fallback to mock (${dataFetchAttempts.join('; ')})`
          : "Mock mode requested",
        fallbackUsed: config.symbol !== "mock" && config.symbol !== undefined,
        realDataCount: 0,
        simulatedDataCount: klines.length,
      };
    }

    // Filter klines by date range
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // Keep some bars before start date for indicator warmup
    const warmupBars = 60;
    const filteredKlines = klines.filter((k, index) => {
      if (index < warmupBars) return true; // Keep warmup bars
      return k.time >= startTimestamp && k.time <= endTimestamp;
    });

    if (filteredKlines.length < 20) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient data for backtesting (minimum 20 bars required)",
        },
        { status: 400 }
      );
    }

      // Run backtest
      const result = await runBacktest(strategyCode, filteredKlines, config);

      const totalTime = Date.now() - startTime;

      // TODO: If user is authenticated, save backtest result to history
      // This will be implemented when the history service integration is complete
      if (user) {
        console.log(`[Backtest] Authenticated user ${user.userId} ran backtest on ${config.symbol}`);
        // Future: saveBacktestHistory({ userId: user.userId, ... })
      }

      return NextResponse.json({
        success: true,
        data: result,
        meta: {
          barsProcessed: filteredKlines.length,
          executionTime: totalTime,
          // Enhanced data source information
          dataSource: {
            type: dataSourceInfo.type,
            provider: dataSourceInfo.provider,
            reason: dataSourceInfo.reason,
            fallbackUsed: dataSourceInfo.fallbackUsed,
            realDataCount: dataSourceInfo.realDataCount,
            simulatedDataCount: dataSourceInfo.simulatedDataCount,
            // Database-specific fields
            dbCoverage: dataSourceInfo.dbCoverage,
            stockName: dataSourceInfo.stockName,
            // Auto-persist status
            persistedAsync: dataSourceInfo.persistedAsync || false,
          },
          // Legacy field for backward compatibility
          dataSourceLegacy: dataSourceInfo.type === "real" ? "real" : "simulated",
          // User authentication status
          isAuthenticated: !!user,
          userId: user?.userId || null,
        },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Backtest API error:", err);
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Internal server error",
        },
        { status: 500 }
      );
    }
  });
}

/**
 * Get default start date (1 year ago)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0] ?? "";
}

export const dynamic = "force-dynamic";
