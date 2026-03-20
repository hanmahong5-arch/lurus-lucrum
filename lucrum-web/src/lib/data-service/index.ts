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
