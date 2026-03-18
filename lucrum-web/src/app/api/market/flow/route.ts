/**
 * Capital Flow API Route
 * 资金流向API路由
 *
 * GET /api/market/flow?symbol=600519 - Stock capital flow
 * GET /api/market/flow?type=northbound - North-bound capital flow
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCapitalFlow,
  getNorthBoundFlow,
  CapitalFlow,
  NorthBoundFlow,
} from "@/lib/data-service";

// Environment flag for using mock data
// 使用模拟数据的环境标志
const USE_MOCK = process.env.USE_MOCK_DATA === "true";

/**
 * Generate mock capital flow data
 * 生成模拟资金流向数据
 */
function generateMockCapitalFlow(symbol: string): CapitalFlow {
  const mainNet = (Math.random() - 0.5) * 100000000;
  return {
    symbol,
    name: `Stock ${symbol}`,
    mainNetInflow: mainNet,
    superLargeInflow: mainNet * 0.4,
    largeInflow: mainNet * 0.3,
    mediumInflow: mainNet * 0.2,
    smallInflow: mainNet * 0.1,
    timestamp: Date.now(),
  };
}

/**
 * Generate mock north-bound flow data
 * 生成模拟北向资金数据
 */
function generateMockNorthBoundFlow(): NorthBoundFlow {
  const shConnect = (Math.random() - 0.3) * 5000000000;
  const szConnect = (Math.random() - 0.3) * 3000000000;
  return {
    date: new Date().toISOString().split("T")[0] ?? "",
    shConnect,
    szConnect,
    total: shConnect + szConnect,
    shQuota: 52000000000 - Math.abs(shConnect),
    szQuota: 52000000000 - Math.abs(szConnect),
    timestamp: Date.now(),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const type = searchParams.get("type");

  try {
    // North-bound flow request
    // 北向资金请求
    if (type === "northbound") {
      if (USE_MOCK) {
        const mockFlow = generateMockNorthBoundFlow();
        return NextResponse.json({
          success: true,
          data: mockFlow,
          source: "mock",
          cached: false,
          timestamp: Date.now(),
          latency: 0,
        });
      }

      const result = await getNorthBoundFlow();
      return NextResponse.json(result);
    }

    // Stock capital flow request
    // 股票资金流向请求
    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: symbol or type=northbound",
        },
        { status: 400 },
      );
    }

    if (USE_MOCK) {
      const mockFlow = generateMockCapitalFlow(symbol);
      return NextResponse.json({
        success: true,
        data: mockFlow,
        source: "mock",
        cached: false,
        timestamp: Date.now(),
        latency: 0,
      });
    }

    const result = await getCapitalFlow(symbol);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Flow API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
