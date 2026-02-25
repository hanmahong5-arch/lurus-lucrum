/**
 * Unified Backtest API Route
 * 统一回测API路由
 *
 * Handles multi-level backtest requests (sector, stock, portfolio)
 * 处理多层级回测请求（板块、个股、组合）
 *
 * Features:
 * - Comprehensive input validation
 * - Detailed error handling with error codes
 * - Request timeout handling
 * - Rate limiting preparation
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { checkUsage, incrementUsage } from "@/lib/middleware/usage-tracker";
import { upsertPopularStrategy, recordUserEvent } from "@/lib/db/queries";
import type {
  UnifiedBacktestRequest,
  UnifiedBacktestResult,
  BacktestTarget,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
  SectorAggregatedResult,
  StockBacktestResult,
  DetailedTrade,
  BacktestKline,
} from "@/lib/backtest/types";
import {
  buildReturnMetrics,
  buildRiskMetrics,
  buildTradingMetrics,
} from "@/lib/backtest/statistics";
import { runDiagnostics } from "@/lib/backtest/diagnostics";
import {
  getSectorStocks,
  type SectorStock,
} from "@/lib/data-service/sources/eastmoney-sector";
import { runBacktest } from "@/lib/backtest/engine";
import { getKLineFromDatabase } from "@/lib/backtest/db-kline-provider";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT = 60000;

/** Maximum stocks in sector backtest */
const MAX_SECTOR_STOCKS = 50;

/** Maximum stocks in portfolio */
const MAX_PORTFOLIO_STOCKS = 50;

/** Minimum initial capital */
const MIN_CAPITAL = 10000;

/** Maximum initial capital */
const MAX_CAPITAL = 100000000000;

/** Minimum backtest period in days */
const MIN_BACKTEST_DAYS = 5;

// =============================================================================
// ERROR CODES / 错误代码
// =============================================================================

const ErrorCodes = {
  // Validation errors (4xx)
  INVALID_REQUEST: "BT100",
  INVALID_TARGET: "BT101",
  INVALID_DATE_RANGE: "BT102",
  INVALID_CAPITAL: "BT103",
  INVALID_STRATEGY: "BT104",
  EMPTY_PORTFOLIO: "BT105",
  PORTFOLIO_TOO_LARGE: "BT106",
  MISSING_REQUIRED_FIELD: "BT107",

  // Data errors
  DATA_FETCH_FAILED: "BT200",
  INSUFFICIENT_DATA: "BT201",
  SYMBOL_NOT_FOUND: "BT203",

  // Engine errors
  ENGINE_TIMEOUT: "BT400",
  ENGINE_ERROR: "BT401",

  // Quota errors
  QUOTA_EXCEEDED: "BT300",

  // System errors
  UNKNOWN_ERROR: "BT999",
} as const;

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface BacktestJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result?: UnifiedBacktestResult;
  error?: string;
}

interface APIError {
  code: string;
  message: string;
  messageEn: string;
  details?: unknown;
  recoverable: boolean;
  suggestedAction?: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

// In-memory job store (in production would use Redis or similar)
const jobStore = new Map<string, BacktestJob>();

// =============================================================================
// ERROR HELPERS / 错误辅助函数
// =============================================================================

/**
 * Create standardized API error response
 */
function createErrorResponse(
  code: string,
  message: string,
  messageEn: string,
  status: number,
  details?: unknown,
  suggestedAction?: string,
): NextResponse<APIResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        messageEn,
        details,
        recoverable: status < 500,
        suggestedAction,
      },
    },
    { status },
  );
}

// =============================================================================
// VALIDATION / 验证函数
// =============================================================================

/**
 * Validate backtest request
 */
