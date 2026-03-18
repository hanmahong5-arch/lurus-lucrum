/**
 * Agent Protocol - Thread Runs API
 * Agent Protocol - 会话线程运行 API
 *
 * Handles runs within a conversation thread.
 * POST /api/agent-protocol/threads/[id]/runs - Create a run in thread
 * GET /api/agent-protocol/threads/[id]/runs - List runs in thread
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createAdvisorGraph } from "@/lib/agent/graphs/advisor-graph";
import { createDefaultAdvisorState } from "@/lib/agent/graphs/types";
import type { ChatMode, AgentAnalysis } from "@/lib/agent/graphs/types";
import {
  getThread,
  setThread,
} from "@/lib/agent/stores/thread-store";

// ============================================================================
// Request Validation Schema
// ============================================================================

const ThreadRunRequestSchema = z.object({
  // New message to add to the thread
  message: z.string().min(1, "Message is required"),

  // Override mode for this run (optional)
  mode: z.enum(["quick", "deep", "debate", "diagnose"]).optional(),

  // Override symbol for this run (optional)
  symbol: z.string().optional(),

  // Debate-specific
  maxDebateRounds: z.number().min(1).max(5).optional(),
});

// ============================================================================
// In-Memory Run Storage for Threads
// ============================================================================

interface ThreadRun {
  runId: string;
  threadId: string;
  input: {
    message: string;
    mode?: string;
    symbol?: string;
  };
  output?: {
    response: string;
    analyses: unknown[];
  };
  status: "running" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

const threadRunStore = new Map<string, ThreadRun>();

// ============================================================================
// API Handlers
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/agent-protocol/threads/[id]/runs
 * Create and execute a run within a thread
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  const startTime = Date.now();

  try {
    const { id: threadId } = await context.params;
    const thread = getThread(threadId);

    if (!thread) {
      return NextResponse.json(
        {
          error: "Thread not found",
          threadId,
        },
        { status: 404 }
      );
    }

    // Parse request
    const body = await request.json();
    const validationResult = ThreadRunRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const input = validationResult.data;
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[Agent Protocol] Thread ${threadId} run ${runId} started`);

    // Create run record
    const run: ThreadRun = {
      runId,
      threadId,
      input: {
        message: input.message,
        mode: input.mode,
        symbol: input.symbol,
      },
      status: "running",
      createdAt: new Date(),
    };
    threadRunStore.set(runId, run);
    thread.runs.push(runId);

    // Build initial state with thread context
    const defaultState = createDefaultAdvisorState();
    const threadValues = thread.values as Record<string, unknown>;

    // Determine mode: explicit > thread > default
    const mode = (input.mode || threadValues.mode || "quick") as ChatMode;
    const symbol = input.symbol || (threadValues.symbol as string | undefined);

    // Build message history from previous runs in thread
    const previousMessages: (HumanMessage | AIMessage)[] = [];
    for (const prevRunId of thread.runs.slice(0, -1)) {
      const prevRun = threadRunStore.get(prevRunId);
      if (prevRun && prevRun.status === "completed" && prevRun.output) {
        previousMessages.push(new HumanMessage(prevRun.input.message));
        previousMessages.push(new AIMessage(prevRun.output.response));
      }
    }

    const initialState = {
      ...defaultState,
      question: input.message,
      symbol,
      mode,
      messages: previousMessages,
      userContext: {
        ...defaultState.userContext,
        ...(threadValues.userContext as Record<string, unknown> || {}),
      },
      isDebate: mode === "debate",
      maxDebateRounds: input.maxDebateRounds || 2,
    };

    // Create and invoke the graph
    const graph = createAdvisorGraph();
    const result = await graph.invoke(initialState);

    // Update run record
    run.status = "completed";
    run.completedAt = new Date();
    run.output = {
      response: result.finalResponse || "",
      analyses: result.analyses,
    };
    threadRunStore.set(runId, run);

    // Update thread
    thread.messageCount += 2; // User message + AI response
    thread.updatedAt = new Date();
    thread.values = {
      ...thread.values,
      lastSymbol: symbol,
      lastMode: mode,
    };
    setThread(threadId, thread);

    const duration = Date.now() - startTime;
    console.log(`[Agent Protocol] Thread ${threadId} run ${runId} completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      runId,
      threadId,
      status: "completed",
      duration,
      result: {
        response: result.finalResponse,
        analyses: result.analyses.map((a: AgentAnalysis) => ({
          agentId: a.agentId,
          agentName: a.agentName,
          agentType: a.agentType,
          stance: a.stance,
          keyPoints: a.keyPoints,
          confidence: a.confidence,
        })),
        debateConclusion: result.debateConclusion,
      },
      thread: {
        messageCount: thread.messageCount,
        runCount: thread.runs.length,
      },
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread run failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent-protocol/threads/[id]/runs
 * List all runs in a thread
 */
export async function GET(
  _request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: threadId } = await context.params;
    const thread = getThread(threadId);

    if (!thread) {
      return NextResponse.json(
        {
          error: "Thread not found",
          threadId,
        },
        { status: 404 }
      );
    }

    // Get all runs for this thread
    const runs = thread.runs
      .map((runId) => threadRunStore.get(runId))
      .filter((run): run is ThreadRun => run !== undefined)
      .map((run) => ({
        runId: run.runId,
        message: run.input.message,
        mode: run.input.mode,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        hasResponse: !!run.output?.response,
        error: run.error,
      }));

    return NextResponse.json({
      success: true,
      threadId,
      runs,
      total: runs.length,
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread runs list failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
