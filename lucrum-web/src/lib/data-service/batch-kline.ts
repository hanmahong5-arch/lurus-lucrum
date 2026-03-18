/**
 * Batch K-Line Data Fetcher
 * 批量K线数据获取器
 *
 * Optimized for fetching K-line data for multiple stocks with:
 * 针对多只股票K线数据获取的优化：
 * - Concurrency control / 并发控制
 * - Exponential backoff retry / 指数退避重试
 * - Progress callback / 进度回调
 * - Cache reuse / 缓存复用
 */

import type { KLineData, KLineTimeFrame, ApiResponse } from "./types";
import { getKLineData as getKLineDataEastmoney } from "./sources/eastmoney";
import { getKLineData as getKLineDataSina } from "./sources/sina";
import { logger } from "./logger";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const SOURCE_NAME = "batch-kline";

/**
 * Default concurrency limit
 * 默认并发限制
 */
const DEFAULT_CONCURRENCY = 10;

/**
 * Default retry configuration
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 500, // Base delay in ms / 基础延迟
  maxDelay: 5000, // Max delay in ms / 最大延迟
};

/**
 * Delay between chunks to avoid rate limiting
 * 批次之间的延迟以避免限流
 */
const CHUNK_DELAY = 200;

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Price adjustment type for K-line data
 * K线数据复权类型
 */
export type AdjustmentType = "none" | "forward" | "backward";

/**
 * Batch fetch options
 * 批量获取选项
 */
export interface BatchFetchOptions {
  concurrency?: number; // Max concurrent requests / 最大并发请求数
  retryConfig?: RetryConfig; // Retry configuration / 重试配置
  onProgress?: ProgressCallback; // Progress callback / 进度回调
  onError?: ErrorCallback; // Error callback / 错误回调
  skipEmpty?: boolean; // Skip symbols with no data / 跳过无数据的股票
  adjustment?: AdjustmentType; // Price adjustment type / 复权类型
  timeout?: number; // Request timeout in ms / 请求超时时间
}

/**
 * Retry configuration
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number; // Max retry attempts / 最大重试次数
  baseDelay: number; // Base delay in ms / 基础延迟
  maxDelay: number; // Max delay in ms / 最大延迟
}

/**
 * Progress callback type
 * 进度回调类型
 */
export type ProgressCallback = (
  completed: number,
  total: number,
  currentSymbol: string,
) => void;

/**
 * Error callback type
 * 错误回调类型
 */
export type ErrorCallback = (
  symbol: string,
  error: Error,
  retryCount: number,
) => void;

/**
 * Batch fetch result
 * 批量获取结果
 */
export interface BatchFetchResult {
  data: Map<string, KLineData[]>; // Symbol -> K-lines map
  errors: Map<string, string>; // Symbol -> Error message map
  statistics: BatchFetchStatistics; // Fetch statistics
}

/**
 * Batch fetch statistics
 * 批量获取统计
 */
export interface BatchFetchStatistics {
  totalSymbols: number; // Total symbols requested
  successCount: number; // Successfully fetched
  failedCount: number; // Failed to fetch
  totalKlines: number; // Total K-lines fetched
  totalTime: number; // Total time in ms
  averageLatency: number; // Average latency per symbol
}

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Split array into chunks
 * 将数组分割成块
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Calculate exponential backoff delay
 * 计算指数退避延迟
 */
