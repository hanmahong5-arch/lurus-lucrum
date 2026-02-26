/**
 * Custom Agent CRUD API — Get, Update, Delete
 * 自定义 Agent CRUD — 获取、更新、删除
 *
 * GET    /api/agent/custom/[id] — Get agent details
 * PUT    /api/agent/custom/[id] — Update agent config
 * DELETE /api/agent/custom/[id] — Delete agent
 *
 * @module app/api/agent/custom/[id]/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { customAgents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getLimitsForPlan } from "@/lib/config/plan-limits";

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const [agent] = await db
    .select()
    .from(customAgents)
    .where(
      and(eq(customAgents.id, id), eq(customAgents.userId, session.user.id))
    );

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = session.user.id;
  const plan = (session.user as { role?: string }).role;
  const limits = getLimitsForPlan(plan);

  // Verify ownership
  const [existing] = await db
    .select({ id: customAgents.id })
    .from(customAgents)
    .where(and(eq(customAgents.id, id), eq(customAgents.userId, userId)));

  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build update object from provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Agent 名称需要 1-50 个字符" },
        { status: 400 }
      );
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
        : null;
  }

  if (body.targets !== undefined) {
    updates.targets = body.targets;
  }

  if (body.strategies !== undefined) {
    if (!Array.isArray(body.strategies) || body.strategies.length === 0) {
      return NextResponse.json(
        { error: "至少需要绑定一个策略" },
        { status: 400 }
      );
    }
    updates.strategies = body.strategies;
  }

  if (typeof body.analysisDepth === "string") {
    if (!["light", "standard", "deep"].includes(body.analysisDepth)) {
      return NextResponse.json(
        { error: "无效的分析深度" },
        { status: 400 }
      );
    }
    if (body.analysisDepth === "deep" && !limits.customAgent.allowDeep) {
      return NextResponse.json(
        { error: "深度分析仅对标准版及以上用户开放" },
        { status: 403 }
      );
    }
    updates.analysisDepth = body.analysisDepth;
  }

  if (body.backtestConfig !== undefined) {
    updates.backtestConfig = body.backtestConfig;
  }

  if (typeof body.icon === "string") updates.icon = body.icon;
  if (typeof body.color === "string") updates.color = body.color;
  if (typeof body.isPinned === "boolean") updates.isPinned = body.isPinned;

  const [agent] = await db
    .update(customAgents)
    .set(updates)
    .where(eq(customAgents.id, id))
    .returning();

  return NextResponse.json({ agent });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const deleted = await db
    .delete(customAgents)
    .where(
      and(eq(customAgents.id, id), eq(customAgents.userId, session.user.id))
    )
    .returning({ id: customAgents.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
