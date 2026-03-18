/**
 * Data Service Module Index
 *
 * Centralized exports for data service functionality
 * Including circuit breaker, retry, validation, and data sources
 *
 * @module lib/data-service
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  StockQuote,
  KLineData,
  IndexQuote,
  CapitalFlow,
  NorthBoundFlow,
  ApiResponse,
  KLineTimeFrame,
  LogEntry,
  LogLevel,
  RequestMetrics,
  ServiceHealth,
  ServiceStats,
} from "./types";

// =============================================================================
// IMPORTS FOR INTERNAL USE
// =============================================================================

import {
  getStockQuote as eastmoneyQuote,
  getKLineData as eastmoneyKLine,
  getMajorIndices as eastmoneyIndices,
  getCapitalFlow as eastmoneyCapitalFlow,
  getNorthBoundFlow as eastmoneyNorthFlow,
} from "./sources/eastmoney";
import {
  getStockQuote as sinaQuote,
  getKLineData as sinaKLine,
  getMajorIndices as sinaIndices,
} from "./sources/sina";
import type {
  StockQuote,
  KLineData,
  IndexQuote,
  ApiResponse,
  KLineTimeFrame,
} from "./types";
import { logger as dataServiceLogger } from "./logger";

// =============================================================================
// RE-EXPORT DATA SOURCES (aliased to avoid conflicts)
// =============================================================================

export {
  getStockQuote as getStockQuoteFromEastmoney,
  getKLineData as getKLineDataFromEastmoney,
  getMajorIndices as getMajorIndicesFromEastmoney,
} from "./sources/eastmoney";

export {
  getStockQuote as getStockQuoteFromSina,
  getKLineData as getKLineDataFromSina,
  getMajorIndices as getMajorIndicesFromSina,
} from "./sources/sina";

// =============================================================================
// UNIFIED DATA SERVICE FUNCTIONS
// =============================================================================

/**
 * Get stock quote with automatic fallback
 * 获取股票行情（带自动降级）
 */
export async function getStockQuote(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  // Try EastMoney first
  const result = await eastmoneyQuote(symbol);
  if (result.success) return result;

  // Fallback to Sina
  dataServiceLogger.warn("eastmoney", `Falling back to sina for ${symbol}`);
  return sinaQuote(symbol);
}

/**
 * Get batch quotes
 * 批量获取行情
 */
export async function getBatchQuotes(
  symbols: string[],
): Promise<Record<string, StockQuote | null>> {
  const results: Record<string, StockQuote | null> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      const response = await getStockQuote(symbol);
      results[symbol] = response.success ? response.data : null;
    }),
  );

  return results;
}

/**
 * Get K-line data with automatic fallback
 * 获取K线数据（带自动降级）
 */
export async function getKLineData(
  symbol: string,
  timeframe: KLineTimeFrame = "1d",
  limit: number = 200,
): Promise<ApiResponse<KLineData[]>> {
  const result = await eastmoneyKLine(symbol, timeframe, limit);
  if (result.success) return result;

  dataServiceLogger.warn(
    "eastmoney",
    `Falling back to sina for kline ${symbol}`,
  );
  return sinaKLine(symbol, timeframe, limit);
}

/**
 * Get major indices with automatic fallback
 * 获取主要指数（带自动降级）
 */
export async function getMajorIndices(): Promise<ApiResponse<IndexQuote[]>> {
  const result = await eastmoneyIndices();
  if (result.success) return result;

  dataServiceLogger.warn("eastmoney", "Falling back to sina for indices");
  return sinaIndices();
}

/**
 * Get capital flow for a stock
 * 获取股票资金流向
 */
export async function getCapitalFlow(symbol: string) {
  return eastmoneyCapitalFlow(symbol);
}

/**
 * Get north-bound capital flow
 * 获取北向资金流向
 */
export async function getNorthBoundFlow() {
  return eastmoneyNorthFlow();
}

// =============================================================================
// LOGGER UTILITIES
// =============================================================================

export { logger } from "./logger";

/**
 * Get service statistics
 */
export function getServiceStats() {
  return dataServiceLogger.getStats();
}

/**
 * Get service health for a source or all sources
 * @param source - Optional source name. If not provided, returns all health statuses.
 */
export function getServiceHealth(source?: string) {
  if (source) {
    return dataServiceLogger.getHealth(source);
  }
  return dataServiceLogger.getAllHealth();
}

/**
 * Get recent logs
 */
export function getRecentLogs(options?: {
  level?: "debug" | "info" | "warn" | "error";
  source?: string;
  limit?: number;
  since?: number;
}) {
  return dataServiceLogger.getLogs(options);
}

/**
 * Get recent metrics
 */
export function getRecentMetrics(options?: {
  source?: string;
  limit?: number;
  since?: number;
}) {
  return dataServiceLogger.getMetrics(options);
}

// =============================================================================
// MOCK DATA GENERATORS
// =============================================================================

