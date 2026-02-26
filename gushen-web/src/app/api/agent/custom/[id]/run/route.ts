/**
 * Custom Agent Run API — SSE Stream
 * 自定义 Agent 运行 API — SSE 流
 *
 * POST /api/agent/custom/[id]/run
 * Auth → Usage check → Create run record → Execute graph → Stream events → Update run
 *
 * @module app/api/agent/custom/[id]/run/route
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { customAgents, customAgentRuns } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { streamCustomAgent } from "@/lib/agent/custom-agent";
import { checkAndConsumeQuota, consumeQuota } from "@/lib/middleware/quota-check";
import { checkUsage, incrementUsage } from "@/lib/middleware/usage-tracker";
import { getLimitsForPlan } from "@/lib/config/plan-limits";
import { recordUserEvent } from "@/lib/db/queries";
import type { CustomAgentEvent, CustomAgentConfig } from "@/lib/agent/custom-agent-types";

const TOKEN_ESTIMATES = { light: 0, standard: 1500, deep: 5000 } as const;

/** Encode a CustomAgentEvent as an SSE data line */
function sseEvent(event: CustomAgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sseError(code: string, message: string): string {
  return sseEvent({ type: "error", message, code });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(sseError("UNAUTHORIZED", "请先登录"), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const userId = session.user.id;
  const plan = (session.user as { role?: string }).role;
  const limits = getLimitsForPlan(plan);
  const { id: agentId } = await context.params;

  // Fetch agent (verify ownership)
  const [agent] = await db
    .select()
    .from(customAgents)
    .where(
      and(eq(customAgents.id, agentId), eq(customAgents.userId, userId))
    );

  if (!agent) {
    return new Response(sseError("NOT_FOUND", "Agent 不存在"), {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Daily usage check
  const usage = await checkUsage(userId, "custom_agent_run", plan);
  if (!usage.allowed) {
    return new Response(
      sseError(
        "DAILY_LIMIT",
        `今日 Agent 运行次数已达上限（${usage.used}/${usage.limit}），请明天再试或升级计划`
      ),
      { status: 429, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Token quota check (for standard/deep analysis)
  const depth = agent.analysisDepth as keyof typeof TOKEN_ESTIMATES;
  const estimatedTokens = TOKEN_ESTIMATES[depth] ?? 1500;

  if (estimatedTokens > 0) {
    const quota = await checkAndConsumeQuota(
      userId,
      estimatedTokens,
      "custom_agent_run"
    );
    if (!quota.allowed) {
      return new Response(
        sseError(
          "QUOTA_EXCEEDED",
          `AI Token 配额不足（剩余 ${quota.remaining}），请升级计划继续使用`
        ),
        { status: 429, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  }

  // Increment daily usage counter
  void incrementUsage(userId, "custom_agent_run");

  // Record event (async, non-blocking)
  recordUserEvent({
    userId,
    eventType: "custom_agent_run",
    metadata: {
      agentId,
      agentName: agent.name,
      analysisDepth: agent.analysisDepth,
    },
    tokenCost: 0,
  });

  // Create run record
  const [run] = await db
    .insert(customAgentRuns)
    .values({
      agentId,
      userId,
      status: "running",
      configSnapshot: {
        name: agent.name,
        targets: agent.targets,
        strategies: agent.strategies,
        analysisDepth: agent.analysisDepth,
        backtestConfig: agent.backtestConfig,
      },
    })
    .returning();

  const runId = run!.id;

  // Build agent config
  const config: CustomAgentConfig = {
    name: agent.name,
    description: agent.description ?? undefined,
    targets: agent.targets as CustomAgentConfig["targets"],
    strategies: agent.strategies as CustomAgentConfig["strategies"],
    analysisDepth: depth,
    backtestConfig: agent.backtestConfig as CustomAgentConfig["backtestConfig"],
    icon: agent.icon ?? "bot",
    color: agent.color ?? "#6366f1",
  };

  const maxStocks =
    limits.customAgent.maxStocks === -1
      ? 100
      : limits.customAgent.maxStocks;

  // Stream response via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function write(event: CustomAgentEvent) {
        try {
          controller.enqueue(encoder.encode(sseEvent(event)));
        } catch {
          // Stream may be closed by client
        }
      }

      let finalStatus: "completed" | "failed" = "failed";
      let resultSummary: {
        totalStocks: number;
        analyzed: number;
        topN: number;
        avgReturn: number;
        bestSymbol: string;
      } | null = null;
      let stockResults: Array<{
        symbol: string;
        name: string;
        totalReturn: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        score: number;
      }> | null = null;
      let insights: string | null = null;
      let totalTokenCost = 0;
      let durationMs = 0;

      try {
        for await (const event of streamCustomAgent({
          config,
          maxStocks,
        })) {
          write(event);

          // Capture final data for run record
          if (event.type === "complete") {
            finalStatus = "completed";
            resultSummary = {
              totalStocks: event.summary.totalStocks,
              analyzed: event.summary.analyzed,
              topN: event.summary.topN.length,
              avgReturn: event.summary.avgReturn,
              bestSymbol: event.summary.bestSymbol,
            };
            stockResults = event.summary.topN;
            totalTokenCost = event.summary.totalTokenCost;
            durationMs = event.summary.durationMs;
          }

          if (event.type === "insights") {
            insights = event.text;
          }
        }
      } catch (error) {
        write({
          type: "error",
          message:
            error instanceof Error ? error.message : "Agent 运行过程中发生错误",
          code: "STREAM_ERROR",
        });
      } finally {
        // Update run record
        void db
          .update(customAgentRuns)
          .set({
            status: finalStatus,
            resultSummary,
            stockResults,
            insights,
            totalTokenCost,
            durationMs,
            tokenBreakdown: { resolveTargets: 0, insights: totalTokenCost },
          })
          .where(eq(customAgentRuns.id, runId))
          .catch((err: unknown) => {
            console.error("[CustomAgentRun] Failed to update run record:", err);
          });

        // Update agent run count and last run time
        void db
          .update(customAgents)
          .set({
            runCount: sql`${customAgents.runCount} + 1`,
            lastRunAt: new Date(),
          })
          .where(eq(customAgents.id, agentId))
          .catch((err: unknown) => {
            console.error("[CustomAgentRun] Failed to update agent stats:", err);
          });

        // Report actual token consumption
        if (totalTokenCost > 0) {
          consumeQuota({
            userId,
            tokens: totalTokenCost,
            operationType: "custom_agent_run",
          });
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