function calculateBackoffDelay(
  retryCount: number,
  config: RetryConfig,
): number {
  const delay = config.baseDelay * Math.pow(2, retryCount);
  // Add jitter to avoid thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 * 休眠指定毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Filter K-lines by date range
 * 按日期范围过滤K线
 *
 * @param klines - K-line data array
 * @param startDate - Start date string (YYYY-MM-DD)
 * @param endDate - End date string (YYYY-MM-DD)
 * @returns Filtered K-line data
 */
export function filterByDateRange(
  klines: KLineData[],
  startDate: string,
  endDate: string,
): KLineData[] {
  const startTimestamp = new Date(startDate).getTime() / 1000;
  const endTimestamp = new Date(endDate).getTime() / 1000 + 86400; // Include end date

  return klines.filter(
    (k) => k.time >= startTimestamp && k.time <= endTimestamp,
  );
}

/**
 * Adjust K-line prices for dividends/splits
 * 对K线数据进行复权处理
 *
 * Forward adjustment: Adjust historical prices up to current price level
 * 前复权：调整历史价格至当前价格水平
 *
 * Backward adjustment: Adjust recent prices down to historical price level
 * 后复权：调整近期价格至历史价格水平
 *
 * @param klines - Original K-line data (sorted by time ascending)
 * @param type - Adjustment type
 * @returns Adjusted K-line data
 *
 * @note This is a simplified implementation that detects price gaps
 *       For production use, real adjustment factors from data source are recommended
 *       这是简化实现，通过检测价格跳空来判断除权
 *       生产环境建议使用数据源提供的真实复权因子
 */
export function adjustPrices(
  klines: KLineData[],
  type: AdjustmentType,
): KLineData[] {
  if (type === "none" || klines.length < 2) {
    return klines;
  }

  // Detect adjustment factors by looking for overnight gaps > 8%
  // that are likely due to dividends/splits rather than market moves
  // 通过检测隔夜跳空>8%来判断除权（可能是分红或拆股导致）
  const adjustmentFactors: { index: number; factor: number }[] = [];

  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];

    if (!prev || !curr) continue;

    // Gap between previous close and current open
    const gap = (curr.open - prev.close) / prev.close;

    // If gap is more than 8% down, likely a dividend/split adjustment
    // 如果跳空超过8%向下，很可能是除权
    if (gap < -0.08) {
      const factor = curr.open / prev.close;
      adjustmentFactors.push({ index: i, factor });
      logger.debug(SOURCE_NAME, `Detected adjustment at index ${i}`, {
        prevClose: prev.close,
        currOpen: curr.open,
        factor,
      });
    }
  }

  if (adjustmentFactors.length === 0) {
    return klines; // No adjustments needed
  }

  // Apply adjustments
  const adjusted = klines.map((k, idx) => ({ ...k }));

  if (type === "forward") {
    // Forward adjustment: multiply historical prices by cumulative factor
    // 前复权：将历史价格乘以累计因子
    let cumulativeFactor = 1;

    // Calculate cumulative factor from end to start
    for (let i = adjustmentFactors.length - 1; i >= 0; i--) {
      const adj = adjustmentFactors[i];
      if (adj) {
        cumulativeFactor *= adj.factor;
      }
    }

    // Apply factor to each K-line before the adjustment point
    let currentFactor = cumulativeFactor;
    let adjustmentIdx = 0;

    for (let i = 0; i < adjusted.length; i++) {
      const k = adjusted[i];
      if (!k) continue;

      // Check if we passed an adjustment point
      const adj = adjustmentFactors[adjustmentIdx];
      if (adj && i >= adj.index) {
        currentFactor /= adj.factor;
        adjustmentIdx++;
      }

      // Apply factor if not at current price level
      if (currentFactor !== 1) {
        k.open = Number((k.open * currentFactor).toFixed(2));
        k.high = Number((k.high * currentFactor).toFixed(2));
        k.low = Number((k.low * currentFactor).toFixed(2));
        k.close = Number((k.close * currentFactor).toFixed(2));
      }
    }
  } else if (type === "backward") {
    // Backward adjustment: divide recent prices by cumulative factor
    // 后复权：将近期价格除以累计因子
    let cumulativeFactor = 1;
    let adjustmentIdx = adjustmentFactors.length - 1;

    for (let i = adjusted.length - 1; i >= 0; i--) {
      const k = adjusted[i];
      if (!k) continue;

      // Apply factor if not at historical price level
      if (cumulativeFactor !== 1) {
        k.open = Number((k.open / cumulativeFactor).toFixed(2));
        k.high = Number((k.high / cumulativeFactor).toFixed(2));
        k.low = Number((k.low / cumulativeFactor).toFixed(2));
        k.close = Number((k.close / cumulativeFactor).toFixed(2));
      }

      // Check if we passed an adjustment point (going backward)
      const adj = adjustmentFactors[adjustmentIdx];
      if (adj && i <= adj.index) {
        cumulativeFactor *= adj.factor;
        adjustmentIdx--;
      }
    }
  }

  return adjusted;
}

