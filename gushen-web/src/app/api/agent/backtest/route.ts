/**
 * Backtest Agent API Route
 *
 * POST /api/agent/backtest
 * Accepts a natural language message and streams agent events via SSE.
 * Requires a valid NextAuth session.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { streamBacktestAgent, type AgentStreamEvent } from "@/lib/agent/backtest-agent";

/** Maximum allowed message length */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Build an SSE data line from an event object
 */
function sseEvent(event: AgentStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  // Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(
      sseEvent({ type: "error", code: "UNAUTHORIZED", message: "请先登录后再使用 AI 回测 Agent" }),
      {
        status: 401,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }

  // Parse request body
  let message: string;
  let sessionId: string | undefined;
  try {
    const body = await request.json() as { message?: unknown; sessionId?: unknown };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return new Response(
        sseEvent({ type: "error", code: "INVALID_INPUT", message: "请输入有效的回测请求" }),
        {
          status: 400,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }
    message = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
    sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  } catch {
    return new Response(
      sseEvent({ type: "error", code: "PARSE_ERROR", message: "请求格式错误" }),
      {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }

  // Stream response using SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function write(event: AgentStreamEvent) {
        controller.enqueue(encoder.encode(sseEvent(event)));
      }

      try {
        for await (const event of streamBacktestAgent(message)) {
          write(event);
          // Signal stream end after final events
          if (
            event.type === "report" ||
            event.type === "error" ||
            event.type === "followUp"
          ) {
            break;
          }
        }
      } catch (error) {
        write({
          type: "error",
          code: "STREAM_ERROR",
          message: error instanceof Error ? error.message : "流式传输出错",
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
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
