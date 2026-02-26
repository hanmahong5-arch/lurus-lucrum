/**
 * Custom Agent Runs History API
 * 自定义 Agent 运行历史 API
 *
 * GET /api/agent/custom/[id]/runs?page=1&limit=10
 * Returns paginated run history for a given agent.
 *
 * @module app/api/agent/custom/[id]/runs/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { customAgents, customAgentRuns } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await context.params;
  const userId = session.user.id;

  // Verify agent ownership
  const [agent] = await db
    .select({ id: customAgents.id })
    .from(customAgents)
    .where(
      and(eq(customAgents.id, agentId), eq(customAgents.userId, userId))
    );

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Parse pagination
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10))
  );
  const offset = (page - 1) * limit;

  // Fetch runs
  const [runs, [totalRow]] = await Promise.all([
    db
      .select()
      .from(customAgentRuns)
      .where(eq(customAgentRuns.agentId, agentId))
      .orderBy(desc(customAgentRuns.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(customAgentRuns)
      .where(eq(customAgentRuns.agentId, agentId)),
  ]);

  const total = totalRow?.total ?? 0;

  return NextResponse.json({
    runs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