/**
 * Wrap a promise with timeout
 * 为Promise添加超时包装
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Error message on timeout
 * @returns Promise that rejects on timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = "Request timeout",
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Default request timeout in milliseconds
 * 默认请求超时时间
 */
const DEFAULT_TIMEOUT = 30000;

// =============================================================================
// DATA SOURCE CHAIN / 数据源链
// =============================================================================

/**
 * Data source definition for chain-of-responsibility failover
 * 数据源定义，用于责任链式故障转移
 */
interface DataSourceProvider {
  name: string;
  fetch: (symbol: string, timeframe: KLineTimeFrame, limit: number) => Promise<ApiResponse<KLineData[]>>;
}

/**
 * Ordered data source chain: EastMoney (primary) → Sina (fallback)
 * 有序数据源链：东方财富（主）→ 新浪（备）
 *
 * Each source is tried in order. If the primary fails, the next source is attempted.
 * This ensures robust data fetching without degradation to mock/fake data.
 */
const DATA_SOURCES: DataSourceProvider[] = [
  { name: "eastmoney", fetch: getKLineDataEastmoney },
  { name: "sina", fetch: getKLineDataSina },
];

/**
 * Try fetching K-line data from a single source with retry and timeout
 * 从单个数据源获取K线数据，带重试和超时
 */
