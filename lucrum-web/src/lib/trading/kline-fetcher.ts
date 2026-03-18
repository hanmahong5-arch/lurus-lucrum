/**
 * Intelligent K-Line Data Fetcher
 * 智能K线数据获取器
 *
 * Multi-source K-line data fetching with automatic fallback.
 * Supports EastMoney, Sina, Tencent, and intelligent mock data.
 * 多数据源K线获取，支持自动降级和智能模拟数据
 *
 * @module lib/trading/kline-fetcher
 */

import type { KLineData, KLineTimeFrame } from "../data-service/types";
import {
  getChinaTime,
  isTradingDay,
  isMarketOpen,
  A_SHARE_HOURS,
} from "./time-utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * K-line fetch configuration
 */
export interface KLineFetchConfig {
  symbol: string; // Stock code / 股票代码
  timeframe: KLineTimeFrame; // Time period / 时间周期
  count?: number; // Number of bars / K线数量
  from?: number; // Start timestamp (Unix seconds)
  to?: number; // End timestamp (Unix seconds)
}

/**
 * K-line fetch result
 */
export interface KLineFetchResult {
  success: boolean;
  data: KLineData[];
  source: string; // Which source provided data
  error?: string;
  latency: number;
  isMock: boolean; // Whether data is mock
}

/**
 * Data source definition
 */