/**
 * Generate mock quote for testing
 * 生成测试用模拟行情
 */
export function generateMockQuote(symbol: string, name: string): StockQuote {
  const basePrice = 50 + Math.random() * 200;
  const change = (Math.random() - 0.5) * 10;
  const changePercent = (change / basePrice) * 100;

  return {
    symbol,
    name,
    price: parseFloat(basePrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    open: parseFloat((basePrice - change * Math.random()).toFixed(2)),
    high: parseFloat((basePrice + Math.abs(change) * Math.random()).toFixed(2)),
    low: parseFloat((basePrice - Math.abs(change) * Math.random()).toFixed(2)),
    prevClose: parseFloat((basePrice - change).toFixed(2)),
    volume: Math.floor(Math.random() * 100000000),
    amount: Math.floor(Math.random() * 1000000000),
    turnoverRate: parseFloat((Math.random() * 5).toFixed(2)),
    pe: parseFloat((10 + Math.random() * 50).toFixed(2)),
    pb: parseFloat((1 + Math.random() * 5).toFixed(2)),
    marketCap: Math.floor(Math.random() * 100000000000),
    timestamp: Date.now(),
  };
}

/**
 * Generate mock K-line data for testing
 * 生成测试用模拟K线数据
 */
export function generateMockKLineData(
  symbol: string,
  count: number = 200,
): KLineData[] {
  const data: KLineData[] = [];
  let basePrice = 50 + Math.random() * 100;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const change = (Math.random() - 0.5) * basePrice * 0.05;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * Math.abs(change);
    const low = Math.min(open, close) - Math.random() * Math.abs(change);

    data.push({
      time: Math.floor((now - i * dayMs) / 1000),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000),
      amount: Math.floor(Math.random() * 100000000),
    });

    basePrice = close;
  }

  return data;
}

/**
 * Generate mock indices for testing
 * 生成测试用模拟指数（扩展版本，包含更多指数）
 */
export function generateMockIndices(): IndexQuote[] {
  const baseData = [
    {
      symbol: "000001.SH",
      name: "上证指数",
      basePrice: 3150,
      volatility: 0.015,
    },
    {
      symbol: "399001.SZ",
      name: "深证成指",
      basePrice: 10200,
      volatility: 0.018,
    },
    {
      symbol: "399006.SZ",
      name: "创业板指",
      basePrice: 2050,
      volatility: 0.025,
    },
    {
      symbol: "000300.SH",
      name: "沪深300",
      basePrice: 3700,
      volatility: 0.016,
    },
    { symbol: "000016.SH", name: "上证50", basePrice: 2450, volatility: 0.014 },
    { symbol: "000905.SH", name: "中证500", basePrice: 5200, volatility: 0.02 },
    {
      symbol: "399673.SZ",
      name: "创业板50",
      basePrice: 2100,
      volatility: 0.028,
    },
    { symbol: "000688.SH", name: "科创50", basePrice: 980, volatility: 0.03 },
    {
      symbol: "399005.SZ",
      name: "中小板指",
      basePrice: 6800,
      volatility: 0.022,
    },
    {
      symbol: "000852.SH",
      name: "中证1000",
      basePrice: 6100,
      volatility: 0.024,
    },
  ];

  return baseData.map((item) => {
    const change = (Math.random() - 0.5) * item.basePrice * item.volatility * 2;
    const price = item.basePrice + change;
    const changePercent = (change / item.basePrice) * 100;

    return {
      symbol: item.symbol,
      name: item.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 500000000000 + 100000000000),
      amount: Math.floor(Math.random() * 600000000000 + 150000000000),
      timestamp: Date.now(),
    };
  });
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

export {
  CircuitBreaker,
  CircuitOpenError,
  circuitBreakerRegistry,
  createDataServiceBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
  type CircuitBreakerStats,
} from "./circuit-breaker";

// =============================================================================
// RETRY MECHANISM
// =============================================================================

export {
  retry,
  retryWithResult,
  withRetry,
  calculateDelay,
  defaultShouldRetry,
  RetryExhaustedError,
  RetryTimeoutError,
  API_RETRY_CONFIG,
  REALTIME_RETRY_CONFIG,
  BATCH_RETRY_CONFIG,
  CRITICAL_RETRY_CONFIG,
  type RetryConfig,
  type RetryResult,
} from "./retry";

// =============================================================================
// VALIDATION
// =============================================================================

export {
  validate,
  validateArray,
  validateStockQuote,
  validateStockQuotes,
  validateKline,
  validateKlines,
  validateMarketIndex,
  validateFundFlow,
  validateWithTracking,
  validateArrayWithTracking,
  normalizeStockSymbol,
  cleanNumericValue,
  cleanPercentage,
  setValidationLogger,
  dataQualityTracker,
  type ValidationResult,
  type ValidationError,
  type ValidationOptions,
  type DataQualityMetrics,
} from "./validators";
