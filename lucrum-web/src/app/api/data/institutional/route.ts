/**
 * Institutional Data API Routes
 * 机构数据API路由
 *
 * Provides institutional-grade market data:
 * - Dragon Tiger List (龙虎榜)
 * - Sector Capital Flow (板块资金流向)
 * - Margin Trading (融资融券)
 * - Large Order Flow (大单流向)
 * - Market Sentiment (市场情绪)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDragonTigerList,
  getSectorCapitalFlow,
  getMarginTradingData,
  getLargeOrderFlow,
  getMarketSentiment,
} from "@/lib/data-service/sources/eastmoney-institutional";

export const dynamic = "force-dynamic";

/**
 * GET /api/data/institutional
 * Query params:
 * - type: "dragon-tiger" | "sector-flow" | "margin" | "large-orders" | "sentiment"
 * - sectorType: "industry" | "concept" | "region" (for sector-flow)
 * - limit: number (for dragon-tiger, sector-flow, large-orders)
 * - days: number (for dragon-tiger, margin)
 * - sortBy: "main" | "super" | "large" (for large-orders)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") ?? "dragon-tiger";
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const days = parseInt(searchParams.get("days") ?? "5", 10);
    const sectorType = (searchParams.get("sectorType") ?? "industry") as "industry" | "concept" | "region";
    const sortBy = (searchParams.get("sortBy") ?? "main") as "main" | "super" | "large";

    let result;

    switch (type) {
      case "dragon-tiger":
        result = await getDragonTigerList(days, limit);
        break;

      case "sector-flow":
        result = await getSectorCapitalFlow(sectorType, limit);
        break;

      case "margin":
        result = await getMarginTradingData(days);
        break;

      case "large-orders":
        result = await getLargeOrderFlow(limit, sortBy);
        break;

      case "sentiment":
        result = await getMarketSentiment();
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown data type: ${type}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to fetch data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      source: result.source,
      cached: result.cached,
      latency: result.latency,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("[Institutional API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
