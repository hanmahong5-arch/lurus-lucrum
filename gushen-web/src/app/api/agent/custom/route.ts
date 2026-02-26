/**
 * Custom Agent CRUD API — List & Create
 * 自定义 Agent CRUD — 列表与创建
 *
 * GET  /api/agent/custom      — List current user's agents
 * POST /api/agent/custom      — Create a new agent
 *
 * @module app/api/agent/custom/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { customAgents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getLimitsForPlan } from "@/lib/config/plan-limits";

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await db
    .select()
    .from(customAgents)
    .where(eq(customAgents.userId, session.user.id))
    .orderBy(desc(customAgents.isPinned), desc(customAgents.updatedAt));

  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const plan = (session.user as { role?: string }).role;
  const limits = getLimitsForPlan(plan);

  // Check agent count limit
  if (limits.customAgent.maxAgents !== -1) {
    const existing = await db
      .select({ id: customAgents.id })
      .from(customAgents)
      .where(eq(customAgents.userId, userId));

    if (existing.length >= limits.customAgent.maxAgents) {
      return NextResponse.json(
        {
          error: "AGENT_LIMIT",
          message: `已达到 Agent 数量上限（${limits.customAgent.maxAgents} 个），请升级计划或删除已有 Agent`,
          limit: limits.customAgent.maxAgents,
        },
        { status: 403 }
      );
    }
  }

  // Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: "Agent 名称需要 1-50 个字符" },
      { status: 400 }
    );
  }

  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

  const targets = body.targets;
  if (
    !targets ||
    typeof targets !== "object" ||
    !("mode" in (targets as Record<string, unknown>))
  ) {
    return NextResponse.json(
      { error: "目标配置无效" },
      { status: 400 }
    );
  }

  const strategies = body.strategies;
  if (!Array.isArray(strategies) || strategies.length === 0) {
    return NextResponse.json(
      { error: "至少需要绑定一个策略" },
      { status: 400 }
    );
  }

  const analysisDepth =
    typeof body.analysisDepth === "string" &&
    ["light", "standard", "deep"].includes(body.analysisDepth)
      ? body.analysisDepth
      : "standard";

  // Block deep analysis for non-allowed tiers
  if (analysisDepth === "deep" && !limits.customAgent.allowDeep) {
    return NextResponse.json(
      { error: "深度分析仅对标准版及以上用户开放" },
      { status: 403 }
    );
  }

  const backtestConfig =
    body.backtestConfig && typeof body.backtestConfig === "object"
      ? body.backtestConfig
      : null;

  const icon = typeof body.icon === "string" ? body.icon : "bot";
  const color = typeof body.color === "string" ? body.color : "#6366f1";

  const [agent] = await db
    .insert(customAgents)
    .values({
      userId,
      name,
      description,
      targets: targets as typeof customAgents.$inferInsert.targets,
      strategies: strategies as typeof customAgents.$inferInsert.strategies,
      analysisDepth,
      backtestConfig: backtestConfig as typeof customAgents.$inferInsert.backtestConfig,
      icon,
      color,
    })
    .returning();

  return NextResponse.json({ agent }, { status: 201 });
}
