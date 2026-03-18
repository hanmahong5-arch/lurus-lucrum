/**
 * Agent Protocol - Threads API
 * Agent Protocol - 会话线程 API
 *
 * Handles multi-turn conversation threads.
 * POST /api/agent-protocol/threads - Create a new thread
 * GET /api/agent-protocol/threads - List threads
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  type StoredThread,
  getThread,
  setThread,
  getAllThreads,
  getThreadCount,
  clearAllThreads,
} from "@/lib/agent/stores/thread-store";

// ============================================================================
// Request Validation Schemas
// ============================================================================

const CreateThreadSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  // Optional initial values
  initialValues: z.object({
    symbol: z.string().optional(),
    mode: z.enum(["quick", "deep", "debate", "diagnose"]).optional(),
    userContext: z.record(z.unknown()).optional(),
  }).optional(),
});

// ============================================================================
// API Handlers
// ============================================================================

/**
 * POST /api/agent-protocol/threads
 * Create a new conversation thread
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = CreateThreadSchema.safeParse(body);

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
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const thread: StoredThread = {
      threadId,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata || {},
      values: input.initialValues || {},
      runs: [],
      messageCount: 0,
    };

    setThread(threadId, thread);
    console.log(`[Agent Protocol] Thread ${threadId} created`);

    return NextResponse.json({
      success: true,
      threadId,
      createdAt: now.toISOString(),
      metadata: thread.metadata,
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread creation failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent-protocol/threads
 * List all threads
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get threads sorted by updatedAt
    const threads = getAllThreads()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(offset, offset + limit)
      .map((thread) => ({
        threadId: thread.threadId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        runCount: thread.runs.length,
        messageCount: thread.messageCount,
      }));

    return NextResponse.json({
      success: true,
      threads,
      total: getThreadCount(),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread listing failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-protocol/threads
 * Delete all threads (for testing/cleanup)
 */
export async function DELETE(_request: NextRequest) {
  try {
    const count = clearAllThreads();
    console.log(`[Agent Protocol] Cleared ${count} threads`);

    return NextResponse.json({
      success: true,
      deleted: count,
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread cleanup failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
