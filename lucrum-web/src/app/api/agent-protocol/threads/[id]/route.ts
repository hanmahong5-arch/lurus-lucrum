/**
 * Agent Protocol - Thread Detail API
 * Agent Protocol - 会话线程详情 API
 *
 * Handles individual thread operations.
 * GET /api/agent-protocol/threads/[id] - Get thread details
 * DELETE /api/agent-protocol/threads/[id] - Delete a thread
 * PATCH /api/agent-protocol/threads/[id] - Update thread metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getThread,
  setThread,
  deleteThread,
  hasThread,
} from "@/lib/agent/stores/thread-store";

// ============================================================================
// Request Validation Schemas
// ============================================================================

const UpdateThreadSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  values: z.record(z.unknown()).optional(),
});

// ============================================================================
// API Handlers
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agent-protocol/threads/[id]
 * Get thread details including history
 */
export async function GET(
  _request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;
    const thread = getThread(id);

    if (!thread) {
      return NextResponse.json(
        {
          error: "Thread not found",
          threadId: id,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      thread: {
        threadId: thread.threadId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        values: thread.values,
        runs: thread.runs,
        messageCount: thread.messageCount,
      },
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread fetch failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agent-protocol/threads/[id]
 * Update thread metadata or values
 */
export async function PATCH(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;
    const thread = getThread(id);

    if (!thread) {
      return NextResponse.json(
        {
          error: "Thread not found",
          threadId: id,
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = UpdateThreadSchema.safeParse(body);

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

    // Update thread
    if (input.metadata) {
      thread.metadata = { ...thread.metadata, ...input.metadata };
    }
    if (input.values) {
      thread.values = { ...thread.values, ...input.values };
    }
    thread.updatedAt = new Date();

    setThread(id, thread);
    console.log(`[Agent Protocol] Thread ${id} updated`);

    return NextResponse.json({
      success: true,
      thread: {
        threadId: thread.threadId,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        values: thread.values,
      },
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread update failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-protocol/threads/[id]
 * Delete a thread
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;

    if (!hasThread(id)) {
      return NextResponse.json(
        {
          error: "Thread not found",
          threadId: id,
        },
        { status: 404 }
      );
    }

    deleteThread(id);
    console.log(`[Agent Protocol] Thread ${id} deleted`);

    return NextResponse.json({
      success: true,
      deleted: id,
    });
  } catch (error) {
    console.error("[Agent Protocol] Thread deletion failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
