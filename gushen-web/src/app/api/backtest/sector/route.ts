/**
 * Sector Backtest API
 * 行业回测API
 *
 * GET /api/backtest/sector - Returns available strategies (builtin + user) and sectors
 * POST /api/backtest/sector - Validates strategy performance across all stocks in a sector.
 *
 * 验证策略在行业内所有股票的表现
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { db, strategyHistory } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  getSectorStocks,
  getSectorIndexKline,
  getSectorName,
} from "@/lib/data-service/sources/eastmoney-sector";
import { batchGetKlinesWithDateRange } from "@/lib/data-service/batch-kline";
import {
  STRATEGY_DETECTORS,
  scanStockSignals,
  scanStockSignalsEnhanced,
  getAvailableStrategies,
  getScanStatistics,
  type ScanOptions,
} from "@/lib/backtest/signal-scanner";
import type {
  SignalDetail,
  StockSignalResult,
} from "@/lib/backtest/signal-scanner";
import type { BacktestKline } from "@/lib/backtest/engine";
import {
  average,
  median,
  standardDeviation,
  calculateReturnDistribution,
  calculateSignalTimeline,
  calculatePeriodReturn,
  calculateWinStats,
  calculateRiskAdjustedReturns,
} from "@/lib/backtest/statistics";
import { createCostConfig, ZERO_COSTS } from "@/lib/backtest/transaction-costs";
import { validateDateRange } from "@/lib/utils/trading-calendar";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Sector backtest request
 * 行业回测请求
 */
interface SectorBacktestRequest {
  strategy: string; // Strategy ID (e.g., "macd_golden_cross")
  sectorCode: string; // Sector code (e.g., "BK0420")
  startDate: string; // Start date (YYYY-MM-DD)
  endDate: string; // End date (YYYY-MM-DD)
  holdingDays?: number; // Holding period in days (default 5)
  minMarketCap?: number; // Min market cap filter in billion CNY
  maxStocks?: number; // Max number of stocks to analyze
  // Enhanced options / 增强选项
  includeTransactionCosts?: boolean;
  commissionRate?: number;
  slippageRate?: number;
  excludeSTStocks?: boolean;
  excludeNewStocks?: boolean;
  minListingDays?: number;
  deduplicateSignals?: boolean;
  minSignalGapDays?: number;
}

/**
 * Summary statistics
 * 汇总统计
 */
interface SectorBacktestSummary {
  strategy: string;
  strategyName: string;
  sector: string;
  sectorName: string;
  dateRange: { start: string; end: string };
  holdingDays: number;

  totalStocks: number;
  stocksWithSignals: number;
  totalSignals: number;
  winSignals: number;
  lossSignals: number;

  winRate: number;
  avgReturn: number;
  medianReturn: number;
  stdReturn: number;
  maxReturn: number;
  minReturn: number;

  // Risk-adjusted metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  expectancy: number;

  // Benchmark comparison
  sectorIndexReturn: number;
  excessReturn: number;
}

/**
 * Stock ranking entry
 * 股票排名条目
 */
interface StockRankingEntry {
  rank: number;
  symbol: string;
  name: string;
  signalCount: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number; // Cumulative return / 累计收益
  maxReturn: number;
  minReturn: number;
  sharpeRatio: number; // Risk-adjusted return / 风险调整后收益
}

/**
 * Return distribution entry
 * 收益分布条目
 */
interface ReturnDistributionEntry {
  range: string;
  count: number;
  percentage: number;
}

/**
 * Signal timeline entry
 * 信号时间线条目
 */
interface TimelineEntry {
  date: string;
  signalCount: number;
  avgReturn: number;
}

/**
 * Execution metadata
 * 执行元数据
 */
interface ExecutionMeta {
  executionTime: number;
  dataSource: string;
  timestamp: number;
  warnings: string[];
}

/**
 * Complete sector backtest result
 * 完整行业回测结果
 */
interface SectorBacktestResult {
  summary: SectorBacktestSummary;
  stockRanking: StockRankingEntry[];
  signalDetails: SignalDetail[];
  returnDistribution: ReturnDistributionEntry[];
  signalTimeline: TimelineEntry[];
  meta: ExecutionMeta;
}

// =============================================================================
// VALIDATION / 验证
// =============================================================================

/**
 * Validate request parameters
 * 验证请求参数
 */