function validateRequest(
  body: unknown,
):
  | { valid: true; data: UnifiedBacktestRequest }
  | { valid: false; error: NextResponse } {
  // Check if body exists
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        "请求体无效",
        "Invalid request body",
        400,
        undefined,
        "请检查请求格式",
      ),
    };
  }

  const request = body as Record<string, unknown>;

  // Validate target
  if (!request.target || typeof request.target !== "object") {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_TARGET,
        "请选择回测标的",
        "Target is required",
        400,
        undefined,
        "在标的选择区选择板块、个股或组合",
      ),
    };
  }

  const target = request.target as Record<string, unknown>;
  const mode = target.mode as string;

  if (!mode || !["sector", "stock", "portfolio"].includes(mode)) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_TARGET,
        "无效的回测模式",
        `Invalid target mode: ${mode}`,
        400,
        { validModes: ["sector", "stock", "portfolio"] },
        "请选择有效的回测模式",
      ),
    };
  }

  // Mode-specific validation
  if (mode === "sector" && !target.sector) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_TARGET,
        "请选择板块",
        "Sector is required for sector mode",
        400,
        undefined,
        "在板块选项卡中选择一个板块",
      ),
    };
  }

  if (mode === "stock" && !target.stock) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_TARGET,
        "请选择股票",
        "Stock is required for stock mode",
        400,
        undefined,
        "在个股选项卡中选择一只股票",
      ),
    };
  }

  if (mode === "portfolio") {
    const portfolio = target.portfolio as Record<string, unknown> | undefined;
    if (!portfolio) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.EMPTY_PORTFOLIO,
          "请添加股票到组合",
          "Portfolio is required for portfolio mode",
          400,
          undefined,
          "在组合选项卡中添加股票",
        ),
      };
    }

    const stocks = portfolio.stocks as unknown[] | undefined;
    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.EMPTY_PORTFOLIO,
          "组合中没有股票",
          "Portfolio is empty",
          400,
          undefined,
          "请添加至少一只股票到组合",
        ),
      };
    }

    if (stocks.length > MAX_PORTFOLIO_STOCKS) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.PORTFOLIO_TOO_LARGE,
          `组合股票数量超过限制 (最多${MAX_PORTFOLIO_STOCKS}只)`,
          `Portfolio exceeds maximum size (${MAX_PORTFOLIO_STOCKS})`,
          400,
          { maxSize: MAX_PORTFOLIO_STOCKS, actualSize: stocks.length },
          `请减少组合股票数量至${MAX_PORTFOLIO_STOCKS}只以内`,
        ),
      };
    }
  }

  // Validate config
  if (!request.config || typeof request.config !== "object") {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.MISSING_REQUIRED_FIELD,
        "缺少配置参数",
        "Config is required",
        400,
        undefined,
        "请设置回测参数",
      ),
    };
  }

  const config = request.config as Record<string, unknown>;

  // Validate dates
  const startDate = config.startDate as string;
  const endDate = config.endDate as string;

  if (!startDate || !endDate) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        "请设置回测日期范围",
        "Start date and end date are required",
        400,
        undefined,
        "请设置开始日期和结束日期",
      ),
    };
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        "日期格式无效",
        "Invalid date format (expected YYYY-MM-DD)",
        400,
        { startDate, endDate },
        "请使用YYYY-MM-DD格式",
      ),
    };
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        "日期无效",
        "Invalid date values",
        400,
        { startDate, endDate },
        "请输入有效的日期",
      ),
    };
  }

  if (start >= end) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        "开始日期必须早于结束日期",
        "Start date must be before end date",
        400,
        { startDate, endDate },
        "请调整日期范围",
      ),
    };
  }

  if (end > today) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        "结束日期不能超过今天",
        "End date cannot be in the future",
        400,
        { endDate, today: today.toISOString().split("T")[0] },
        "请选择今天或之前的日期",
      ),
    };
  }

  // Check minimum period
  const diffDays = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < MIN_BACKTEST_DAYS) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_DATE_RANGE,
        `回测周期至少需要${MIN_BACKTEST_DAYS}天`,
        `Backtest period must be at least ${MIN_BACKTEST_DAYS} days`,
        400,
        { days: diffDays, minDays: MIN_BACKTEST_DAYS },
        "请扩大日期范围",
      ),
    };
  }

  // Validate capital
  const capital = config.initialCapital as number;
  if (capital !== undefined) {
    if (typeof capital !== "number" || !isFinite(capital)) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.INVALID_CAPITAL,
          "初始资金无效",
          "Invalid initial capital",
          400,
          { capital },
          "请输入有效的数字",
        ),
      };
    }

    if (capital < MIN_CAPITAL) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.INVALID_CAPITAL,
          `初始资金至少${MIN_CAPITAL.toLocaleString()}元`,
          `Initial capital must be at least ${MIN_CAPITAL}`,
          400,
          { capital, minCapital: MIN_CAPITAL },
          `请设置初始资金至少${MIN_CAPITAL.toLocaleString()}元`,
        ),
      };
    }

    if (capital > MAX_CAPITAL) {
      return {
        valid: false,
        error: createErrorResponse(
          ErrorCodes.INVALID_CAPITAL,
          `初始资金不能超过${MAX_CAPITAL.toLocaleString()}元`,
          `Initial capital cannot exceed ${MAX_CAPITAL}`,
          400,
          { capital, maxCapital: MAX_CAPITAL },
          `请设置初始资金不超过${MAX_CAPITAL.toLocaleString()}元`,
        ),
      };
    }
  }

  // Validate commission and slippage
  const commission = config.commission as number | undefined;
  if (
    commission !== undefined &&
    (typeof commission !== "number" || commission < 0 || commission > 0.01)
  ) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        "佣金率应在0-1%之间",
        "Commission rate should be between 0 and 1%",
        400,
        { commission },
        "请设置有效的佣金率",
      ),
    };
  }

  const slippage = config.slippage as number | undefined;
  if (
    slippage !== undefined &&
    (typeof slippage !== "number" || slippage < 0 || slippage > 0.05)
  ) {
    return {
      valid: false,
      error: createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        "滑点应在0-5%之间",
        "Slippage should be between 0 and 5%",
        400,
        { slippage },
        "请设置有效的滑点",
      ),
    };
  }

  return {
    valid: true,
    data: body as UnifiedBacktestRequest,
  };
}

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Build a minimal strategy code string from strategy request params.
 * The engine's parseStrategyCode() extracts indicators via keyword detection,
 * and parameters via "key = value" regex patterns.
 * 根据策略请求参数构建最小策略代码字符串
 */
