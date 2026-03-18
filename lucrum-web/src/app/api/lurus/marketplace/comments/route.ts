/**
 * Strategy Comments API
 *
 * GET  /api/lurus/marketplace/comments?strategy_id=123
 * POST /api/lurus/marketplace/comments
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { strategyComments } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const strategyId = request.nextUrl.searchParams.get("strategy_id");
  if (!strategyId) {
    return NextResponse.json({ error: "strategy_id required" }, { status: 400 });
  }

  const comments = await db
    .select()
    .from(strategyComments)
    .where(
      and(
        eq(strategyComments.marketplaceStrategyId, parseInt(strategyId)),
        eq(strategyComments.deleted, false)
      )
    )
    .orderBy(desc(strategyComments.createdAt))
    .limit(100);

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { strategyId, content, parentId } = body as {
    strategyId: number;
    content: string;
    parentId?: number;
  };

  if (!strategyId || !content?.trim()) {
    return NextResponse.json(
      { error: "strategyId and content required" },
      { status: 400 }
    );
  }

  if (content.length > 1000) {
    return NextResponse.json(
      { error: "comment too long (max 1000 chars)" },
      { status: 400 }
    );
  }

  const [comment] = await db
    .insert(strategyComments)
    .values({
      marketplaceStrategyId: strategyId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      content: content.trim(),
      parentId: parentId ?? null,
    })
    .returning();

  return NextResponse.json({ comment });
}
