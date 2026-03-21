/**
 * Backtest History API
 *
 * GET /api/history/backtests - Fetch backtest history for current user
 *
 * Refactored to use IBacktestRepository for data access.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBacktestRepository } from "@/lib/repositories";
import { z } from "zod";

// ============================================================================
// Request Validation Schema
// ============================================================================

const QuerySchema = z.object({
  symbol: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(["createdAt", "totalReturn", "sharpeRatio"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/history/backtests
 * Fetch backtest history with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please log in first" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      symbol: searchParams.get("symbol") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: searchParams.get("limit") || "20",
      offset: searchParams.get("offset") || "0",
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const validationResult = QuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const query = validationResult.data;
    const backtestRepo = getBacktestRepository();

    // Fetch paginated backtest history via repository
    const paginatedResult = await backtestRepo.findByUser(
      userId,
      {
        symbol: query.symbol,
        startDate: query.startDate,
        endDate: query.endDate,
      },
      {
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );

    // Get unique symbols for filter dropdown
    const symbolEntries = await backtestRepo.getDistinctSymbols(userId);

    // Get aggregate statistics
    const stats = await backtestRepo.getStats(userId);

    return NextResponse.json({
      success: true,
      data: {
        backtests: paginatedResult.items.map((b) => ({
          id: b.id,
          symbol: b.symbol,
          stockName: b.stockName,
          startDate: b.startDate,
          endDate: b.endDate,
          timeframe: b.timeframe,
          dataSource: b.dataSource,
          dataCoverage: b.dataCoverage,
          metrics: {
            totalReturn: b.totalReturn,
            sharpeRatio: b.sharpeRatio,
            maxDrawdown: b.maxDrawdown,
            winRate: b.winRate,
          },
          executionTime: b.executionTime,
          notes: b.notes,
          createdAt: b.createdAt,
          strategy: b.strategyId
            ? {
                id: b.strategyId,
                name: b.strategyName,
                type: b.strategyType,
              }
            : null,
        })),
        pagination: {
          total: paginatedResult.total,
          limit: paginatedResult.limit,
          offset: paginatedResult.offset,
          hasMore: paginatedResult.hasMore,
        },
        filters: {
          symbols: symbolEntries.map((s) => ({
            symbol: s.symbol,
            name: s.stockName,
          })),
        },
        stats: {
          avgReturn: stats.avgReturn ?? null,
          avgSharpe: stats.avgSharpe ?? null,
          avgWinRate: stats.avgWinRate ?? null,
          bestReturn: stats.bestReturn ?? null,
          worstReturn: stats.worstReturn ?? null,
        },
      },
    });
  } catch (error) {
    console.error("[History API] Failed to fetch backtests:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
