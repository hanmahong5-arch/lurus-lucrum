/**
 * Agent Protocol - Streaming Runs API
 * Agent Protocol - 流式运行 API
 *
 * Handles streaming execution of the advisor graph.
 * POST /api/agent-protocol/runs/stream - Create and stream run output
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdvisorGraph } from "@/lib/agent/graphs/advisor-graph";
import { createDefaultAdvisorState } from "@/lib/agent/graphs/types";
import type { ChatMode } from "@/lib/agent/graphs/types";

// ============================================================================
// Request Validation Schema
// ============================================================================

const StreamRunRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  symbol: z.string().optional(),
  mode: z.enum(["quick", "deep", "debate", "diagnose"]).default("quick"),
  userContext: z.object({
    corePhilosophy: z.enum(["value", "growth", "trend", "quantitative", "index", "dividend", "momentum"]).optional(),
    analysisMethods: z.array(z.enum(["fundamental", "technical", "macro", "behavioral", "factor"])).optional(),
    tradingStyle: z.string().optional(),
    riskProfile: z.object({
      tolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      investmentHorizon: z.enum(["short", "medium", "long"]).optional(),
    }).optional(),
  }).optional(),
  maxDebateRounds: z.number().min(1).max(5).default(2),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * POST /api/agent-protocol/runs/stream
 * Create and stream run output using Server-Sent Events
 */
export async function POST(request: NextRequest) {
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    // Parse and validate request
    const body = await request.json();
    const validationResult = StreamRunRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          details: validationResult.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const input = validationResult.data;
    console.log(`[Agent Protocol Stream] Run ${runId} started - Mode: ${input.mode}`);

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Helper to send SSE events
    const sendEvent = async (event: string, data: unknown) => {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    };

    // Start async graph execution
    (async () => {
      try {
        // Send start event
        await sendEvent("start", {
          runId,
          mode: input.mode,
          timestamp: new Date().toISOString(),
        });

        // Build initial state
        const defaultState = createDefaultAdvisorState();
        const initialState = {
          ...defaultState,
          question: input.question,
          symbol: input.symbol,
          mode: input.mode as ChatMode,
          userContext: {
            ...defaultState.userContext,
            ...input.userContext,
            riskProfile: {
              ...defaultState.userContext.riskProfile,
              ...input.userContext?.riskProfile,
            },
          },
          isDebate: input.mode === "debate",
          maxDebateRounds: input.maxDebateRounds,
        };

        // Create graph
        const graph = createAdvisorGraph();

        // Stream the graph execution
        // Note: LangGraph supports streaming via .stream() method
        const streamResult = await graph.stream(initialState, {
          streamMode: "updates",
        });

        // Process stream
        for await (const chunk of streamResult) {
          // Each chunk contains node updates
          for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
            await sendEvent("node_update", {
              runId,
              node: nodeName,
              timestamp: new Date().toISOString(),
              // Send relevant parts of the output
              output: sanitizeOutput(nodeOutput),
            });

            // If this node produced an analysis, send it separately
            const output = nodeOutput as { analyses?: unknown[]; finalResponse?: string; debateConclusion?: unknown };
            if (output && output.analyses && Array.isArray(output.analyses)) {
              for (const analysis of output.analyses) {
                await sendEvent("analysis", {
                  runId,
                  ...sanitizeAnalysis(analysis),
                });
              }
            }

            // If this is the final response, send it
            if (output && output.finalResponse) {
              await sendEvent("response", {
                runId,
                content: output.finalResponse,
                timestamp: new Date().toISOString(),
              });
            }

            // If debate conclusion, send it
            if (output && output.debateConclusion) {
              await sendEvent("debate_conclusion", {
                runId,
                conclusion: output.debateConclusion,
              });
            }
          }
        }

        // Send completion event
        await sendEvent("complete", {
          runId,
          status: "completed",
          timestamp: new Date().toISOString(),
        });

        console.log(`[Agent Protocol Stream] Run ${runId} completed`);
      } catch (error) {
        console.error(`[Agent Protocol Stream] Run ${runId} failed:`, error);
        await sendEvent("error", {
          runId,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      } finally {
        await writer.close();
      }
    })();

    // Return the SSE stream
    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Run-Id": runId,
      },
    });
  } catch (error) {
    console.error(`[Agent Protocol Stream] Run ${runId} setup failed:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        runId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize node output for streaming
 * 清理节点输出用于流式传输
 */
function sanitizeOutput(output: unknown): Record<string, unknown> {
  if (!output || typeof output !== "object") {
    return {};
  }

  const obj = output as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Only include safe, serializable fields
  if ("nextAgent" in obj) sanitized.nextAgent = obj.nextAgent;
  if ("debateRound" in obj) sanitized.debateRound = obj.debateRound;
  if ("errors" in obj && Array.isArray(obj.errors)) sanitized.errors = obj.errors;

  return sanitized;
}

/**
 * Sanitize analysis for streaming
 * 清理分析结果用于流式传输
 */
function sanitizeAnalysis(analysis: unknown): Record<string, unknown> {
  if (!analysis || typeof analysis !== "object") {
    return {};
  }

  const a = analysis as Record<string, unknown>;
  return {
    agentId: a.agentId,
    agentName: a.agentName,
    agentType: a.agentType,
    stance: a.stance,
    keyPoints: a.keyPoints,
    confidence: a.confidence,
    // Don't include full content in stream events (too large)
    contentLength: typeof a.content === "string" ? a.content.length : 0,
  };
}