function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: SectorBacktestRequest;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required" };
  }

  const req = body as Record<string, unknown>;

  // Required fields
  if (!req.strategy || typeof req.strategy !== "string") {
    return { valid: false, error: "strategy is required" };
  }
  if (!req.sectorCode || typeof req.sectorCode !== "string") {
    return { valid: false, error: "sectorCode is required" };
  }
  if (!req.startDate || typeof req.startDate !== "string") {
    return { valid: false, error: "startDate is required" };
  }
  if (!req.endDate || typeof req.endDate !== "string") {
    return { valid: false, error: "endDate is required" };
  }

  // Validate strategy exists
  if (!STRATEGY_DETECTORS[req.strategy]) {
    return {
      valid: false,
      error: `Unknown strategy: ${req.strategy}. Available: ${Object.keys(STRATEGY_DETECTORS).join(", ")}`,
    };
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(req.startDate)) {
    return { valid: false, error: "startDate must be YYYY-MM-DD format" };
  }
  if (!dateRegex.test(req.endDate)) {
    return { valid: false, error: "endDate must be YYYY-MM-DD format" };
  }

  // Validate date range
  const start = new Date(req.startDate);
  const end = new Date(req.endDate);
  if (start >= end) {
    return { valid: false, error: "startDate must be before endDate" };
  }

  // Validate trading days using calendar
  const dateValidation = validateDateRange(req.startDate, req.endDate, 20);
  if (!dateValidation.isValid) {
    return { valid: false, error: dateValidation.error };
  }

  return {
    valid: true,
    data: {
      strategy: req.strategy,
      sectorCode: req.sectorCode,
      startDate: req.startDate,
      endDate: req.endDate,
      holdingDays: typeof req.holdingDays === "number" ? req.holdingDays : 5,
      minMarketCap:
        typeof req.minMarketCap === "number" ? req.minMarketCap : undefined,
      maxStocks: typeof req.maxStocks === "number" ? req.maxStocks : 100,
      // Enhanced options with defaults
      includeTransactionCosts:
        typeof req.includeTransactionCosts === "boolean"
          ? req.includeTransactionCosts
          : true,
      commissionRate:
        typeof req.commissionRate === "number" ? req.commissionRate : 0.0003,
      slippageRate:
        typeof req.slippageRate === "number" ? req.slippageRate : 0.001,
      excludeSTStocks:
        typeof req.excludeSTStocks === "boolean" ? req.excludeSTStocks : true,
      excludeNewStocks:
        typeof req.excludeNewStocks === "boolean"
          ? req.excludeNewStocks
          : false,
      minListingDays:
        typeof req.minListingDays === "number" ? req.minListingDays : 60,
      deduplicateSignals:
        typeof req.deduplicateSignals === "boolean"
          ? req.deduplicateSignals
          : true,
      minSignalGapDays:
        typeof req.minSignalGapDays === "number" ? req.minSignalGapDays : 3,
    },
  };
}

