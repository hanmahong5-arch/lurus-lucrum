/**
 * Market Data Tools for LangChain
 * LangChain 市场数据工具
 *
 * Provides tools for fetching market data, K-lines, and stock information.
 * These tools can be used by LangGraph agents.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKLineData } from "@/lib/data-service";
import { getKLineFromDatabase, checkDataAvailability } from "@/lib/backtest/db-kline-provider";
import type { KLineData, MarketData } from "../graphs/types";

// ============================================================================
// K-Line Data Tools
// ============================================================================

/**
 * Fetch K-line data from database with fallback to API
 * 从数据库获取K线数据，降级到API
 */
export const fetchKLinesTool = tool(
  async ({ symbol, timeframe, limit, startDate, endDate }) => {
    console.log(`[fetchKLinesTool] Fetching ${symbol} ${timeframe} data...`);

    let klines: KLineData[] = [];
    let source = "mock";

    // Priority 1: Database (only for daily)
    if (timeframe === "1d") {
      try {
        const dbResult = await getKLineFromDatabase(
          symbol,
          startDate || getDefaultStartDate(),
          endDate || new Date().toISOString().split("T")[0] || "",
          limit
        );

        if (dbResult.success && dbResult.data.length > 0) {
          klines = dbResult.data.map((k) => ({
            time: typeof k.time === "number" ? k.time : Math.floor(new Date(String(k.time)).getTime() / 1000),
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
          }));
          source = "database";
          console.log(`[fetchKLinesTool] Database: ${klines.length} bars`);
        }
      } catch (err) {
        console.warn(`[fetchKLinesTool] Database error:`, err);
      }
    }

    // Priority 2: API (EastMoney/Sina)
    if (klines.length === 0) {
      try {
        const apiResult = await getKLineData(symbol, timeframe, limit);
        if (apiResult.success && apiResult.data && apiResult.data.length > 0) {
          klines = apiResult.data.map((k) => ({
            time: typeof k.time === "number" ? k.time : Math.floor(new Date(String(k.time)).getTime() / 1000),
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
          }));
          source = apiResult.source || "eastmoney";
          console.log(`[fetchKLinesTool] API (${source}): ${klines.length} bars`);
        }
      } catch (err) {
        console.warn(`[fetchKLinesTool] API error:`, err);
      }
    }

    return {
      success: klines.length > 0,
      data: klines,
      source,
      count: klines.length,
    };
  },
  {
    name: "fetch_klines",
    description: "Fetch K-line (candlestick) data for a stock symbol. Returns OHLCV data.",
    schema: z.object({
      symbol: z.string().describe("Stock symbol, e.g., '000001.SZ' or '600519.SH'"),
      timeframe: z.enum(["1d", "1w", "60m", "30m", "15m", "5m", "1m"]).default("1d").describe("K-line timeframe"),
      limit: z.number().min(1).max(1000).default(200).describe("Number of bars to fetch"),
      startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
    }),
  }
);

/**
 * Check data availability for a symbol
 * 检查股票数据可用性
 */
export const checkDataAvailabilityTool = tool(
  async ({ symbol, startDate, endDate }) => {
    try {
      const result = await checkDataAvailability(symbol, startDate, endDate);
      return {
        available: result.available,
        dateRange: result.dateRange,
        dataCount: result.dataCount,
        stockId: result.stockId,
        stockName: result.stockName,
        coverage: result.coverage,
        message: result.message,
      };
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
  {
    name: "check_data_availability",
    description: "Check if K-line data is available in the database for a given stock symbol and date range.",
    schema: z.object({
      symbol: z.string().describe("Stock symbol to check"),
      startDate: z.string().describe("Start date in YYYY-MM-DD format"),
      endDate: z.string().describe("End date in YYYY-MM-DD format"),
    }),
  }
);

// ============================================================================
// Market Quote Tools
// ============================================================================

/**
 * Get real-time market quote
 * 获取实时行情
 */
export const getMarketQuoteTool = tool(
  async ({ symbol }) => {
    // This would integrate with real-time quote API
    // For now, return a mock structure
    console.log(`[getMarketQuoteTool] Getting quote for ${symbol}...`);

    try {
      // Try to fetch from market quote API
      const response = await fetch(`/api/market/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return {
            success: true,
            data: data.data as MarketData,
          };
        }
      }
    } catch (err) {
      console.warn(`[getMarketQuoteTool] Quote fetch error:`, err);
    }

    // Return empty if unavailable
    return {
      success: false,
      error: "Quote data unavailable",
    };
  },
  {
    name: "get_market_quote",
    description: "Get real-time market quote for a stock including price, change, volume, etc.",
    schema: z.object({
      symbol: z.string().describe("Stock symbol to get quote for"),
    }),
  }
);

/**
 * Get market indices (SSE, SZSE, etc.)
 * 获取市场指数
 */
export const getMarketIndicesTool = tool(
  async ({ indices }) => {
    console.log(`[getMarketIndicesTool] Getting indices:`, indices);

    try {
      const response = await fetch(`/api/market/indices?symbols=${indices.join(",")}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return {
            success: true,
            data: data.data,
          };
        }
      }
    } catch (err) {
      console.warn(`[getMarketIndicesTool] Indices fetch error:`, err);
    }

    return {
      success: false,
      error: "Indices data unavailable",
    };
  },
  {
    name: "get_market_indices",
    description: "Get market indices like Shanghai Composite, Shenzhen Component, ChiNext, etc.",
    schema: z.object({
      indices: z.array(z.string()).default(["000001.SH", "399001.SZ", "399006.SZ"]).describe("Index symbols to fetch"),
    }),
  }
);

// ============================================================================
// Stock Information Tools
// ============================================================================

/**
 * Search for stocks by name or code
 * 搜索股票
 */
export const searchStocksTool = tool(
  async ({ query, limit }) => {
    console.log(`[searchStocksTool] Searching for:`, query);

    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return {
            success: true,
            results: data.data,
            count: data.data?.length || 0,
          };
        }
      }
    } catch (err) {
      console.warn(`[searchStocksTool] Search error:`, err);
    }

    return {
      success: false,
      results: [],
      count: 0,
    };
  },
  {
    name: "search_stocks",
    description: "Search for stocks by name or symbol code. Returns matching stocks with basic info.",
    schema: z.object({
      query: z.string().describe("Search query - stock name or code"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
    }),
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0] || "";
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All market data tools
 * 所有市场数据工具
 */
export const marketTools = [
  fetchKLinesTool,
  checkDataAvailabilityTool,
  getMarketQuoteTool,
  getMarketIndicesTool,
  searchStocksTool,
];

export default marketTools;
