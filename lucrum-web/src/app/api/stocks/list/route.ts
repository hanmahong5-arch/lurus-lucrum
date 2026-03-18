/**
 * Stocks List API
 * 股票列表API
 *
 * GET /api/stocks/list
 *
 * Returns paginated list of stocks with filtering and sorting
 * 返回带分页、筛选和排序的股票列表
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllStocks, countStocks } from "@/lib/db/queries";
import { cacheGet, cacheSet } from "@/lib/redis";
import { createHash } from "crypto";

// =============================================================================
// Constants
// =============================================================================

const CACHE_TTL = 3600; // 1 hour

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "100"),
      500
    );
    const search = searchParams.get("search") || undefined;
    const excludeST = searchParams.get("excludeST") === "true";
    const minMarketCap = searchParams.get("minMarketCap")
      ? parseFloat(searchParams.get("minMarketCap")!)
      : undefined;
    const status = searchParams.get("status") || "active";
    const sortBy =
      (searchParams.get("sortBy") as "symbol" | "name" | "marketCap") ||
      "symbol";
    const sortOrder =
      (searchParams.get("sortOrder") as "asc" | "desc") || "asc";

    // Validate page and pageSize
    if (page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 500) {
      return NextResponse.json(
        { error: "Invalid page size (must be 1-500)" },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Generate cache key based on query parameters
    const cacheKey = `stocks:list:${createHash("md5")
      .update(
        JSON.stringify({
          page,
          pageSize,
          search,
          excludeST,
          minMarketCap,
          status,
          sortBy,
          sortOrder,
        })
      )
      .digest("hex")}`;

    // Try to get from Redis cache
    const cached = await cacheGet<{
      success: boolean;
      data: unknown[];
      pagination: unknown;
    }>(cacheKey);

    if (cached) {
      console.log("[API] Stock list cache hit:", cacheKey);
      return NextResponse.json({
        ...cached,
        cacheHit: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Get stocks from database
    const stocks = await getAllStocks({
      excludeST,
      status,
      minMarketCap,
      limit: pageSize,
      offset,
      orderBy: sortBy,
      orderDirection: sortOrder,
    });

    // Get total count
    const totalCount = await countStocks({
      excludeST,
      status,
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    // Prepare response data
    const responseData = {
      success: true,
      data: stocks,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      cacheHit: false,
    };

    // Cache the result (TTL: 1 hour)
    await cacheSet(cacheKey, responseData, CACHE_TTL);

    // Return response
    return NextResponse.json({
      ...responseData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] /api/stocks/list error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch stocks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS Handler (CORS)
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
