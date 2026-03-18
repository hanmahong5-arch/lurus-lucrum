/**
 * Backtest History API
 * 回测历史 API
 *
 * GET /api/history/backtests - Fetch backtest history for current user
 * 获取当前用户的回测历史
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { backtestHistory, strategyHistory } from "@/lib/db/schema";
import { eq, desc, and, like, gte, lte, sql } from "drizzle-orm";
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
        { error: "Unauthorized", message: "请先登录" },
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

    // Build where conditions
    const conditions = [eq(backtestHistory.userId, userId)];

    if (query.symbol) {
      conditions.push(like(backtestHistory.symbol, `%${query.symbol}%`));
    }

    if (query.startDate) {
      conditions.push(gte(backtestHistory.createdAt, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(backtestHistory.createdAt, new Date(query.endDate)));
    }

    // Fetch backtest history with strategy info
    const backtests = await db
      .select({
        id: backtestHistory.id,
        symbol: backtestHistory.symbol,
        stockName: backtestHistory.stockName,
        startDate: backtestHistory.startDate,
        endDate: backtestHistory.endDate,
        timeframe: backtestHistory.timeframe,
        dataSource: backtestHistory.dataSource,
        dataCoverage: backtestHistory.dataCoverage,
        totalReturn: backtestHistory.totalReturn,
        sharpeRatio: backtestHistory.sharpeRatio,
        maxDrawdown: backtestHistory.maxDrawdown,
        winRate: backtestHistory.winRate,
        executionTime: backtestHistory.executionTime,
        notes: backtestHistory.notes,
        createdAt: backtestHistory.createdAt,
        // Strategy info
        strategyId: strategyHistory.id,
        strategyName: strategyHistory.strategyName,
        strategyType: strategyHistory.strategyType,
      })
      .from(backtestHistory)
      .leftJoin(strategyHistory, eq(backtestHistory.strategyHistoryId, strategyHistory.id))
      .where(and(...conditions))
      .orderBy(
        query.sortOrder === "desc"
          ? desc(backtestHistory[query.sortBy === "createdAt" ? "createdAt" : query.sortBy === "totalReturn" ? "totalReturn" : "sharpeRatio"])
          : backtestHistory[query.sortBy === "createdAt" ? "createdAt" : query.sortBy === "totalReturn" ? "totalReturn" : "sharpeRatio"]
      )
      .limit(query.limit)
      .offset(query.offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(backtestHistory)
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    // Get unique symbols for filter options
    const symbolsResult = await db
      .selectDistinct({ symbol: backtestHistory.symbol, stockName: backtestHistory.stockName })
      .from(backtestHistory)
      .where(eq(backtestHistory.userId, userId))
      .limit(50);

    // Calculate aggregate stats
    const statsResult = await db
      .select({
        avgReturn: sql<number>`avg(${backtestHistory.totalReturn})`,
        avgSharpe: sql<number>`avg(${backtestHistory.sharpeRatio})`,
        avgWinRate: sql<number>`avg(${backtestHistory.winRate})`,
        bestReturn: sql<number>`max(${backtestHistory.totalReturn})`,
        worstReturn: sql<number>`min(${backtestHistory.totalReturn})`,
      })
      .from(backtestHistory)
      .where(eq(backtestHistory.userId, userId));

    // Define default stats with explicit types
    // 定义默认统计数据并使用显式类型
    const defaultStats = {
      avgReturn: null as number | null,
      avgSharpe: null as number | null,
      avgWinRate: null as number | null,
      bestReturn: null as number | null,
      worstReturn: null as number | null,
    };
    const stats = statsResult[0] ?? defaultStats;

    return NextResponse.json({
      success: true,
      data: {
        backtests: backtests.map((b) => ({
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
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + backtests.length < total,
        },
        filters: {
          symbols: symbolsResult.map((s) => ({
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
