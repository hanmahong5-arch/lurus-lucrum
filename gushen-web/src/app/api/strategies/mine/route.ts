/**
 * User's Own Strategies API
 *
 * GET /api/strategies/mine
 * Returns the current user's saved strategies for publish selection.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { strategyHistory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: strategyHistory.id,
      strategyName: strategyHistory.strategyName,
      description: strategyHistory.description,
      version: strategyHistory.version,
      createdAt: strategyHistory.createdAt,
    })
    .from(strategyHistory)
    .where(eq(strategyHistory.userId, session.user.id))
    .orderBy(desc(strategyHistory.createdAt))
    .limit(50);

  return NextResponse.json({ strategies: rows });
}
