/**
 * EastMoney Institutional Data Source
 * 东方财富机构数据源
 *
 * Extended API for institutional-grade market data:
 * - Dragon Tiger List (龙虎榜)
 * - Sector Capital Flow (板块资金流向)
 * - Margin Trading (融资融券)
 * - Large Order Flow (大单流向)
 * - Market Sentiment (市场情绪)
 *
 * 机构级市场数据扩展API
 */

import type {
  DragonTigerEntry,
  SectorCapitalFlow,
  MarginTradingData,
  LargeOrderFlow,
  MarketSentiment,
  ApiResponse,
} from "../types";
import { logger, createRequestTracker } from "../logger";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const SOURCE_NAME = "eastmoney-institutional";
const DATACENTER_URL = "https://datacenter-web.eastmoney.com/api/data/v1/get";
const PUSH2_URL = "https://push2.eastmoney.com/api/qt/clist/get";
const DEFAULT_TIMEOUT = 15000;

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
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
        Referer: "https://data.eastmoney.com/",
        Accept: "application/json, text/plain, */*",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse JSONP response to JSON
 * 解析JSONP响应为JSON
 */
function parseJsonpResponse(text: string): Record<string, unknown> {
  // Remove JSONP callback wrapper: jQuery...({"data": ...})
  const jsonMatch = text.match(/\((\{[\s\S]*\})\)/);
  if (jsonMatch?.[1]) {
    return JSON.parse(jsonMatch[1]) as Record<string, unknown>;
  }
  // Try direct JSON parse
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * Format date to YYYY-MM-DD
 * 格式化日期
 */
function formatDate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0] ?? "";
}

/**
 * Get date N days ago
 * 获取N天前的日期
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

// =============================================================================
// DRAGON TIGER LIST API / 龙虎榜API
// =============================================================================

/**
 * Get Dragon Tiger List data
 * 获取龙虎榜数据
 *
 * @param days - Number of days to fetch (default: 5)
 * @param pageSize - Number of entries per page (default: 50)
 */
