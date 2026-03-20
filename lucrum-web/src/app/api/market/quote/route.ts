/**
 * Stock Quote API Route
 *
 * GET /api/market/quote?symbol=600519
 * GET /api/market/quote?symbols=600519,000001,000002 (batch)
 */

import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getBatchQuotes } from "@/lib/data-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const symbols = searchParams.get("symbols");

  // Validate input
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

      const results = await getBatchQuotes(symbolList);
      return NextResponse.json({
        success: true,
        data: results,
        timestamp: Date.now(),
      });
    }

    // Single request
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