function buildStrategyCode(
  strategy?: UnifiedBacktestRequest["strategy"],
): string {
  if (!strategy) {
    return "class MACrossStrategy:\n  fast_window = 5\n  slow_window = 20\n  sma";
  }

  if (strategy.type === "custom" && strategy.customCode) {
    return strategy.customCode;
  }

  const params = strategy.params ?? {};
  const builtinId = strategy.builtinId ?? "ma_cross";

  switch (builtinId) {
    case "ma_cross": {
      const fast = params.fast_window ?? params.fast ?? 5;
      const slow = params.slow_window ?? params.slow ?? 20;
      return `class MACrossStrategy:\n  fast_window = ${fast}\n  slow_window = ${slow}\n  sma`;
    }
    case "rsi": {
      const period = params.rsi_period ?? params.rsi_window ?? 14;
      const buy = params.rsi_buy ?? params.oversold ?? 30;
      const sell = params.rsi_sell ?? params.overbought ?? 70;
      return `class RSIStrategy:\n  rsi_period = ${period}\n  rsi_buy = ${buy}\n  rsi_sell = ${sell}\n  rsi RSI`;
    }
    case "macd": {
      return `class MACDStrategy:\n  macd MACD`;
    }
    case "boll": {
      const period = params.boll_period ?? params.period ?? 20;
      return `class BollingerStrategy:\n  boll_period = ${period}\n  boll 布林`;
    }
    default:
      return `class MACrossStrategy:\n  fast_window = 5\n  slow_window = 20\n  sma`;
  }
}

/**
 * Run backtest for a single stock using real K-line data from PostgreSQL.
 * Falls back to BT201/BT202 errors when data coverage is insufficient.
 * 使用 PostgreSQL 真实 K 线数据对单只股票运行回测
 */