// =============================================================================
// MAIN HANDLER / 主处理函数
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Parse and validate request
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          availableStrategies: getAvailableStrategies(),
        },
        { status: 400 },
      );
    }

    const {
      strategy,
      sectorCode,
      startDate,
      endDate,
      holdingDays,
      minMarketCap,
      maxStocks,
      // Enhanced options
      includeTransactionCosts,
      commissionRate,
      slippageRate,
      excludeSTStocks,
      excludeNewStocks,
      minListingDays,
      deduplicateSignals,
      minSignalGapDays,
    } = validation.data;

    // Get strategy detector
    const strategyDetector = STRATEGY_DETECTORS[strategy];
    if (!strategyDetector) {
      return NextResponse.json(
        { success: false, error: `Strategy not found: ${strategy}` },
        { status: 400 },
      );
    }

    // 1. Fetch sector constituent stocks
    const sectorResponse = await getSectorStocks(sectorCode, maxStocks ?? 100);

    if (!sectorResponse.success || !sectorResponse.data) {
      return NextResponse.json(
        {
          success: false,
          error: sectorResponse.error ?? "Failed to fetch sector stocks",
        },
        { status: 500 },
      );
    }

    // Filter by market cap if specified
    let filteredStocks = sectorResponse.data.stocks;
    if (minMarketCap !== undefined) {
      const minCapValue = minMarketCap * 1e8; // Convert billion to yuan
      filteredStocks = filteredStocks.filter(
        (s) => s.marketCap !== null && s.marketCap >= minCapValue,
      );
    }

    // Limit number of stocks
    filteredStocks = filteredStocks.slice(0, maxStocks ?? 100);

    if (filteredStocks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No stocks found matching criteria",
        },
        { status: 404 },
      );
    }

    // 2. Batch fetch K-line data
    const symbols = filteredStocks.map((s) => s.symbol);
    const klinesResult = await batchGetKlinesWithDateRange(
      symbols,
      "1d",
      startDate,
      endDate,
      {
        concurrency: 10,
      },
    );

    if (klinesResult.data.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch K-line data for any stocks",
        },
        { status: 500 },
      );
    }

    // Add warnings for failed stocks
    if (klinesResult.errors.size > 0) {
      warnings.push(
        `Failed to fetch data for ${klinesResult.errors.size} stocks`,
      );
    }

    // Report partial failures - some stocks may have failed while others succeeded
    if (klinesResult.statistics.failedCount > 0) {
      warnings.push(
        `${klinesResult.statistics.failedCount}/${klinesResult.statistics.totalSymbols} stocks failed to fetch data (tried EastMoney → Sina)`,
      );
    }

    // 3. Build scan options from request parameters
    const scanOptions: Partial<ScanOptions> = {
      holdingDays: holdingDays ?? 5,
      excludeSTStocks: excludeSTStocks ?? true,
      excludeNewStocks: excludeNewStocks ?? false,
      minListingDays: minListingDays ?? 60,
      detectMarketStatus: true,
      transactionCosts: includeTransactionCosts
        ? createCostConfig({
            commission: commissionRate ?? 0.0003,
            slippage: slippageRate ?? 0.001,
            stampDuty: 0.001,
            transferFee: 0.00002,
            minCommission: 5,
          })
        : ZERO_COSTS,
      deduplication: deduplicateSignals
        ? {
            minGapDays: minSignalGapDays ?? 3,
            mergeConsecutive: true,
            keepStrongest: true,
          }
        : undefined,
    };

    // 4. Scan each stock for signals using enhanced scanner
    const stockResults: StockSignalResult[] = [];

    for (const stock of filteredStocks) {
      const klines = klinesResult.data.get(stock.symbol);
      if (!klines || klines.length < 60) {
        continue; // Skip stocks with insufficient data
      }

      // Convert KLineData to BacktestKline
      const backtestKlines: BacktestKline[] = klines.map((k) => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));

      // Use enhanced scanner with all options
      const result = scanStockSignalsEnhanced(
        stock.symbol,
        stock.name,
        backtestKlines,
        strategy,
        scanOptions,
      );

      stockResults.push(result);
    }

    // Get scan statistics for warnings
    const scanStats = getScanStatistics(stockResults);
    if (scanStats.holdingSignals > 0) {
      warnings.push(
        `${scanStats.holdingSignals}个信号仍在持有中(数据不足以计算出场)`,
      );
    }
    if (scanStats.suspendedSignals > 0) {
      warnings.push(`${scanStats.suspendedSignals}个信号因停牌延迟出场`);
    }

    // 4. Fetch sector index for benchmark comparison
    let sectorIndexReturn = 0;
    const sectorKlineResponse = await getSectorIndexKline(
      sectorCode,
      "1d",
      200,
    );

    if (sectorKlineResponse.success && sectorKlineResponse.data) {
      const periodReturn = calculatePeriodReturn(
        sectorKlineResponse.data,
        startDate,
        endDate,
      );
      if (periodReturn) {
        sectorIndexReturn = periodReturn.returnPct;
      }
    } else {
      warnings.push(
        "Failed to fetch sector index data for benchmark comparison",
      );
    }

    // 5. Aggregate results
    const allSignals = stockResults.flatMap((r) => r.signals);
    const returns = allSignals.map((s) => s.returnPct);
    const winStats = calculateWinStats(allSignals);
    const riskMetrics = calculateRiskAdjustedReturns(returns);

    // Build summary
    const summary: SectorBacktestSummary = {
      strategy,
      strategyName: strategyDetector.name,
      sector: sectorCode,
      sectorName: getSectorName(sectorCode),
      dateRange: { start: startDate, end: endDate },
      holdingDays: holdingDays ?? 5,

      totalStocks: filteredStocks.length,
      stocksWithSignals: stockResults.filter((r) => r.totalSignals > 0).length,
      totalSignals: allSignals.length,
      winSignals: winStats.winCount,
      lossSignals: winStats.lossCount,

      winRate: winStats.winRate,
      avgReturn: returns.length > 0 ? average(returns) : 0,
      medianReturn: returns.length > 0 ? median(returns) : 0,
      stdReturn: returns.length > 0 ? standardDeviation(returns) : 0,
      maxReturn: returns.length > 0 ? Math.max(...returns) : 0,
      minReturn: returns.length > 0 ? Math.min(...returns) : 0,

      sharpeRatio: riskMetrics.sharpeRatio,
      sortinoRatio: riskMetrics.sortinoRatio,
      maxDrawdown: riskMetrics.maxDrawdown,
      profitFactor: winStats.profitFactor,
      expectancy: winStats.expectancy,

      sectorIndexReturn,
      excessReturn:
        returns.length > 0 ? average(returns) - sectorIndexReturn : 0,
    };

    // Build stock ranking with per-stock Sharpe ratio
    const stockRanking: StockRankingEntry[] = stockResults
      .filter((r) => r.totalSignals > 0)
      .sort((a, b) => b.avgReturn - a.avgReturn)
      .map((r, i) => {
        // Calculate per-stock Sharpe ratio
        const stockReturns = r.signals.map((s) => s.returnPct);
        const stockRiskMetrics = calculateRiskAdjustedReturns(stockReturns);
        // Calculate total return (sum of all signal returns)
        const stockTotalReturn = stockReturns.reduce((sum, ret) => sum + ret, 0);

        return {
          rank: i + 1,
          symbol: r.symbol,
          name: r.name,
          signalCount: r.totalSignals,
          winRate: r.winRate,
          avgReturn: r.avgReturn,
          totalReturn: stockTotalReturn,
          maxReturn: r.maxReturn,
          minReturn: r.minReturn,
          sharpeRatio: stockRiskMetrics.sharpeRatio,
        };
      });

    // Build return distribution
    const returnDistribution = calculateReturnDistribution(returns).map(
      (bucket) => ({
        range: bucket.range,
        count: bucket.count,
        percentage: bucket.percentage,
      }),
    );

    // Build signal timeline
    const signalTimeline = calculateSignalTimeline(allSignals).map((entry) => ({
      date: entry.date,
      signalCount: entry.signalCount,
      avgReturn: entry.avgReturn,
    }));

    // Sort signals by date (newest first)
    const sortedSignals = [...allSignals].sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
    );

    // Build result
    const result: SectorBacktestResult = {
      summary,
      stockRanking,
      signalDetails: sortedSignals,
      returnDistribution,
      signalTimeline,
      meta: {
        executionTime: Date.now() - startTime,
        dataSource: "eastmoney",
        timestamp: Date.now(),
        warnings,
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Sector backtest error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler - returns available strategies (builtin + user) and sectors
 * GET处理 - 返回可用策略（预定义 + 用户）和板块
 */
export async function GET() {
  const { SW_SECTORS, CONCEPT_SECTORS } =
    await import("@/lib/data-service/sources/eastmoney-sector");

  // Get builtin strategies
  const builtinStrategies = getAvailableStrategies().map((s) => ({
    ...s,
    type: 'builtin' as const,
  }));

  // Get user strategies if logged in
  let userStrategies: Array<{
    id: string;
    name: string;
    description: string;
    type: 'custom';
    code?: string;
    parameters?: Record<string, unknown>;
  }> = [];

  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.id) {
      // Query user strategies from database
      const userStrategyRecords = await db.query.strategyHistory.findMany({
        where: and(
          eq(strategyHistory.userId, session.user.id),
          eq(strategyHistory.isActive, true)
        ),
        orderBy: [desc(strategyHistory.createdAt)],
        limit: 20, // Limit to 20 most recent strategies
      });

      // Transform to API format
      userStrategies = userStrategyRecords.map((s) => ({
        id: `user:${s.id}`, // Prefix with 'user:' to distinguish from builtin
        name: s.strategyName,
        description: s.description || `自定义策略 - ${s.strategyType}`,
        type: 'custom' as const,
        code: s.strategyCode,
        parameters: s.parameters ? JSON.parse(s.parameters) : undefined,
      }));
    }
  } catch (error) {
    // Log error but don't fail the request - just return without user strategies
    console.warn('[Backtest/Sector] Failed to fetch user strategies:', error);
  }

  return NextResponse.json({
    success: true,
    data: {
      strategies: {
        builtin: builtinStrategies,
        user: userStrategies,
      },
      sectors: {
        industries: SW_SECTORS.map((s) => ({
          code: s.code,
          name: s.name,
          nameEn: s.nameEn,
        })),
        concepts: CONCEPT_SECTORS.map((s) => ({
          code: s.code,
          name: s.name,
          nameEn: s.nameEn,
        })),
      },
    },
  });
}
