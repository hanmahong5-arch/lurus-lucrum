/**
 * EastMoney (东方财富) Data Source Implementation
 * 东方财富数据源实现
 *
 * Free, reliable API for A-share market data
 * 免费、可靠的A股市场数据API
 */

import type {
  StockQuote,
  KLineData,
  IndexQuote,
  CapitalFlow,
  NorthBoundFlow,
  ApiResponse,
  KLineTimeFrame,
} from "../types";
import { logger, createRequestTracker } from "../logger";
import {
  quoteCache,
  indexCache,
  klineCache,
  capitalFlowCache,
  northBoundCache,
  getQuoteCacheKey,
  getKLineCacheKey,
  getIndexCacheKey,
  getCapitalFlowCacheKey,
  getKLineTTL,
} from "../cache";
import {
  parseChinaTimeToUnix,
  alignToBarStart,
  isWithinTradingHours,
  isIntradayTimeframe,
} from "../../trading/time-parser";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const SOURCE_NAME = "eastmoney";
const BASE_URL = "https://push2.eastmoney.com";
const QUOTE_URL = "https://push2.eastmoney.com/api/qt/stock/get";
const KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get";
const INDEX_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const FLOW_URL = "https://push2.eastmoney.com/api/qt/stock/get";
const NORTH_FLOW_URL = "https://push2his.eastmoney.com/api/qt/kamt.klatest/get";

// Default timeout for requests
// 默认请求超时
const DEFAULT_TIMEOUT = 10000;

// Market code mapping
// 市场代码映射
const MARKET_MAP: Record<string, number> = {
  sh: 1, // Shanghai / 上海
  sz: 0, // Shenzhen / 深圳
  bj: 0, // Beijing / 北京
};

// Major index codes
// 主要指数代码
const MAJOR_INDICES = [
  { code: "1.000001", name: "上证指数" },
  { code: "0.399001", name: "深证成指" },
  { code: "0.399006", name: "创业板指" },
  { code: "1.000300", name: "沪深300" },
  { code: "1.000016", name: "上证50" },
  { code: "0.399005", name: "中小板指" },
];

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Get market code from stock symbol
 * 从股票代码获取市场代码
 */
function getSecId(symbol: string): string {
  const code = symbol.replace(/\D/g, "");
  // Shanghai stocks start with 6, Beijing with 4/8
  // 上海股票以6开头，北京以4/8开头
  if (code.startsWith("6") || code.startsWith("9")) {
    return `1.${code}`;
  }
  return `0.${code}`;
}

/**
 * Get K-line period parameter
 * 获取K线周期参数
 */
function getKLinePeriod(timeframe: KLineTimeFrame): number {
  const periodMap: Record<KLineTimeFrame, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "60m": 60,
    "1d": 101,
    "1w": 102,
    "1M": 103,
  };
  return periodMap[timeframe] ?? 101;
}

/**
 * Parse EastMoney quote response
 * 解析东方财富行情响应
 */
function parseQuoteResponse(data: Record<string, unknown>): StockQuote | null {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d) return null;

    return {
      symbol: String(d.f57 ?? ""),
      name: String(d.f58 ?? ""),
      price: Number(d.f43 ?? 0) / 100,
      change: Number(d.f169 ?? 0) / 100,
      changePercent: Number(d.f170 ?? 0) / 100,
      open: Number(d.f46 ?? 0) / 100,
      high: Number(d.f44 ?? 0) / 100,
      low: Number(d.f45 ?? 0) / 100,
      prevClose: Number(d.f60 ?? 0) / 100,
      volume: Number(d.f47 ?? 0),
      amount: Number(d.f48 ?? 0),
      turnoverRate: Number(d.f168 ?? 0) / 100,
      pe: d.f162 ? Number(d.f162) / 100 : null,
      pb: d.f167 ? Number(d.f167) / 100 : null,
      marketCap: d.f116 ? Number(d.f116) : null,
      timestamp: Date.now(),
    };
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse quote response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse EastMoney K-line response
 * 解析东方财富K线响应
 *
 * ✨ Enhanced with timezone-aware parsing and trading hour validation
 * 增强版：支持时区感知解析和交易时段验证
 */