interface DataSource {
  name: string;
  priority: number;
  fetcher: (config: KLineFetchConfig) => Promise<KLineData[]>;
  enabled: boolean;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/**
 * Stock base prices for intelligent mock data
 * Use approximate current prices for realistic simulation
 * 股票基准价格，用于生成逼真的模拟数据
 */
const STOCK_BASE_PRICES: Record<string, number> = {
  // Blue chips / 蓝筹股
  "600519": 1680, // 贵州茅台
  "601318": 48, // 中国平安
  "600036": 32, // 招商银行
  "000858": 140, // 五粮液
  "000333": 58, // 美的集团
  "600276": 28, // 恒瑞医药
  "601899": 16, // 紫金矿业
  "600900": 22, // 长江电力
  "002594": 240, // 比亚迪
  "601398": 5.2, // 工商银行

  // Tech stocks / 科技股
  "300750": 190, // 宁德时代
  "002415": 32, // 海康威视
  "688981": 75, // 中芯国际
  "300059": 15, // 东方财富

  // Indices / 指数
  "000001": 3150, // 上证指数
  "399001": 10200, // 深证成指
  "399006": 2050, // 创业板指
  "000300": 3700, // 沪深300
  "000016": 2450, // 上证50
  "000905": 5200, // 中证500

  // Default for unknown symbols
  default: 20,
};

/**
 * Volatility by symbol type (daily percentage)
 * 不同股票类型的日波动率
 */
const VOLATILITY_MAP: Record<string, number> = {
  index: 0.015, // 指数波动较小
  bluechip: 0.02, // 蓝筹股
  tech: 0.035, // 科技股波动大
  default: 0.025, // 默认
};

/**
 * Time interval in milliseconds for each timeframe
 * 各周期的时间间隔（毫秒）
 */
const TIMEFRAME_INTERVALS: Record<KLineTimeFrame, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Default bar count for each timeframe
 * 各周期默认K线数量
 */
const DEFAULT_COUNTS: Record<KLineTimeFrame, number> = {
  "1m": 240, // 1 trading day
  "5m": 240, // 5 trading days
  "15m": 240, // ~10 trading days
  "30m": 240, // ~20 trading days
  "60m": 240, // ~40 trading days
  "1d": 200, // ~200 trading days
  "1w": 104, // 2 years
  "1M": 60, // 5 years
};

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Get base price for a symbol
 */
function getBasePrice(symbol: string): number {
  const code = symbol.replace(/\D/g, "");
  return STOCK_BASE_PRICES[code] ?? STOCK_BASE_PRICES["default"] ?? 20;
}

/**
 * Get volatility for a symbol
 */
function getVolatility(symbol: string, timeframe: KLineTimeFrame): number {
  const code = symbol.replace(/\D/g, "");
  const defaultVolatility = 0.025;

  // Determine symbol type
  let baseVolatility: number;
  if (code.startsWith("000") && code.length === 6 && !code.startsWith("0000")) {
    // Index-like codes
    baseVolatility = VOLATILITY_MAP["index"] ?? defaultVolatility;
  } else if (
    ["600519", "601318", "600036", "000858", "600900"].includes(code)
  ) {
    baseVolatility = VOLATILITY_MAP["bluechip"] ?? defaultVolatility;
  } else if (code.startsWith("300") || code.startsWith("688")) {
    baseVolatility = VOLATILITY_MAP["tech"] ?? defaultVolatility;
  } else {
    baseVolatility = VOLATILITY_MAP["default"] ?? defaultVolatility;
  }

  // Adjust for timeframe (smaller timeframes have less volatility per bar)
  const dailyMs = 24 * 60 * 60 * 1000;
  const tfMs = TIMEFRAME_INTERVALS[timeframe];
  const scaleFactor = Math.sqrt(tfMs / dailyMs);

  return baseVolatility * scaleFactor;
}

/**
 * Round number to specified decimal places
 */
function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Get market code from symbol for API calls
 */
function getSecId(symbol: string): string {
  const code = symbol.replace(/\D/g, "");
  if (code.startsWith("6") || code.startsWith("9")) {
    return `1.${code}`; // Shanghai
  }
  return `0.${code}`; // Shenzhen/Beijing
}

/**
 * Get EastMoney K-line period parameter
 */
function getEMPeriod(timeframe: KLineTimeFrame): number {
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
 * Check if a timestamp is within A-share trading hours
 * Only applies to intraday timeframes
 */
function isWithinTradingHours(
  timestamp: number,
  timeframe: KLineTimeFrame,
): boolean {
  // Daily and above don't need trading hour check
  if (["1d", "1w", "1M"].includes(timeframe)) {
    return true;
  }

  const date = new Date(timestamp);
  const chinaDate = getChinaTime(date);
  const hours = chinaDate.getHours();
  const minutes = chinaDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Check if it's a trading day
  if (!isTradingDay(chinaDate)) {
    return false;
  }

  // Morning session: 9:30-11:30
  // Afternoon session: 13:00-15:00
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;

  return (
    (totalMinutes >= morningStart && totalMinutes < morningEnd) ||
    (totalMinutes >= afternoonStart && totalMinutes < afternoonEnd)
  );
}

/**
 * Get the number of trading minutes in a day
 */
function getTradingMinutesPerDay(): number {
  return (11.5 - 9.5) * 60 + (15 - 13) * 60; // 240 minutes
}

// =============================================================================
// DATA SOURCE IMPLEMENTATIONS / 数据源实现
// =============================================================================

/**
 * Fetch K-line data from EastMoney
 * 从东方财富获取K线数据
 */
async function fetchFromEastMoney(
  config: KLineFetchConfig,
): Promise<KLineData[]> {
  const { symbol, timeframe, count = DEFAULT_COUNTS[timeframe] } = config;

  const secId = getSecId(symbol);
  const klt = getEMPeriod(timeframe);
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&klt=${klt}&fqt=1&lmt=${count}&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;

  console.log(`[KLineFetcher] EastMoney request: ${symbol} ${timeframe}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://quote.eastmoney.com/",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: {
        klines?: string[];
      };
    };

    if (!data.data?.klines || data.data.klines.length === 0) {
      throw new Error("No K-line data returned");
    }

    return data.data.klines.map((line: string) => {
      const parts = line.split(",");
      const timeStr = parts[0] ?? "";
      const date = new Date(timeStr.replace(/-/g, "/"));

      return {
        time: Math.floor(date.getTime() / 1000),
        open: parseFloat(parts[1] ?? "0"),
        close: parseFloat(parts[2] ?? "0"),
        high: parseFloat(parts[3] ?? "0"),
        low: parseFloat(parts[4] ?? "0"),
        volume: parseFloat(parts[5] ?? "0"),
        amount: parseFloat(parts[6] ?? "0"),
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch K-line data from Sina
 * 从新浪获取K线数据
 */
async function fetchFromSina(config: KLineFetchConfig): Promise<KLineData[]> {
  const { symbol, timeframe, count = DEFAULT_COUNTS[timeframe] } = config;

  const code = symbol.replace(/\D/g, "");
  const market = code.startsWith("6") ? "sh" : "sz";
  const fullSymbol = `${market}${code}`;

  // Sina API uses different scale values
  const scaleMap: Partial<Record<KLineTimeFrame, number>> = {
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "60m": 60,
    "1d": 240,
    "1w": 1680,
  };

  const scale = scaleMap[timeframe];
  if (!scale) {
    throw new Error(`Sina does not support ${timeframe} timeframe`);
  }

  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullSymbol}&scale=${scale}&ma=no&datalen=${count}`;

  console.log(`[KLineFetcher] Sina request: ${symbol} ${timeframe}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://finance.sina.com.cn/",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    // Sina returns JavaScript array, need to parse
    const data = JSON.parse(text) as Array<{
      day: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No K-line data returned");
    }

    return data.map((item) => {
      const date = new Date(item.day.replace(/-/g, "/"));
      return {
        time: Math.floor(date.getTime() / 1000),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume),
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch K-line data from Tencent
 * 从腾讯获取K线数据
 */
async function fetchFromTencent(
  config: KLineFetchConfig,
): Promise<KLineData[]> {
  const { symbol, timeframe, count = DEFAULT_COUNTS[timeframe] } = config;

  const code = symbol.replace(/\D/g, "");
  const market = code.startsWith("6") ? "sh" : "sz";
  const fullSymbol = `${market}${code}`;

  // Tencent K-line period mapping
  const periodMap: Partial<Record<KLineTimeFrame, string>> = {
    "1m": "m1",
    "5m": "m5",
    "15m": "m15",
    "30m": "m30",
    "60m": "m60",
    "1d": "day",
    "1w": "week",
    "1M": "month",
  };

  const period = periodMap[timeframe];
  if (!period) {
    throw new Error(`Tencent does not support ${timeframe} timeframe`);
  }

  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${fullSymbol},${period},,,${count},qfq`;

  console.log(`[KLineFetcher] Tencent request: ${symbol} ${timeframe}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://stockapp.finance.qq.com/",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Record<
        string,
        {
          qfq?: string[][];
          day?: string[][];
          [key: string]: string[][] | undefined;
        }
      >;
    };

    if (!data.data?.[fullSymbol]) {
      throw new Error("No data for symbol");
    }

    const klineData = data.data[fullSymbol];
    // Tencent returns data in qfq (前复权) or day/week/month arrays
    const klines = klineData.qfq || klineData[period] || [];

    if (!Array.isArray(klines) || klines.length === 0) {
      throw new Error("No K-line data returned");
    }

    return klines.map((item: string[]) => {
      const dateStr = item[0] ?? "";
      const date = new Date(dateStr.replace(/-/g, "/"));
      return {
        time: Math.floor(date.getTime() / 1000),
        open: parseFloat(item[1] ?? "0"),
        close: parseFloat(item[2] ?? "0"),
        high: parseFloat(item[3] ?? "0"),
        low: parseFloat(item[4] ?? "0"),
        volume: parseFloat(item[5] ?? "0"),
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate intelligent mock K-line data
 * 生成智能模拟K线数据
 *
 * Creates realistic-looking data based on:
 * - Symbol-specific base prices
 * - Timeframe-appropriate volatility
 * - Trading hours compliance
 * - Natural price movement patterns
 */
async function generateIntelligentMock(
  config: KLineFetchConfig,
): Promise<KLineData[]> {
  const { symbol, timeframe, count = DEFAULT_COUNTS[timeframe] } = config;

  console.log(
    `[KLineFetcher] Generating intelligent mock: ${symbol} ${timeframe} x${count}`,
  );

  const basePrice = getBasePrice(symbol);
  const volatility = getVolatility(symbol, timeframe);
  const interval = TIMEFRAME_INTERVALS[timeframe];

  const bars: KLineData[] = [];
  let price = basePrice;

  // Calculate start time
  const now = Date.now();
  const isIntraday = ["1m", "5m", "15m", "30m", "60m"].includes(timeframe);

  // For intraday, we need to account for trading hours
  let currentTime: number;

  if (isIntraday) {
    // Start from the appropriate trading session
    const chinaTime = getChinaTime(new Date(now));
    const totalBarsNeeded = count;

    // Calculate how many bars fit in one trading day
    const tradingMinutes = getTradingMinutesPerDay();
    const barMinutes = interval / 60000;
    const barsPerDay = Math.floor(tradingMinutes / barMinutes);

    // Calculate how many days we need to go back
    const daysNeeded = Math.ceil(totalBarsNeeded / barsPerDay) + 1;

    // Start from daysNeeded trading days ago
    let startDate = new Date(chinaTime);
    let tradingDaysFound = 0;

    while (tradingDaysFound < daysNeeded) {
      startDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      if (isTradingDay(startDate)) {
        tradingDaysFound++;
      }
    }

    // Set to morning open
    startDate.setHours(9, 30, 0, 0);
    currentTime = startDate.getTime();

    // Generate bars respecting trading hours
    let barsGenerated = 0;
    while (barsGenerated < totalBarsNeeded && currentTime < now) {
      const barDate = new Date(currentTime);
      const hours = barDate.getHours();
      const minutes = barDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      // Check if within trading hours
      const morningStart = 9 * 60 + 30;
      const morningEnd = 11 * 60 + 30;
      const afternoonStart = 13 * 60;
      const afternoonEnd = 15 * 60;

      const isTrading =
        isTradingDay(barDate) &&
        ((totalMinutes >= morningStart && totalMinutes < morningEnd) ||
          (totalMinutes >= afternoonStart && totalMinutes < afternoonEnd));

      if (isTrading) {
        const bar = generateSingleBar(price, volatility, currentTime);
        bars.push(bar);
        price = bar.close;
        barsGenerated++;
      }

      // Advance time
      currentTime += interval;

      // If we've passed afternoon close, jump to next day's morning
      if (totalMinutes >= afternoonEnd) {
        const nextDay = new Date(barDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(9, 30, 0, 0);
        currentTime = nextDay.getTime();
      }
      // If we've passed morning close, jump to afternoon
      else if (totalMinutes >= morningEnd && totalMinutes < afternoonStart) {
        const sameDay = new Date(barDate);
        sameDay.setHours(13, 0, 0, 0);
        currentTime = sameDay.getTime();
      }
    }
  } else {
    // Daily, weekly, monthly - simpler calculation
    currentTime = now - count * interval;

    for (let i = 0; i < count; i++) {
      const barDate = new Date(currentTime);

      // For daily bars, skip non-trading days
      if (timeframe === "1d" && !isTradingDay(barDate)) {
        currentTime += interval;
        continue;
      }

      const bar = generateSingleBar(price, volatility, currentTime);
      bars.push(bar);
      price = bar.close;
      currentTime += interval;
    }
  }

  // Sort by time and trim to requested count
  bars.sort((a, b) => a.time - b.time);
  return bars.slice(-count);
}

/**
 * Generate a single K-line bar
 */
function generateSingleBar(
  basePrice: number,
  volatility: number,
  timestamp: number,
): KLineData {
  // Add some randomness to price movement
  const trend = Math.random() - 0.5; // Random trend direction
  const change = trend * volatility * 2;

  const open = basePrice;
  const close = basePrice * (1 + change);

  // Generate high and low based on open/close
  const highMultiplier = 1 + Math.random() * volatility * 0.5;
  const lowMultiplier = 1 - Math.random() * volatility * 0.5;

  const high = Math.max(open, close) * highMultiplier;
  const low = Math.min(open, close) * lowMultiplier;

  // Generate volume (random but somewhat consistent)
  const baseVolume = 10000000; // 10M shares base
  const volumeVariation = Math.random() * 0.5 + 0.75; // 0.75-1.25x
  const volume = Math.floor(baseVolume * volumeVariation);

  return {
    time: Math.floor(timestamp / 1000),
    open: round(open, 2),
    high: round(high, 2),
    low: round(low, 2),
    close: round(close, 2),
    volume,
    amount: Math.floor(volume * ((open + close) / 2)),
  };
}

// =============================================================================
// MAIN EXPORT / 主要导出
// =============================================================================

/**
 * Fetch K-line data from backend API (CORS-safe)
 * 从后端API获取K线数据（无CORS问题）
 *
 * This is the preferred method for browser environments.
 * The backend proxies requests to third-party APIs.
 */
async function fetchFromBackendAPI(
  config: KLineFetchConfig,
): Promise<KLineData[]> {
  const { symbol, timeframe, count = DEFAULT_COUNTS[timeframe] } = config;

  const url = `/api/market/kline?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${count}`;

  console.log(`[KLineFetcher] Backend API request: ${symbol} ${timeframe}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      data?: KLineData[];
      error?: string;
    };

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(result.error || "No K-line data returned");
    }

    console.log(
      `[KLineFetcher] Backend API success: ${result.data.length} bars`,
    );
    return result.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Data sources in priority order
 * In browser environment, use backend API first (CORS-safe)
 * Direct API calls are disabled because of CORS restrictions
 */
const DATA_SOURCES: DataSource[] = [
  {
    name: "backend-api",
    priority: 1,
    fetcher: fetchFromBackendAPI,
    enabled: true,
  },
  // Direct API calls are disabled in browser due to CORS
  // These are kept for server-side usage only
  {
    name: "eastmoney",
    priority: 2,
    fetcher: fetchFromEastMoney,
    enabled: false, // Disabled: CORS blocked in browser
  },
  { name: "sina", priority: 3, fetcher: fetchFromSina, enabled: false }, // Disabled: CORS
  { name: "tencent", priority: 4, fetcher: fetchFromTencent, enabled: false }, // Disabled: CORS
  {
    name: "mock",
    priority: 999,
    fetcher: generateIntelligentMock,
    enabled: true,
  },
];

/**
 * Fetch K-line data with automatic fallback
 * 获取K线数据，自动降级
 *
 * Tries multiple data sources in priority order.
 * Falls back to intelligent mock data if all sources fail.
 *
 * @param config - Fetch configuration
 * @returns K-line data with source info
 */
export async function fetchKLineWithFallback(
  config: KLineFetchConfig,
): Promise<KLineFetchResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Try each enabled source in priority order
  for (const source of DATA_SOURCES) {
    if (!source.enabled) continue;

    try {
      console.log(
        `[KLineFetcher] Trying ${source.name} for ${config.symbol} ${config.timeframe}`,
      );

      const data = await source.fetcher(config);

      if (data && data.length > 0) {
        console.log(
          `[KLineFetcher] Success from ${source.name}: ${data.length} bars`,
        );

        return {
          success: true,
          data,
          source: source.name,
          latency: Date.now() - startTime,
          isMock: source.name === "mock",
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[KLineFetcher] ${source.name} failed:`, errorMsg);
      errors.push(`${source.name}: ${errorMsg}`);
      continue;
    }
  }

  // All sources failed (including mock, which shouldn't fail)
  return {
    success: false,
    data: [],
    source: "none",
    error: `All data sources failed: ${errors.join("; ")}`,
    latency: Date.now() - startTime,
    isMock: false,
  };
}

/**
 * Convenience function to get K-line data with defaults
 */
export async function getKLineData(
  symbol: string,
  timeframe: KLineTimeFrame = "1d",
  count?: number,
): Promise<KLineFetchResult> {
  return fetchKLineWithFallback({
    symbol,
    timeframe,
    count: count ?? DEFAULT_COUNTS[timeframe],
  });
}

/**
 * Get supported timeframes
 */
export function getSupportedTimeframes(): KLineTimeFrame[] {
  return ["1m", "5m", "15m", "30m", "60m", "1d", "1w", "1M"];
}

/**
 * Get default count for a timeframe
 */
export function getDefaultCount(timeframe: KLineTimeFrame): number {
  return DEFAULT_COUNTS[timeframe];
}

/**
 * Check if a timeframe is intraday
 */
export function isIntradayTimeframe(timeframe: KLineTimeFrame): boolean {
  return ["1m", "5m", "15m", "30m", "60m"].includes(timeframe);
}