async function runStockBacktest(
  symbol: string,
  symbolName: string,
  config: UnifiedBacktestRequest["config"],
  strategy?: UnifiedBacktestRequest["strategy"],
): Promise<{
  equityCurve: Array<{
    date: string;
    equity: number;
    benchmark?: number;
    drawdown: number;
  }>;
  trades: DetailedTrade[];
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
  dataSource: "postgresql";
}> {
  // Fetch K-line data from database
  const dbResult = await getKLineFromDatabase(
    symbol,
    config.startDate,
    config.endDate,
  );

  if (!dbResult.success || dbResult.data.length < 5) {
    if (
      dbResult.coverage !== undefined &&
      dbResult.coverage < 0.85
    ) {
      const err = new Error(
        `数据不足，无法回测: ${symbol} 数据覆盖率 ${(dbResult.coverage * 100).toFixed(1)}%（要求 ≥ 85%）`,
      );
      (err as Error & { code: string }).code = ErrorCodes.INSUFFICIENT_DATA;
      throw err;
    }
    const err = new Error(
      `数据库连接失败，无法获取 ${symbol} 的 K 线数据: ${dbResult.error ?? "unknown"}`,
    );
    (err as Error & { code: string }).code = "BT202";
    throw err;
  }

  // Convert KLineData to BacktestKline (drop the optional amount field)
  const klines: BacktestKline[] = dbResult.data.map((kl) => ({
    time: kl.time,
    open: kl.open,
    high: kl.high,
    low: kl.low,
    close: kl.close,
    volume: kl.volume,
  }));

  // Build BacktestConfig
  const btConfig = {
    symbol,
    initialCapital: config.initialCapital,
    commission: config.commission ?? 0.0003,
    slippage: config.slippage ?? 0.001,
    startDate: config.startDate,
    endDate: config.endDate,
    timeframe: (config.timeframe ?? "1d") as "1d",
  };

  // Build strategy code string and run engine
  const strategyCode = buildStrategyCode(strategy);
  const result = await runBacktest(strategyCode, klines, btConfig);

  // EquityPoint[] already has { date, equity, drawdown } — directly compatible
  const equityCurve = result.equityCurve.map((ep) => ({
    date: ep.date,
    equity: ep.equity,
    drawdown: ep.drawdown,
  }));

  // Prefer detailed trades from enhanced result; fall back to an empty array
  const trades: DetailedTrade[] = result.enhanced?.trades ?? [];

  // Build unified metrics
  const returnMetrics = buildReturnMetrics(equityCurve);
  const riskMetrics = buildRiskMetrics(equityCurve);
  const tradingMetrics = buildTradingMetrics(
    trades.filter((t) => t.type === "sell"),
    equityCurve.length,
  );

  return { equityCurve, trades, returnMetrics, riskMetrics, tradingMetrics, dataSource: "postgresql" };
}

/**
 * Run sector-level backtest with timeout
 * 运行板块级别回测（带超时）
 */