function parseKLineResponse(
  data: Record<string, unknown>,
  timeframe: KLineTimeFrame
): KLineData[] {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d || !d.klines) return [];

    const klines = d.klines as string[];
    const isIntraday = isIntradayTimeframe(timeframe);

    return klines
      .map((line): KLineData | null => {
        const parts = line.split(",");
        const timeStr = parts[0] ?? "";

        // ✅ FIX 1: Use timezone-aware parser for China market time
        // 使用时区感知的解析器处理中国市场时间
        const timestamp = parseChinaTimeToUnix(timeStr);

        // ✅ FIX 2: Align to bar start for intraday timeframes
        // 日内周期对齐到K线起始时间
        const alignedTime = isIntraday
          ? alignToBarStart(timestamp, timeframe)
          : timestamp;

        // ✅ FIX 3: Validate trading hours for intraday data
        // 验证日内数据的交易时段
        if (isIntraday && !isWithinTradingHours(alignedTime, timeframe)) {
          // Skip bars outside trading hours (pre-market, lunch break, after-hours)
          // 跳过交易时段外的K线（集合竞价、午休、盘后）
          logger.debug(SOURCE_NAME, `Skipping non-trading hour bar: ${timeStr}`);
          return null;
        }

        return {
          time: alignedTime,
          open: parseFloat(parts[1] ?? "0"),
          close: parseFloat(parts[2] ?? "0"),
          high: parseFloat(parts[3] ?? "0"),
          low: parseFloat(parts[4] ?? "0"),
          volume: parseFloat(parts[5] ?? "0"),
          amount: parseFloat(parts[6] ?? "0"),
        };
      })
      .filter((bar): bar is KLineData => bar !== null); // Remove invalid bars
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse K-line response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Parse EastMoney index response
 * 解析东方财富指数响应
 */
function parseIndexResponse(data: Record<string, unknown>): IndexQuote[] {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d || !d.diff) return [];

    const indices = d.diff as Record<string, unknown>[];
    return indices.map((item) => ({
      symbol: String(item.f12 ?? ""),
      name: String(item.f14 ?? ""),
      price: Number(item.f2 ?? 0) / 100,
      change: Number(item.f4 ?? 0) / 100,
      changePercent: Number(item.f3 ?? 0) / 100,
      volume: Number(item.f5 ?? 0),
      amount: Number(item.f6 ?? 0),
      timestamp: Date.now(),
    }));
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse index response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Parse EastMoney capital flow response
 * 解析东方财富资金流向响应
 */
function parseCapitalFlowResponse(
  data: Record<string, unknown>,
  symbol: string,
): CapitalFlow | null {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d) return null;

    return {
      symbol,
      name: String(d.f58 ?? ""),
      mainNetInflow: Number(d.f62 ?? 0),
      superLargeInflow: Number(d.f66 ?? 0),
      largeInflow: Number(d.f72 ?? 0),
      mediumInflow: Number(d.f78 ?? 0),
      smallInflow: Number(d.f84 ?? 0),
      timestamp: Date.now(),
    };
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse capital flow response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse north-bound capital flow response
 * 解析北向资金流向响应
 */
