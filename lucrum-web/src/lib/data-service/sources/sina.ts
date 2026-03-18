/**
 * Sina Finance (新浪财经) Data Source Implementation
 * 新浪财经数据源实现
 *
 * Alternative data source for A-share market data
 * A股市场数据备用数据源
 */

import type {
  StockQuote,
  KLineData,
  IndexQuote,
  ApiResponse,
  KLineTimeFrame,
} from "../types";
import { logger, createRequestTracker } from "../logger";
import {
  quoteCache,
  klineCache,
  getQuoteCacheKey,
  getKLineCacheKey,
  getKLineTTL,
} from "../cache";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const SOURCE_NAME = "sina";
const QUOTE_URL = "https://hq.sinajs.cn/list=";
const KLINE_URL =
  "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData";

// Default timeout for requests
// 默认请求超时
const DEFAULT_TIMEOUT = 10000;

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Get Sina symbol format from standard symbol
 * 从标准代码获取新浪股票代码格式
 */
function getSinaSymbol(symbol: string): string {
  const code = symbol.replace(/\D/g, "");
  // Shanghai stocks start with 6
  // 上海股票以6开头
  if (code.startsWith("6") || code.startsWith("9")) {
    return `sh${code}`;
  }
  return `sz${code}`;
}

/**
 * Get Sina K-line scale parameter
 * 获取新浪K线周期参数
 */
function getSinaScale(timeframe: KLineTimeFrame): number {
  const scaleMap: Record<KLineTimeFrame, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "60m": 60,
    "1d": 240,
    "1w": 1680,
    "1M": 7200,
  };
  return scaleMap[timeframe] ?? 240;
}

/**
 * Parse Sina quote response
 * 解析新浪行情响应
 */
function parseSinaQuote(text: string, symbol: string): StockQuote | null {
  try {
    // Format: var hq_str_sh600519="贵州茅台,1865.000,1869.900,..."
    // 格式：var hq_str_sh600519="贵州茅台,1865.000,1869.900,..."
    const match = text.match(/="([^"]+)"/);
    if (!match?.[1]) return null;

    const parts = match[1].split(",");
    if (parts.length < 32) return null;

    const name = parts[0] ?? "";
    const open = parseFloat(parts[1] ?? "0");
    const prevClose = parseFloat(parts[2] ?? "0");
    const price = parseFloat(parts[3] ?? "0");
    const high = parseFloat(parts[4] ?? "0");
    const low = parseFloat(parts[5] ?? "0");
    const volume = parseFloat(parts[8] ?? "0") / 100; // In lots / 手
    const amount = parseFloat(parts[9] ?? "0");

    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol: symbol.replace(/\D/g, ""),
      name,
      price,
      change,
      changePercent,
      open,
      high,
      low,
      prevClose,
      volume: volume * 100, // Convert to shares / 转换为股
      amount,
      turnoverRate: 0, // Not available from Sina / 新浪不提供
      pe: null,
      pb: null,
      marketCap: null,
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
 * Parse Sina K-line response
 * 解析新浪K线响应
 */
function parseSinaKLine(data: unknown[]): KLineData[] {
  try {
    return data.map((item) => {
      const k = item as Record<string, string>;
      const dateStr = k.day ?? k.date ?? "";
      const date = new Date(dateStr.replace(/-/g, "/"));

      return {
        time: Math.floor(date.getTime() / 1000),
        open: parseFloat(k.open ?? "0"),
        high: parseFloat(k.high ?? "0"),
        low: parseFloat(k.low ?? "0"),
        close: parseFloat(k.close ?? "0"),
        volume: parseFloat(k.volume ?? "0"),
      };
    });
  } catch (err) {
    logger.error(SOURCE_NAME, "Failed to parse K-line response", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
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
        Referer: "https://finance.sina.com.cn/",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get stock quote from Sina
 * 从新浪获取股票行情
 */
export async function getStockQuote(
  symbol: string,
): Promise<ApiResponse<StockQuote>> {
  const cacheKey = `sina:${getQuoteCacheKey(symbol)}`;
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
    const sinaSymbol = getSinaSymbol(symbol);
    const url = `${QUOTE_URL}${sinaSymbol}`;

    logger.debug(SOURCE_NAME, `Fetching quote for ${symbol}`, { url });

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Sina returns GBK encoded text
    // 新浪返回GBK编码的文本
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("gbk");
    const text = decoder.decode(buffer);

    const quote = parseSinaQuote(text, symbol);

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
 * Get K-line data from Sina
 * 从新浪获取K线数据
 */
export async function getKLineData(
  symbol: string,
  timeframe: KLineTimeFrame = "1d",
  limit: number = 200,
): Promise<ApiResponse<KLineData[]>> {
  const cacheKey = `sina:${getKLineCacheKey(symbol, timeframe)}`;
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
    const sinaSymbol = getSinaSymbol(symbol);
    const scale = getSinaScale(timeframe);
    const url = `${KLINE_URL}?symbol=${sinaSymbol}&scale=${scale}&datalen=${limit}`;

    logger.debug(SOURCE_NAME, `Fetching K-line for ${symbol}`, {
      timeframe,
      limit,
    });

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown[];
    const klines = parseSinaKLine(data);

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
 * Get major indices from Sina
 * 从新浪获取主要指数
 */
export async function getMajorIndices(): Promise<ApiResponse<IndexQuote[]>> {
  const tracker = createRequestTracker(SOURCE_NAME, "indices/major");

  try {
    // Fetch major indices
    // 获取主要指数
    const symbols = "s_sh000001,s_sz399001,s_sz399006,s_sh000300,s_sh000016";
    const url = `${QUOTE_URL}${symbols}`;

    logger.debug(SOURCE_NAME, "Fetching major indices");

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("gbk");
    const text = decoder.decode(buffer);

    // Parse multiple indices
    // 解析多个指数
    const lines = text.split(";").filter((l) => l.trim());
    const indices: IndexQuote[] = [];

    for (const line of lines) {
      const match = line.match(/hq_str_s_(\w+)="([^"]+)"/);
      if (!match?.[1] || !match[2]) continue;

      const symbol = match[1];
      const parts = match[2].split(",");
      if (parts.length < 6) continue;

      indices.push({
        symbol: symbol.replace(/^s_/, ""),
        name: parts[0] ?? "",
        price: parseFloat(parts[1] ?? "0"),
        change: parseFloat(parts[2] ?? "0"),
        changePercent: parseFloat(parts[3] ?? "0"),
        volume: parseFloat(parts[4] ?? "0"),
        amount: parseFloat(parts[5] ?? "0"),
        timestamp: Date.now(),
      });
    }

    if (indices.length === 0) {
      throw new Error("No index data returned");
    }

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
