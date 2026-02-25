/**
 * Strategy Scanner Agent API Route
 * 策略扫描 Agent API 路由
 *
 * POST /api/agent/scanner
 * Accepts scan configuration and streams results via SSE.
 * Requires authenticated session.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import {
  streamScannerAgent,
  type ScannerEvent,
  type ScanTarget,
} from "@/lib/agent/scanner-agent";
import { checkAndConsumeQuota } from "@/lib/middleware/quota-check";
import { recordUserEvent } from "@/lib/db/queries";

/** Encode a ScannerEvent as an SSE data line */
function sseEvent(event: ScannerEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Encode an error as an SSE error event */
function sseError(code: string, message: string): string {
  return sseEvent({ type: "error", code, message });
}

export async function POST(request: NextRequest) {
  // Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(sseError("UNAUTHORIZED", "请先登录后再使用扫描选板功能"), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const userId = session.user.id as string | undefined;

  // Parse and validate request body
  let strategy: string;
  let strategyName: string | undefined;
  let scanTargets: ScanTarget[];
  let dateRange: { start: string; end: string };
  let capital: number;

  try {
    const body = (await request.json()) as {
      strategy?: unknown;
      strategyName?: unknown;
      scanTargets?: unknown;
      dateRange?: unknown;
      capital?: unknown;
    };

    if (typeof body.strategy !== "string" || !body.strategy.trim()) {
      return new Response(sseError("INVALID_INPUT", "请选择有效的策略"), {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    strategy = body.strategy.trim();
    strategyName =
      typeof body.strategyName === "string" ? body.strategyName : undefined;

    if (
      !Array.isArray(body.scanTargets) ||
      body.scanTargets.length === 0 ||
      body.scanTargets.length > 50
    ) {
      return new Response(
        sseError("INVALID_INPUT", "扫描目标数量需在 1-50 之间"),
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }
    scanTargets = (body.scanTargets as ScanTarget[]).filter(
      (t) =>
        typeof t.code === "string" &&
        typeof t.name === "string" &&
        (t.type === "sector" || t.type === "stock")
    );

    const dr = body.dateRange as { start?: unknown; end?: unknown } | undefined;
    if (typeof dr?.start !== "string" || typeof dr?.end !== "string") {
      return new Response(sseError("INVALID_INPUT", "请提供有效的日期范围"), {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    dateRange = { start: dr.start, end: dr.end };

    capital =
      typeof body.capital === "number" && body.capital >= 10000
        ? body.capital
        : 100000;
  } catch {
    return new Response(sseError("PARSE_ERROR", "请求格式错误"), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Quota check (scanner uses ~5000 tokens for insights generation)
  if (userId) {
    const quota = await checkAndConsumeQuota(userId, 5000, "agent_scan");
    if (!quota.allowed) {
      return new Response(
        sseError(
          "QUOTA_EXCEEDED",
          `扫描选板次数已达今日上限（剩余 ${quota.remaining} tokens）。请升级计划继续使用。`
        ),
        { status: 429, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  }

  // Record event (async, non-blocking)
  recordUserEvent({
    userId: userId ?? null,
    eventType: "agent_scan",
    metadata: {
      strategy,
      targetCount: scanTargets.length,
      dateRange,
    },
    tokenCost: 0,
  });

  // Stream response via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function write(event: ScannerEvent) {
        controller.enqueue(encoder.encode(sseEvent(event)));
      }

      try {
        for await (const event of streamScannerAgent({
          strategy,
          strategyName,
          scanTargets,
          dateRange,
          capital,
        })) {
          write(event);
        }
      } catch (error) {
        write({
          type: "error",
          code: "STREAM_ERROR",
          message:
            error instanceof Error ? error.message : "扫描过程中发生错误",
        });
      } finally {
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
