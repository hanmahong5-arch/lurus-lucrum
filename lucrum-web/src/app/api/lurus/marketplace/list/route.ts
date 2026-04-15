/**
 * Marketplace Strategy List API
 *
 * GET /api/lurus/marketplace/list
 * Returns active marketplace strategies with optional filtering.
 *
 * Query params:
 *   sort: "popular" | "newest" | "cheapest" (default: popular)
 *   price_type: "free" | "subscription" | "per_run" (optional)
 *   limit: number (default: 20, max: 50)
 *   offset: number (default: 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketplaceStrategies, strategyHistory } from "@/lib/db/schema";
import { eq, desc, asc, and, sql } from "drizzle-orm";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "popular";
    const priceType = searchParams.get("price_type");
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    // Build conditions
    const conditions = [eq(marketplaceStrategies.status, "active")];
    if (priceType && ["free", "subscription", "per_run"].includes(priceType)) {
      conditions.push(eq(marketplaceStrategies.priceType, priceType));
    }

    // Build sort
    const orderBy =
      sort === "newest"
        ? desc(marketplaceStrategies.publishedAt)
        : sort === "cheapest"
        ? asc(marketplaceStrategies.priceMonthly)
        : desc(marketplaceStrategies.totalRuns);

    const rows = await db
      .select({
        id: marketplaceStrategies.id,
        title: marketplaceStrategies.title,
        description: marketplaceStrategies.description,
        priceType: marketplaceStrategies.priceType,
        pricePerRun: marketplaceStrategies.pricePerRun,
        priceMonthly: marketplaceStrategies.priceMonthly,
        gradeScore: marketplaceStrategies.gradeScore,
        totalRuns: marketplaceStrategies.totalRuns,
        totalSubscribers: marketplaceStrategies.totalSubscribers,
        publishedAt: marketplaceStrategies.publishedAt,
        authorUserId: marketplaceStrategies.authorUserId,
      })
      .from(marketplaceStrategies)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceStrategies)
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    return NextResponse.json({
      strategies: rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[marketplace/list] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch marketplace strategies" },
      { status: 500 },
    );
  }
}