function parseNorthBoundResponse(
  data: Record<string, unknown>,
): NorthBoundFlow | null {
  try {
    const d = data.data as Record<string, unknown>;
    if (!d) return null;

    return {
      date: String(d.s2n_date ?? ""),
      shConnect: Number(d.hgt ?? 0),
      szConnect: Number(d.sgt ?? 0),
      total: Number(d.northMoney ?? 0),
      shQuota: Number(d.hgtSY ?? 0),
      szQuota: Number(d.sgtSY ?? 0),
      timestamp: Date.now(),
    };
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse north-bound response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// =============================================================================
// API FUNCTIONS / API函数
// =============================================================================

/**
 * Fetch with timeout and error handling
 * 带超时和错误处理的fetch
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://quote.eastmoney.com/",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get stock quote
 * 获取股票行情
 */
export async function getStockQuote(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  const cacheKey = getQuoteCacheKey(symbol);
  const tracker = createRequestTracker(SOURCE_NAME, `quote/${symbol}`);

  // Check cache first
  // 首先检查缓存
  const cached = quoteCache.get(cacheKey);
  if (cached) {
    tracker.complete("success", { cached: true });
    return {
      success: true,
      data: cached,
      source: SOURCE_NAME,
      cached: true,
      timestamp: Date.now(),
      latency: 0,
    };
  }

  try {
    const secId = getSecId(symbol);
    const url = `${QUOTE_URL}?secid=${secId}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f116,f162,f167,f168,f169,f170`;

    logger.debug(SOURCE_NAME, `Fetching quote for ${symbol}`, { url });

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const quote = parseQuoteResponse(data);

    if (!quote) {
      throw new Error("Failed to parse quote data");
    }

    // Cache the result
    // 缓存结果
    quoteCache.set(cacheKey, quote, { source: SOURCE_NAME, ttl: 5000 });

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: quote,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(SOURCE_NAME, `Failed to fetch quote for ${symbol}`, {
      error: errorMessage,
    });

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get K-line data
 * 获取K线数据
 */
export async function getKLineData(
  symbol: string,
  timeframe: KLineTimeFrame = "1d",
  limit: number = 200,
): Promise<ApiResponse<KLineData[]>> {
  const cacheKey = getKLineCacheKey(symbol, timeframe);
  const tracker = createRequestTracker(
    SOURCE_NAME,
    `kline/${symbol}/${timeframe}`,
  );

  // Check cache first
  // 首先检查缓存
  const cached = klineCache.get(cacheKey);
  if (cached) {
    tracker.complete("success", { cached: true });
    return {
      success: true,
      data: cached,
      source: SOURCE_NAME,
      cached: true,
      timestamp: Date.now(),
      latency: 0,
    };
  }

  try {
    const secId = getSecId(symbol);
    const klt = getKLinePeriod(timeframe);
    const url = `${KLINE_URL}?secid=${secId}&klt=${klt}&fqt=1&lmt=${limit}&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;

    logger.debug(SOURCE_NAME, `Fetching K-line for ${symbol}`, {
      timeframe,
      limit,
    });

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const klines = parseKLineResponse(data, timeframe); // ✨ Pass timeframe parameter

    if (klines.length === 0) {
      throw new Error("No K-line data returned");
    }

    // Cache the result with timeframe-specific TTL
    // 使用周期特定的TTL缓存结果
    klineCache.set(cacheKey, klines, {
      source: SOURCE_NAME,
      ttl: getKLineTTL(timeframe),
    });

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: klines,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(SOURCE_NAME, `Failed to fetch K-line for ${symbol}`, {
      error: errorMessage,
      timeframe,
    });

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get major indices
 * 获取主要指数
 */
export async function getMajorIndices(): Promise<ApiResponse<IndexQuote[]>> {
  const cacheKey = "indices:major";
  const tracker = createRequestTracker(SOURCE_NAME, "indices/major");

  // Check cache first
  // 首先检查缓存
  const cached = indexCache.get(cacheKey) as unknown as IndexQuote[];
  if (cached) {
    tracker.complete("success", { cached: true });
    return {
      success: true,
      data: cached,
      source: SOURCE_NAME,
      cached: true,
      timestamp: Date.now(),
      latency: 0,
    };
  }

  try {
    const secIds = MAJOR_INDICES.map((i) => i.code).join(",");
    const url = `${INDEX_URL}?secids=${secIds}&fields=f2,f3,f4,f5,f6,f12,f14`;

    logger.debug(SOURCE_NAME, "Fetching major indices");

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const indices = parseIndexResponse(data);

    if (indices.length === 0) {
      throw new Error("No index data returned");
    }

    // Cache the result
    // 缓存结果
    (
      indexCache as unknown as {
        set: (
          k: string,
          v: IndexQuote[],
          o: { source: string; ttl: number },
        ) => void;
      }
    ).set(cacheKey, indices, { source: SOURCE_NAME, ttl: 5000 });

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: indices,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(SOURCE_NAME, "Failed to fetch major indices", {
      error: errorMessage,
    });

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get capital flow for a stock
 * 获取股票资金流向
 */
export async function getCapitalFlow(
  symbol: string,
): Promise<ApiResponse<CapitalFlow>> {
  const cacheKey = getCapitalFlowCacheKey(symbol);
  const tracker = createRequestTracker(SOURCE_NAME, `flow/${symbol}`);

  // Check cache first
  // 首先检查缓存
  const cached = capitalFlowCache.get(cacheKey);
  if (cached) {
    tracker.complete("success", { cached: true });
    return {
      success: true,
      data: cached,
      source: SOURCE_NAME,
      cached: true,
      timestamp: Date.now(),
      latency: 0,
    };
  }

  try {
    const secId = getSecId(symbol);
    const url = `${FLOW_URL}?secid=${secId}&fields=f58,f62,f66,f72,f78,f84`;

    logger.debug(SOURCE_NAME, `Fetching capital flow for ${symbol}`);

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const flow = parseCapitalFlowResponse(data, symbol);

    if (!flow) {
      throw new Error("Failed to parse capital flow data");
    }

    // Cache the result
    // 缓存结果
    capitalFlowCache.set(cacheKey, flow, { source: SOURCE_NAME, ttl: 30000 });

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: flow,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(SOURCE_NAME, `Failed to fetch capital flow for ${symbol}`, {
      error: errorMessage,
    });

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}

/**
 * Get north-bound capital flow
 * 获取北向资金流向
 */
export async function getNorthBoundFlow(): Promise<
  ApiResponse<NorthBoundFlow>
> {
  const cacheKey = "northbound:latest";
  const tracker = createRequestTracker(SOURCE_NAME, "northbound/latest");

  // Check cache first
  // 首先检查缓存
  const cached = northBoundCache.get(cacheKey);
  if (cached) {
    tracker.complete("success", { cached: true });
    return {
      success: true,
      data: cached,
      source: SOURCE_NAME,
      cached: true,
      timestamp: Date.now(),
      latency: 0,
    };
  }

  try {
    const url = `${NORTH_FLOW_URL}?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56`;

    logger.debug(SOURCE_NAME, "Fetching north-bound capital flow");

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const flow = parseNorthBoundResponse(data);

    if (!flow) {
      throw new Error("Failed to parse north-bound flow data");
    }

    // Cache the result
    // 缓存结果
    northBoundCache.set(cacheKey, flow, { source: SOURCE_NAME, ttl: 60000 });

    const metrics = tracker.complete("success", {
      statusCode: response.status,
      cached: false,
    });

    return {
      success: true,
      data: flow,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });

    logger.error(SOURCE_NAME, "Failed to fetch north-bound flow", {
      error: errorMessage,
    });

    return {
      success: false,
      data: null,
      error: errorMessage,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: 0,
    };
  }
}
