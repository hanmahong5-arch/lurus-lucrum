/**
 * Strategy Like Toggle API
 *
 * POST /api/lurus/marketplace/like
 * Body: { strategyId: number }
 *
 * Toggles like: inserts if not liked, deletes if already liked.
 * Returns { liked: boolean, totalLikes: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { strategyLikes } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { strategyId } = body as { strategyId: number };

  if (!strategyId) {
    return NextResponse.json(
      { error: "strategyId required" },
      { status: 400 }
    );
  }

  // Check if already liked
  const existing = await db
    .select()
    .from(strategyLikes)
    .where(
      and(
        eq(strategyLikes.marketplaceStrategyId, strategyId),
        eq(strategyLikes.userId, session.user.id)
      )
    )
    .limit(1);

  let liked: boolean;

  if (existing.length > 0) {
    // Unlike
    await db
      .delete(strategyLikes)
      .where(
        and(
          eq(strategyLikes.marketplaceStrategyId, strategyId),
          eq(strategyLikes.userId, session.user.id)
        )
      );
    liked = false;
  } else {
    // Like
    await db.insert(strategyLikes).values({
      marketplaceStrategyId: strategyId,
      userId: session.user.id,
    });
    liked = true;
  }

  // Get total likes
  const [result] = await db
    .select({ total: count() })
    .from(strategyLikes)
    .where(eq(strategyLikes.marketplaceStrategyId, strategyId));

  return NextResponse.json({
    liked,
    totalLikes: result?.total ?? 0,
  });
}