async function fetchFromSourceWithRetry(
  source: DataSourceProvider,
  symbol: string,
  timeframe: KLineTimeFrame,
  limit: number,
  retryConfig: RetryConfig,
  timeout: number,
  onError?: ErrorCallback,
): Promise<ApiResponse<KLineData[]> | null> {
  let lastError: Error | null = null;

  for (let retry = 0; retry <= retryConfig.maxRetries; retry++) {
    try {
      const response = await withTimeout(
        source.fetch(symbol, timeframe, limit),
        timeout,
        `Request timeout for ${symbol} from ${source.name} after ${timeout}ms`,
      );

      if (response.success && response.data) {
        return response;
      }

      lastError = new Error(response.error ?? "Unknown error");

      if (retry < retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(retry, retryConfig);
        logger.debug(SOURCE_NAME, `Retrying ${symbol} from ${source.name} after ${delay}ms`, {
          retry: retry + 1,
          maxRetries: retryConfig.maxRetries,
          reason: lastError.message,
        });
        await sleep(delay);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout = lastError.message.includes("timeout");

      if (onError) {
        onError(symbol, lastError, retry);
      }

      if (retry < retryConfig.maxRetries) {
        const delay = isTimeout
          ? calculateBackoffDelay(retry + 1, retryConfig)
          : calculateBackoffDelay(retry, retryConfig);
        logger.debug(SOURCE_NAME, `Retrying ${symbol} from ${source.name} after ${delay}ms`, {
          retry: retry + 1,
          maxRetries: retryConfig.maxRetries,
          reason: lastError.message,
          isTimeout,
        });
        await sleep(delay);
      }
    }
  }

  logger.warn(SOURCE_NAME, `All retries exhausted for ${symbol} from ${source.name}`, {
    error: lastError?.message,
  });
  return null;
}

/**
 * Fetch K-line data with multi-source failover
 * 多数据源故障转移获取K线数据
 *
 * Tries each data source in order (EastMoney → Sina).
 * Only returns failure if ALL sources fail for the symbol.
 */
async function fetchWithRetry(
  symbol: string,
  timeframe: KLineTimeFrame,
  limit: number,
  retryConfig: RetryConfig,
  timeout: number = DEFAULT_TIMEOUT,
  onError?: ErrorCallback,
): Promise<ApiResponse<KLineData[]>> {
  const sourceErrors: string[] = [];

  for (const source of DATA_SOURCES) {
    const result = await fetchFromSourceWithRetry(
      source,
      symbol,
      timeframe,
      limit,
      retryConfig,
      timeout,
      onError,
    );

    if (result) {
      if (source !== DATA_SOURCES[0]) {
        logger.info(SOURCE_NAME, `Fetched ${symbol} from fallback source: ${source.name}`);
      }
      return result;
    }

    sourceErrors.push(source.name);
  }

  // All sources failed - return explicit failure (no mock degradation)
  const errorMsg = `All data sources failed for ${symbol} (tried: ${sourceErrors.join(" → ")})`;
  logger.error(SOURCE_NAME, errorMsg);

  return {
    success: false,
    data: null,
    error: errorMsg,
    source: SOURCE_NAME,
    cached: false,
    timestamp: Date.now(),
    latency: 0,
  };
}

// =============================================================================
// MAIN FUNCTIONS / 主要函数
// =============================================================================

/**
 * Batch fetch K-line data for multiple stocks
 * 批量获取多只股票的K线数据
 *
 * Optimized with:
 * - Concurrency control (default 10 concurrent requests)
 * - Exponential backoff retry on failures
 * - Progress callback for UI updates
 * - Error callback for logging/handling
 *
 * @param symbols - Array of stock symbols
 * @param timeframe - K-line timeframe
 * @param limit - Number of K-lines per symbol
 * @param options - Fetch options
 * @returns Promise with batch fetch result
 *
 * @example
 * ```typescript
 * const result = await batchGetKlines(
 *   ["600519", "000001", "601398"],
 *   "1d",
 *   120,
 *   {
 *     concurrency: 10,
 *     onProgress: (completed, total, symbol) => {
 *       console.log(`Progress: ${completed}/${total} - ${symbol}`);
 *     },
 *   }
 * );
 * ```
 */
export async function batchGetKlines(
  symbols: string[],
  timeframe: KLineTimeFrame,
  limit: number = 200,
  options: BatchFetchOptions = {},
): Promise<BatchFetchResult> {
  const startTime = Date.now();

  const {
    concurrency = DEFAULT_CONCURRENCY,
    retryConfig = DEFAULT_RETRY_CONFIG,
    onProgress,
    onError,
    skipEmpty = true,
    adjustment = "none",
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const results = new Map<string, KLineData[]>();
  const errors = new Map<string, string>();

  // Remove duplicates
  const uniqueSymbols = Array.from(new Set(symbols));
  const total = uniqueSymbols.length;
  let completed = 0;

  logger.info(SOURCE_NAME, `Starting batch K-line fetch`, {
    totalSymbols: total,
    timeframe,
    limit,
    concurrency,
    adjustment,
    timeout,
  });

  // Split into chunks for concurrency control
  const chunks = chunkArray(uniqueSymbols, concurrency);

  for (const chunk of chunks) {
    // Process chunk concurrently
    const promises = chunk.map(async (symbol) => {
      try {
        const response = await fetchWithRetry(
          symbol,
          timeframe,
          limit,
          retryConfig,
          timeout,
          onError,
        );

        if (response.success && response.data) {
          if (!skipEmpty || response.data.length > 0) {
            // Apply price adjustment if requested
            // 如果需要，应用复权处理
            const klines =
              adjustment !== "none"
                ? adjustPrices(response.data, adjustment)
                : response.data;
            results.set(symbol, klines);
          }
        } else {
          errors.set(symbol, response.error ?? "Unknown error");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.set(symbol, errorMsg);
        logger.warn(SOURCE_NAME, `Failed to fetch ${symbol}`, {
          error: errorMsg,
        });
      } finally {
        completed++;
        if (onProgress) {
          onProgress(completed, total, symbol);
        }
      }
    });

    await Promise.all(promises);

    // Delay between chunks to avoid rate limiting
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await sleep(CHUNK_DELAY);
    }
  }

  const totalTime = Date.now() - startTime;
  const successCount = results.size;
  const failedCount = errors.size;
  let totalKlines = 0;
  results.forEach((klines) => {
    totalKlines += klines.length;
  });

  const statistics: BatchFetchStatistics = {
    totalSymbols: total,
    successCount,
    failedCount,
    totalKlines,
    totalTime,
    averageLatency: successCount > 0 ? totalTime / successCount : 0,
  };

  logger.info(SOURCE_NAME, `Batch K-line fetch completed`, {
    ...statistics,
  });

  return {
    data: results,
    errors,
    statistics,
  };
}

/**
 * Batch fetch K-lines with date range filtering
 * 带日期范围过滤的批量K线获取
 *
 * @param symbols - Array of stock symbols
 * @param timeframe - K-line timeframe
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param options - Fetch options
 * @returns Promise with batch fetch result (filtered by date)
 */
export async function batchGetKlinesWithDateRange(
  symbols: string[],
  timeframe: KLineTimeFrame,
  startDate: string,
  endDate: string,
  options: BatchFetchOptions = {},
): Promise<BatchFetchResult> {
  // Calculate how many K-lines we need based on date range
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();
  const daysDiff = Math.ceil(
    (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24),
  );

  // Add buffer for weekends/holidays and indicator calculation
  let limit: number;
  switch (timeframe) {
    case "1m":
      limit = daysDiff * 240 + 100; // ~240 minutes per trading day
      break;
    case "5m":
      limit = daysDiff * 48 + 50;
      break;
    case "15m":
      limit = daysDiff * 16 + 30;
      break;
    case "30m":
      limit = daysDiff * 8 + 20;
      break;
    case "60m":
      limit = daysDiff * 4 + 20;
      break;
    case "1d":
      limit = daysDiff + 60; // Extra for indicator warmup
      break;
    case "1w":
      limit = Math.ceil(daysDiff / 7) + 20;
      break;
    case "1M":
      limit = Math.ceil(daysDiff / 30) + 12;
      break;
    default:
      limit = daysDiff + 60;
  }

  // Fetch K-lines
  const result = await batchGetKlines(symbols, timeframe, limit, options);

  // Filter by date range
  const filteredData = new Map<string, KLineData[]>();
  result.data.forEach((klines, symbol) => {
    const filtered = filterByDateRange(klines, startDate, endDate);
    if (filtered.length > 0) {
      filteredData.set(symbol, filtered);
    }
  });

  // Update statistics
  let totalKlines = 0;
  filteredData.forEach((klines) => {
    totalKlines += klines.length;
  });

  return {
    data: filteredData,
    errors: result.errors,
    statistics: {
      ...result.statistics,
      successCount: filteredData.size,
      totalKlines,
    },
  };
}

/**
 * Get K-lines for sector stocks
 * 获取板块成分股的K线数据
 *
 * Convenience function that combines sector stock fetching with batch K-line fetching
 *
 * @param sectorCode - Sector code (e.g., "BK0420")
 * @param timeframe - K-line timeframe
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param options - Additional options
 * @returns Promise with batch fetch result
 */
export async function getSectorKlines(
  sectorCode: string,
  timeframe: KLineTimeFrame,
  startDate: string,
  endDate: string,
  options: BatchFetchOptions & { maxStocks?: number } = {},
): Promise<BatchFetchResult> {
  // Import dynamically to avoid circular dependency
  const { getSectorStocks } = await import("./sources/eastmoney-sector");

  const maxStocks = options.maxStocks ?? 100;

  // Fetch sector stocks
  const sectorResponse = await getSectorStocks(sectorCode, maxStocks);

  if (!sectorResponse.success || !sectorResponse.data) {
    return {
      data: new Map(),
      errors: new Map([
        [sectorCode, sectorResponse.error ?? "Failed to fetch sector stocks"],
      ]),
      statistics: {
        totalSymbols: 0,
        successCount: 0,
        failedCount: 1,
        totalKlines: 0,
        totalTime: 0,
        averageLatency: 0,
      },
    };
  }

  const symbols = sectorResponse.data.stocks.map((s) => s.symbol);

  logger.info(SOURCE_NAME, `Fetching K-lines for sector ${sectorCode}`, {
    stockCount: symbols.length,
    timeframe,
    dateRange: `${startDate} to ${endDate}`,
  });

  return batchGetKlinesWithDateRange(
    symbols,
    timeframe,
    startDate,
    endDate,
    options,
  );
}
