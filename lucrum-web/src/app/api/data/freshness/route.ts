/**
 * Data Freshness API
 *
 * GET /api/data/freshness?symbol=600519
 *
 * Returns data freshness status for a stock symbol, indicating
 * whether the K-line data in the database is up-to-date relative
 * to the last completed trading day.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkDataFreshness } from "@/lib/cron/data-freshness";

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Maximum symbol length for input validation
 */
const MAX_SYMBOL_LENGTH = 20;

/**
 * Pattern for valid stock symbols
 */
const SYMBOL_PATTERN = /^[A-Za-z0-9.]+$/;

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    // Validate symbol
    if (!symbol || symbol.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: symbol",
          message: "Please provide a stock symbol, e.g., ?symbol=600519",
        },
        { status: 400 },
      );
    }

    if (
      symbol.length > MAX_SYMBOL_LENGTH ||
      !SYMBOL_PATTERN.test(symbol)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid symbol format",
          message: `Symbol must be alphanumeric, max ${MAX_SYMBOL_LENGTH} chars`,
        },
        { status: 400 },
      );
    }

    // Remove exchange suffix for DB lookup
    const cleanSymbol = symbol.replace(/\.(SH|SZ|BJ|sh|sz|bj)$/i, "");

    const freshness = await checkDataFreshness(cleanSymbol);

    return NextResponse.json({
      success: true,
      data: {
        symbol: cleanSymbol,
        isFresh: freshness.isFresh,
        latestDbDate: freshness.latestDbDate,
        lastTradingDay: freshness.lastTradingDay,
        staleDays: freshness.staleDays,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Data freshness check error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check data freshness",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