async function runSectorBacktest(
  target: BacktestTarget,
  request: UnifiedBacktestRequest,
): Promise<UnifiedBacktestResult> {
  const jobId = uuidv4();
  const startTime = Date.now();

  if (!target.sector) {
    throw new Error("Sector target is required for sector mode");
  }

  // Get sector stocks with error handling
  let stocks: SectorStock[];
  try {
    const sectorResponse = await getSectorStocks(
      target.sector.code,
      MAX_SECTOR_STOCKS,
    );
    if (!sectorResponse.success || !sectorResponse.data) {
      throw new Error(sectorResponse.error || "Failed to fetch sector stocks");
    }
    stocks = sectorResponse.data.stocks;
  } catch (error) {
    throw new Error(
      `获取板块成分股失败: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  }

  if (stocks.length === 0) {
    throw new Error("板块中没有股票");
  }

  const stockResults: StockBacktestResult[] = [];
  let totalEquityCurve: Array<{
    date: string;
    equity: number;
    benchmark?: number;
    drawdown: number;
  }> = [];
  let allTrades: DetailedTrade[] = [];

  // Run backtest for each stock (limited for performance)
  const limitedStocks = stocks.slice(0, 20);
  for (const stock of limitedStocks) {
    // Check timeout
    if (Date.now() - startTime > REQUEST_TIMEOUT - 5000) {
      console.warn("Sector backtest approaching timeout, stopping early");
      break;
    }

    try {
      const result = await runStockBacktest(
        stock.symbol,
        stock.name,
        request.config,
        request.strategy,
      );

      stockResults.push({
        symbol: stock.symbol,
        name: stock.name,
        totalReturn: result.returnMetrics.totalReturn,
        winRate: result.tradingMetrics.winRate,
        tradeCount: result.tradingMetrics.totalTrades,
        contribution: 100 / limitedStocks.length,
        sharpeRatio: result.riskMetrics.sharpeRatio,
        maxDrawdown: result.riskMetrics.maxDrawdown,
      });

      if (totalEquityCurve.length === 0) {
        totalEquityCurve = result.equityCurve;
      }

      allTrades = allTrades.concat(result.trades);
    } catch (error) {
      console.warn(`Failed to backtest ${stock.symbol}:`, error);
      // Continue with other stocks
    }
  }

  if (stockResults.length === 0) {
    throw new Error("所有股票回测失败");
  }

  // Sort by return
  stockResults.sort((a, b) => b.totalReturn - a.totalReturn);

  // Calculate aggregated metrics with safe division
  const avgReturn =
    stockResults.length > 0
      ? stockResults.reduce((sum, s) => sum + s.totalReturn, 0) /
        stockResults.length
      : 0;
  const avgWinRate =
    stockResults.length > 0
      ? stockResults.reduce((sum, s) => sum + s.winRate, 0) /
        stockResults.length
      : 0;
  const avgSharpe =
    stockResults.length > 0
      ? stockResults.reduce((sum, s) => sum + s.sharpeRatio, 0) /
        stockResults.length
      : 0;

  // Build result
  const returnMetrics = buildReturnMetrics(totalEquityCurve);
  const riskMetrics = buildRiskMetrics(totalEquityCurve);
  const tradingMetrics = buildTradingMetrics(
    allTrades.filter((t) => t.type === "sell"),
    totalEquityCurve.length,
  );

  // Diagnostics
  const diagnostics =
    request.options?.includeDiagnostics !== false
      ? runDiagnostics({ returnMetrics, riskMetrics, tradingMetrics })
      : undefined;

  const sectorResult: SectorAggregatedResult = {
    sectorCode: target.sector.code,
    sectorName: target.sector.name,
    stockCount: stocks.length,
    backtestCount: stockResults.length,
    avgReturn,
    medianReturn:
      stockResults[Math.floor(stockResults.length / 2)]?.totalReturn ??
      avgReturn,
    bestReturn: stockResults[0]?.totalReturn ?? 0,
    worstReturn: stockResults[stockResults.length - 1]?.totalReturn ?? 0,
    avgWinRate,
    avgSharpeRatio: avgSharpe,
    stockResults,
    topPerformers: stockResults.slice(0, 5),
    bottomPerformers: stockResults.slice(-5).reverse(),
  };

  return {
    jobId,
    timestamp: Date.now(),
    executionTime: Date.now() - startTime,
    target,
    returnMetrics,
    riskMetrics,
    tradingMetrics,
    equityCurve: totalEquityCurve,
    sectorResult,
    diagnostics,
    config: {
      symbol: target.sector.code,
      initialCapital: request.config.initialCapital,
      commission: request.config.commission ?? 0.0003,
      slippage: request.config.slippage ?? 0.001,
      startDate: request.config.startDate,
      endDate: request.config.endDate,
      timeframe: request.config.timeframe ?? "1d",
    },
    strategy: {
      name: request.strategy?.builtinId ?? "default",
      params: request.strategy?.params ?? {},
      indicators: [],
      entryCondition: "",
      exitCondition: "",
    },
  };
}

/**
 * Run individual stock backtest
 * 运行个股回测
 */
async function runIndividualBacktest(
  target: BacktestTarget,
  request: UnifiedBacktestRequest,
): Promise<UnifiedBacktestResult> {
  const jobId = uuidv4();
  const startTime = Date.now();

  if (!target.stock) {
    throw new Error("Stock target is required for stock mode");
  }

  const { symbol, name: symbolName } = target.stock;
  const result = await runStockBacktest(symbol, symbolName, request.config, request.strategy);

  // Diagnostics
  const diagnostics =
    request.options?.includeDiagnostics !== false
      ? runDiagnostics({
          returnMetrics: result.returnMetrics,
          riskMetrics: result.riskMetrics,
          tradingMetrics: result.tradingMetrics,
        })
      : undefined;

  return {
    jobId,
    timestamp: Date.now(),
    executionTime: Date.now() - startTime,
    target,
    returnMetrics: result.returnMetrics,
    riskMetrics: result.riskMetrics,
    tradingMetrics: result.tradingMetrics,
    equityCurve: result.equityCurve,
    trades: result.trades,
    diagnostics,
    config: {
      symbol,
      initialCapital: request.config.initialCapital,
      commission: request.config.commission ?? 0.0003,
      slippage: request.config.slippage ?? 0.001,
      startDate: request.config.startDate,
      endDate: request.config.endDate,
      timeframe: request.config.timeframe ?? "1d",
    },
    strategy: {
      name: request.strategy?.builtinId ?? "default",
      params: request.strategy?.params ?? {},
      indicators: [],
      entryCondition: "",
      exitCondition: "",
    },
  };
}

/**
 * Run portfolio backtest
 * 运行组合回测
 */
async function runPortfolioBacktest(
  target: BacktestTarget,
  request: UnifiedBacktestRequest,
): Promise<UnifiedBacktestResult> {
  const jobId = uuidv4();
  const startTime = Date.now();

  if (!target.portfolio) {
    throw new Error("Portfolio target is required for portfolio mode");
  }

  const { stocks } = target.portfolio;
  const stockResults: StockBacktestResult[] = [];
  let totalEquityCurve: Array<{
    date: string;
    equity: number;
    benchmark?: number;
    drawdown: number;
  }> = [];
  let allTrades: DetailedTrade[] = [];

  // Run backtest for each stock in portfolio
  for (const stock of stocks) {
    // Check timeout
    if (Date.now() - startTime > REQUEST_TIMEOUT - 5000) {
      console.warn("Portfolio backtest approaching timeout, stopping early");
      break;
    }

    try {
      const result = await runStockBacktest(
        stock.symbol,
        stock.name,
        request.config,
        request.strategy,
      );

      stockResults.push({
        symbol: stock.symbol,
        name: stock.name,
        totalReturn: result.returnMetrics.totalReturn,
        winRate: result.tradingMetrics.winRate,
        tradeCount: result.tradingMetrics.totalTrades,
        contribution: 100 / stocks.length,
        sharpeRatio: result.riskMetrics.sharpeRatio,
        maxDrawdown: result.riskMetrics.maxDrawdown,
      });

      if (totalEquityCurve.length === 0) {
        totalEquityCurve = result.equityCurve;
      }

      allTrades = allTrades.concat(result.trades);
    } catch (error) {
      console.warn(`Failed to backtest ${stock.symbol}:`, error);
    }
  }

  if (stockResults.length === 0) {
    throw new Error("所有股票回测失败");
  }

  stockResults.sort((a, b) => b.totalReturn - a.totalReturn);

  const returnMetrics = buildReturnMetrics(totalEquityCurve);
  const riskMetrics = buildRiskMetrics(totalEquityCurve);
  const tradingMetrics = buildTradingMetrics(
    allTrades.filter((t) => t.type === "sell"),
    totalEquityCurve.length,
  );

  const diagnostics =
    request.options?.includeDiagnostics !== false
      ? runDiagnostics({ returnMetrics, riskMetrics, tradingMetrics })
      : undefined;

  return {
    jobId,
    timestamp: Date.now(),
    executionTime: Date.now() - startTime,
    target,
    returnMetrics,
    riskMetrics,
    tradingMetrics,
    equityCurve: totalEquityCurve,
    stockResults,
    trades: allTrades,
    diagnostics,
    config: {
      symbol: target.portfolio.name,
      initialCapital: request.config.initialCapital,
      commission: request.config.commission ?? 0.0003,
      slippage: request.config.slippage ?? 0.001,
      startDate: request.config.startDate,
      endDate: request.config.endDate,
      timeframe: request.config.timeframe ?? "1d",
    },
    strategy: {
      name: request.strategy?.builtinId ?? "default",
      params: request.strategy?.params ?? {},
      indicators: [],
      entryCondition: "",
      exitCondition: "",
    },
  };
}

// =============================================================================
// API HANDLERS / API处理函数
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        "请求体JSON格式无效",
        "Invalid JSON in request body",
        400,
        undefined,
        "请检查请求格式",
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return validation.error;
    }

    const validatedRequest = validation.data;

    // Quota check: verify user has remaining backtest quota
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email ?? session?.user?.name ?? "anonymous";
    const plan = (session?.user as { role?: string } | undefined)?.role ?? "free";

    const usageStatus = await checkUsage(userId, "backtest", plan);
    if (!usageStatus.allowed) {
      return createErrorResponse(
        ErrorCodes.QUOTA_EXCEEDED,
        `今日回测额度已用完 (${usageStatus.used}/${usageStatus.limit})，请明日再试或升级计划`,
        `Daily backtest quota exceeded (${usageStatus.used}/${usageStatus.limit})`,
        429,
        { used: usageStatus.used, limit: usageStatus.limit, resetAt: usageStatus.resetAt },
        "升级到 Standard 或 Premium 计划以获得更多回测次数",
      );
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("TIMEOUT"));
      }, REQUEST_TIMEOUT);
    });

    // Run appropriate backtest based on mode
    let result: UnifiedBacktestResult;

    try {
      const backtestPromise = (async () => {
        switch (validatedRequest.target.mode) {
          case "sector":
            return await runSectorBacktest(
              validatedRequest.target,
              validatedRequest,
            );
          case "stock":
            return await runIndividualBacktest(
              validatedRequest.target,
              validatedRequest,
            );
          case "portfolio":
            return await runPortfolioBacktest(
              validatedRequest.target,
              validatedRequest,
            );
          default:
            throw new Error(
              `Invalid target mode: ${validatedRequest.target.mode}`,
            );
        }
      })();

      result = await Promise.race([backtestPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === "TIMEOUT") {
        return createErrorResponse(
          ErrorCodes.ENGINE_TIMEOUT,
          "回测执行超时，请缩小回测范围后重试",
          "Backtest execution timeout",
          504,
          { timeout: REQUEST_TIMEOUT, elapsed: Date.now() - startTime },
          "请减少回测时间范围或减少股票数量",
        );
      }
      throw error;
    }

    // Increment usage counter (fire-and-forget)
    void incrementUsage(userId, "backtest");

    // Save successful strategy to public pool and record event (async, non-blocking)
    const strategyCode: string =
      typeof validatedRequest.strategy?.customCode === "string"
        ? validatedRequest.strategy.customCode
        : "";
    const strategyType: string =
      typeof validatedRequest.strategy?.builtinId === "string"
        ? validatedRequest.strategy.builtinId
        : "unknown";

    if (strategyCode) {
      const normalised = strategyCode.trim().toLowerCase().replace(/\s+/g, " ");
      const cacheKey = createHash("md5").update(normalised).digest("hex");

      void upsertPopularStrategy({
        cacheKey,
        code: strategyCode,
        strategyType,
        totalReturn: result.returnMetrics.totalReturn,
        sharpeRatio: result.riskMetrics.sharpeRatio,
      }).catch((err: unknown) => {
        console.error("[unified-backtest] Failed to save to public pool:", err);
      });
    }

    recordUserEvent({
      eventType: "backtest_run",
      metadata: {
        mode: validatedRequest.target.mode,
        symbol:
          validatedRequest.target.mode === "stock"
            ? validatedRequest.target.stock?.symbol
            : validatedRequest.target.mode === "sector"
              ? validatedRequest.target.sector?.code
              : undefined,
        strategyType,
        executionTime: result.executionTime,
        totalReturn: result.returnMetrics.totalReturn,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
      metadata: { dataSource: "postgresql" },
    });
  } catch (error) {
    console.error("Unified backtest error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as { code?: string }).code;

    // Insufficient data coverage (BT201)
    if (
      errorCode === ErrorCodes.INSUFFICIENT_DATA ||
      errorMessage.includes("数据不足")
    ) {
      return createErrorResponse(
        ErrorCodes.INSUFFICIENT_DATA,
        errorMessage,
        "Insufficient data coverage for backtest",
        422,
        undefined,
        "请选择数据更充足的股票或缩短回测时间范围",
      );
    }

    // Database connection failure (BT202)
    if (errorCode === "BT202" || errorMessage.includes("数据库连接失败")) {
      return createErrorResponse(
        "BT202",
        errorMessage,
        "Database connection failed",
        502,
        undefined,
        "请稍后重试，若持续出现请联系管理员",
      );
    }

    // Sector data fetch failure
    if (
      errorMessage.includes("获取板块成分股失败") ||
      errorMessage.includes("fetch")
    ) {
      return createErrorResponse(
        ErrorCodes.DATA_FETCH_FAILED,
        errorMessage,
        "Failed to fetch data",
        502,
        undefined,
        "请检查网络连接后重试",
      );
    }

    if (errorMessage.includes("所有股票回测失败")) {
      return createErrorResponse(
        ErrorCodes.ENGINE_ERROR,
        errorMessage,
        "All backtests failed",
        500,
        undefined,
        "请稍后重试或选择其他标的",
      );
    }

    return createErrorResponse(
      ErrorCodes.UNKNOWN_ERROR,
      "回测执行失败: " + errorMessage,
      "Backtest execution failed: " + errorMessage,
      500,
      { originalError: errorMessage },
      "请稍后重试",
    );
  }
}

export async function GET(request: NextRequest) {
  // Get job status
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return createErrorResponse(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      "缺少jobId参数",
      "Job ID is required",
      400,
      undefined,
      "请提供有效的jobId",
    );
  }

  const job = jobStore.get(jobId);
  if (!job) {
    return createErrorResponse(
      ErrorCodes.SYMBOL_NOT_FOUND,
      "任务不存在",
      "Job not found",
      404,
      { jobId },
      "请检查jobId是否正确",
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    },
  });
}