export async function getDragonTigerList(
  days: number = 5,
  pageSize: number = 50,
): Promise<ApiResponse<DragonTigerEntry[]>> {
  const tracker = createRequestTracker(SOURCE_NAME, "dragon-tiger");

  try {
    const startDate = getDateDaysAgo(days);
    const callback = `jQuery${Date.now()}_${Math.random().toString().slice(2, 10)}`;

    const params = new URLSearchParams({
      callback,
      sortColumns: "NET_BUY_AMT,TRADE_DATE,SECURITY_CODE",
      sortTypes: "-1,-1,1",
      pageSize: pageSize.toString(),
      pageNumber: "1",
      reportName: "RPT_ORGANIZATION_TRADE_DETAILS",
      columns: "ALL",
      source: "WEB",
      client: "WEB",
      filter: `(TRADE_DATE>='${startDate}')`,
    });

    const url = `${DATACENTER_URL}?${params.toString()}`;
    logger.debug(SOURCE_NAME, "Fetching dragon tiger list", { startDate, pageSize });

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const data = parseJsonpResponse(text);

    if (!data.success || !data.result) {
      throw new Error("Invalid response from Dragon Tiger API");
    }

    const result = data.result as { data: Record<string, unknown>[] };
    const entries: DragonTigerEntry[] = (result.data || []).map((item) => ({
      symbol: String(item.SECURITY_CODE ?? ""),
      name: String(item.SECURITY_NAME_ABBR ?? ""),
      tradeDate: String(item.TRADE_DATE ?? "").split(" ")[0] ?? "",
      closePrice: Number(item.CLOSE_PRICE ?? 0),
      changePercent: Number(item.CHANGE_RATE ?? 0),
      turnoverRate: Number(item.TURNOVER_RATE ?? 0),
      netBuyAmount: Number(item.NET_BUY_AMT ?? 0),
      buyAmount: Number(item.BUY_AMT ?? 0),
      sellAmount: Number(item.SELL_AMT ?? 0),
      reason: String(item.EXPLAIN ?? ""),
      buyInstitutions: Number(item.BUY_TIMES ?? 0),
      sellInstitutions: Number(item.SELL_TIMES ?? 0),
      timestamp: Date.now(),
    }));

    const metrics = tracker.complete("success", {});

    return {
      success: true,
      data: entries,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });
    logger.error(SOURCE_NAME, "Failed to fetch dragon tiger list", { error: errorMessage });

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

// =============================================================================
// SECTOR CAPITAL FLOW API / 板块资金流向API
// =============================================================================

/**
 * Get sector capital flow data
 * 获取板块资金流向数据
 *
 * @param sectorType - Type: "industry" | "concept" | "region"
 * @param limit - Number of sectors to fetch (default: 20)
 */
export async function getSectorCapitalFlow(
  sectorType: "industry" | "concept" | "region" = "industry",
  limit: number = 20,
): Promise<ApiResponse<SectorCapitalFlow[]>> {
  const tracker = createRequestTracker(SOURCE_NAME, `sector-flow/${sectorType}`);

  try {
    // Sector type to fs parameter mapping
    // 板块类型到fs参数映射
    const fsMap: Record<string, string> = {
      industry: "m:90+t:2", // 行业板块
      concept: "m:90+t:3",  // 概念板块
      region: "m:90+t:1",   // 地域板块
    };

    const fs = fsMap[sectorType] ?? fsMap.industry;

    const params = new URLSearchParams({
      pn: "1",
      pz: limit.toString(),
      po: "1",
      np: "1",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
      fltt: "2",
      invt: "2",
      fid: "f62", // Sort by main net inflow / 按主力净流入排序
      fs: fs!,
      fields: "f12,f14,f2,f3,f62,f66,f69,f72,f75,f78,f81,f84,f87,f124,f128,f136,f140,f141",
    });

    const url = `${PUSH2_URL}?${params.toString()}`;
    logger.debug(SOURCE_NAME, "Fetching sector capital flow", { sectorType, limit });

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const dataObj = data.data as { diff: Record<string, unknown>[] } | null;

    if (!dataObj?.diff) {
      throw new Error("Invalid response from Sector Flow API");
    }

    const sectors: SectorCapitalFlow[] = dataObj.diff.map((item) => ({
      sectorCode: String(item.f12 ?? ""),
      sectorName: String(item.f14 ?? ""),
      sectorType: sectorType,
      mainNetInflow: Number(item.f62 ?? 0),
      mainNetInflowPercent: Number(item.f69 ?? 0),
      superLargeInflow: Number(item.f66 ?? 0),
      largeInflow: Number(item.f72 ?? 0),
      mediumInflow: Number(item.f78 ?? 0),
      smallInflow: Number(item.f84 ?? 0),
      changePercent: Number(item.f3 ?? 0) / 100,
      leadingStock: String(item.f140 ?? ""),
      leadingStockChange: Number(item.f136 ?? 0) / 100,
      stockCount: Number(item.f128 ?? 0),
      timestamp: Date.now(),
    }));

    const metrics = tracker.complete("success", {});

    return {
      success: true,
      data: sectors,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });
    logger.error(SOURCE_NAME, "Failed to fetch sector capital flow", { error: errorMessage });

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

// =============================================================================
// MARGIN TRADING API / 融资融券API
// =============================================================================

/**
 * Get margin trading data
 * 获取融资融券数据
 *
 * @param days - Number of days to fetch (default: 30)
 */
export async function getMarginTradingData(
  days: number = 30,
): Promise<ApiResponse<MarginTradingData[]>> {
  const tracker = createRequestTracker(SOURCE_NAME, "margin-trading");

  try {
    const startDate = getDateDaysAgo(days);
    const callback = `jQuery${Date.now()}_${Math.random().toString().slice(2, 10)}`;

    const params = new URLSearchParams({
      callback,
      sortColumns: "TRADE_DATE",
      sortTypes: "-1",
      pageSize: days.toString(),
      pageNumber: "1",
      reportName: "RPTA_RZRQ_LSHJ",
      columns: "TRADE_DATE,RZYE,RZMRE,RZCHE,RQYE,RQYLJE,RQMCL,RQCHL,RZRQYE,RZJME",
      source: "WEB",
      client: "WEB",
      filter: `(TRADE_DATE>='${startDate}')`,
    });

    const url = `${DATACENTER_URL}?${params.toString()}`;
    logger.debug(SOURCE_NAME, "Fetching margin trading data", { startDate });

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const data = parseJsonpResponse(text);

    if (!data.success || !data.result) {
      throw new Error("Invalid response from Margin Trading API");
    }

    const result = data.result as { data: Record<string, unknown>[] };
    const entries: MarginTradingData[] = (result.data || []).map((item) => ({
      tradeDate: String(item.TRADE_DATE ?? "").split(" ")[0] ?? "",
      market: "total" as const,
      marginBalance: Number(item.RZYE ?? 0),
      marginBuy: Number(item.RZMRE ?? 0),
      marginRepay: Number(item.RZCHE ?? 0),
      shortBalance: Number(item.RQYE ?? 0),
      shortBalanceAmount: Number(item.RQYLJE ?? 0),
      shortSell: Number(item.RQMCL ?? 0),
      shortRepay: Number(item.RQCHL ?? 0),
      totalBalance: Number(item.RZRQYE ?? 0),
      netBuy: Number(item.RZJME ?? 0),
      timestamp: Date.now(),
    }));

    const metrics = tracker.complete("success", {});

    return {
      success: true,
      data: entries,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });
    logger.error(SOURCE_NAME, "Failed to fetch margin trading data", { error: errorMessage });

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

// =============================================================================
// LARGE ORDER FLOW API / 大单流向API
// =============================================================================

/**
 * Get large order flow data (market-wide top stocks)
 * 获取大单流向数据（全市场TOP股票）
 *
 * @param limit - Number of stocks to fetch (default: 50)
 * @param sortBy - Sort field: "main" | "super" | "large"
 */
export async function getLargeOrderFlow(
  limit: number = 50,
  sortBy: "main" | "super" | "large" = "main",
): Promise<ApiResponse<LargeOrderFlow[]>> {
  const tracker = createRequestTracker(SOURCE_NAME, "large-order-flow");

  try {
    // Sort field mapping
    // 排序字段映射
    const sortFieldMap: Record<string, string> = {
      main: "f62",   // 主力净流入
      super: "f66",  // 超大单净流入
      large: "f72",  // 大单净流入
    };

    const fid = sortFieldMap[sortBy] ?? sortFieldMap.main;

    const params = new URLSearchParams({
      pn: "1",
      pz: limit.toString(),
      po: "1",
      np: "1",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
      fltt: "2",
      invt: "2",
      fid: fid!,
      fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048", // A股市场
      fields: "f2,f3,f12,f14,f62,f66,f69,f72,f184",
    });

    const url = `${PUSH2_URL}?${params.toString()}`;
    logger.debug(SOURCE_NAME, "Fetching large order flow", { limit, sortBy });

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const dataObj = data.data as { diff: Record<string, unknown>[] } | null;

    if (!dataObj?.diff) {
      throw new Error("Invalid response from Large Order Flow API");
    }

    const orders: LargeOrderFlow[] = dataObj.diff.map((item) => {
      const mainNetInflow = Number(item.f62 ?? 0);
      return {
        symbol: String(item.f12 ?? ""),
        name: String(item.f14 ?? ""),
        price: Number(item.f2 ?? 0) / 100,
        changePercent: Number(item.f3 ?? 0) / 100,
        mainNetInflow: mainNetInflow,
        mainNetInflowPercent: Number(item.f69 ?? 0),
        superLargeNetInflow: Number(item.f66 ?? 0),
        largeNetInflow: Number(item.f72 ?? 0),
        orderType: mainNetInflow >= 0 ? "buy" : "sell",
        timestamp: Date.now(),
      };
    });

    const metrics = tracker.complete("success", {});

    return {
      success: true,
      data: orders,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });
    logger.error(SOURCE_NAME, "Failed to fetch large order flow", { error: errorMessage });

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

// =============================================================================
// MARKET SENTIMENT API / 市场情绪API
// =============================================================================

/**
 * Get market sentiment data
 * 获取市场情绪数据
 *
 * Aggregates market-wide statistics for sentiment analysis
 * 聚合全市场统计数据用于情绪分析
 */
export async function getMarketSentiment(): Promise<ApiResponse<MarketSentiment>> {
  const tracker = createRequestTracker(SOURCE_NAME, "market-sentiment");

  try {
    // Fetch market statistics from push2 API
    // 从push2接口获取市场统计
    const params = new URLSearchParams({
      pn: "1",
      pz: "5000",
      po: "1",
      np: "1",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
      fltt: "2",
      invt: "2",
      fid: "f3",
      fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23", // A股市场
      fields: "f3,f6",
    });

    const url = `${PUSH2_URL}?${params.toString()}`;
    logger.debug(SOURCE_NAME, "Fetching market sentiment");

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const dataObj = data.data as { diff: Record<string, unknown>[], total: number } | null;

    if (!dataObj?.diff) {
      throw new Error("Invalid response from Market Sentiment API");
    }

    // Calculate statistics
    // 计算统计数据
    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;
    let limitUpCount = 0;
    let limitDownCount = 0;
    let totalChange = 0;
    let totalAmount = 0;

    for (const item of dataObj.diff) {
      const change = Number(item.f3 ?? 0) / 100;
      const amount = Number(item.f6 ?? 0);

      totalChange += change;
      totalAmount += amount;

      if (change > 9.9) {
        limitUpCount++;
        upCount++;
      } else if (change < -9.9) {
        limitDownCount++;
        downCount++;
      } else if (change > 0) {
        upCount++;
      } else if (change < 0) {
        downCount++;
      } else {
        flatCount++;
      }
    }

    const totalStocks = dataObj.diff.length;
    const avgChange = totalStocks > 0 ? totalChange / totalStocks : 0;
    const upDownRatio = downCount > 0 ? upCount / downCount : upCount;

    // Calculate sentiment score (0-100)
    // 计算情绪分数 (0-100)
    // Based on: up/down ratio, limit up/down, average change
    const ratioScore = Math.min(upDownRatio / 3, 1) * 40; // Max 40 points
    const limitScore = Math.min((limitUpCount - limitDownCount) / 50, 1) * 30; // Max 30 points
    const changeScore = Math.min((avgChange + 5) / 10, 1) * 30; // Max 30 points
    const sentimentScore = Math.max(0, Math.min(100, ratioScore + limitScore + changeScore + 50));

    const sentiment: MarketSentiment = {
      date: formatDate(),
      upCount,
      downCount,
      flatCount,
      limitUpCount,
      limitDownCount,
      upDownRatio,
      avgChangePercent: avgChange,
      totalAmount,
      newHighCount: 0, // Requires additional API call
      newLowCount: 0,  // Requires additional API call
      sentimentScore,
      timestamp: Date.now(),
    };

    const metrics = tracker.complete("success", {});

    return {
      success: true,
      data: sentiment,
      source: SOURCE_NAME,
      cached: false,
      timestamp: Date.now(),
      latency: metrics.latency,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    tracker.complete("error", { errorMessage });
    logger.error(SOURCE_NAME, "Failed to fetch market sentiment", { error: errorMessage });

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
