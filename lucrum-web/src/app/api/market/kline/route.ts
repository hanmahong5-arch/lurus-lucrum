/**
 * K-Line Data API Route
 * K线数据API路由
 *
 * GET /api/market/kline?symbol=600519&timeframe=1d&limit=200
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getKLineData,
  generateMockKLineData,
  KLineTimeFrame,
} from "@/lib/data-service";
import { cacheGet, cacheSet } from "@/lib/redis";

// =============================================================================
// Constants
// =============================================================================

// Environment flag for using mock data
const USE_MOCK = process.env.USE_MOCK_DATA === "true";

// Valid timeframes
const VALID_TIMEFRAMES: KLineTimeFrame[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d",
  "1w",
  "1M",
];

// TTL in seconds for different timeframes
const TTL_MAP: Record<KLineTimeFrame, number> = {
  "1m": 60, // 1 minute
  "5m": 300, // 5 minutes
  "15m": 900, // 15 minutes
  "30m": 1800, // 30 minutes
  "60m": 3600, // 1 hour
  "1d": 3600, // 1 hour (daily data doesn't change frequently)
  "1w": 86400, // 24 hours
  "1M": 86400, // 24 hours
};

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const timeframe = (searchParams.get("timeframe") || "1d") as KLineTimeFrame;
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  // Validate input
  if (!symbol) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required parameter: symbol",
      },
      { status: 400 }
    );
  }

  if (!VALID_TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid timeframe. Valid options: ${VALID_TIMEFRAMES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (isNaN(limit) || limit < 1 || limit > 1000) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid limit. Must be between 1 and 1000",
      },
      { status: 400 }
    );
  }

  try {
    if (USE_MOCK) {
      // Generate mock data with appropriate starting price
      const mockData = generateMockKLineData(symbol, limit);
      return NextResponse.json({
        success: true,
        data: mockData,
        source: "mock",
        cached: false,
        timestamp: Date.now(),
        latency: 0,
      });
    }

    // Try Redis cache first
    const cacheKey = `kline:${symbol}:${timeframe}:${limit}`;
    const cached = await cacheGet<{
      success: boolean;
      data: unknown[];
      source: string;
      timestamp: number;
      latency: number;
    }>(cacheKey);

    if (cached) {
      console.log("[KLine API] Cache hit:", cacheKey);
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Fetch from data service
    const result = await getKLineData(symbol, timeframe, limit);

    // Cache the successful result
    if (result.success && result.data && result.data.length > 0) {
      const ttl = TTL_MAP[timeframe] || 300; // Default 5 minutes
      await cacheSet(cacheKey, result, ttl);
    }

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (err) {
    console.error("K-line API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
