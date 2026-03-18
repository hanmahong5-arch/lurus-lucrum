/**
 * Stock Quote API Route
 * 股票行情API路由
 *
 * GET /api/market/quote?symbol=600519
 * GET /api/market/quote?symbols=600519,000001,000002 (batch)
 */

import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getBatchQuotes, generateMockQuote } from "@/lib/data-service";

// Environment flag for using mock data
// 使用模拟数据的环境标志
const USE_MOCK = process.env.USE_MOCK_DATA === "true";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const symbols = searchParams.get("symbols");

  // Validate input
  // 验证输入
  if (!symbol && !symbols) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required parameter: symbol or symbols",
      },
      { status: 400 }
    );
  }

  try {
    // Batch request
    // 批量请求
    if (symbols) {
      const symbolList = symbols.split(",").map((s) => s.trim()).filter(Boolean);

      if (symbolList.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid symbols parameter",
          },
          { status: 400 }
        );
      }

      if (symbolList.length > 50) {
        return NextResponse.json(
          {
            success: false,
            error: "Maximum 50 symbols allowed per request",
          },
          { status: 400 }
        );
      }

      if (USE_MOCK) {
        const mockData: Record<string, ReturnType<typeof generateMockQuote>> = {};
        symbolList.forEach((s) => {
          mockData[s] = generateMockQuote(s, `Stock ${s}`);
        });
        return NextResponse.json({
          success: true,
          data: mockData,
          source: "mock",
          timestamp: Date.now(),
        });
      }

      const results = await getBatchQuotes(symbolList);
      return NextResponse.json({
        success: true,
        data: results,
        timestamp: Date.now(),
      });
    }

    // Single request
    // 单个请求
    if (USE_MOCK) {
      const mockQuote = generateMockQuote(symbol!, `Stock ${symbol}`);
      return NextResponse.json({
        success: true,
        data: mockQuote,
        source: "mock",
        cached: false,
        timestamp: Date.now(),
        latency: 0,
      });
    }

    const result = await getStockQuote(symbol!);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Quote API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
