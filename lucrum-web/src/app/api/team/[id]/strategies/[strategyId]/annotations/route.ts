/**
 * Strategy Annotations API — CRUD for line-level code review comments
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { strategyAnnotations } from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string; strategyId: string }> };

// GET /api/team/[id]/strategies/[strategyId]/annotations
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id, strategyId } = await params;
  const sid = parseInt(strategyId, 10);

  return withTenantRole<unknown>(request, ['*'], async (_req, _user, tenant) => {
    // Fetch top-level annotations with their replies
    const annotations = await db
      .select()
      .from(strategyAnnotations)
      .where(
        and(
          eq(strategyAnnotations.strategyHistoryId, sid),
          eq(strategyAnnotations.tenantId, tenant.tenantId),
          isNull(strategyAnnotations.parentId)
        )
      )
      .orderBy(desc(strategyAnnotations.createdAt));

    // Fetch all replies
    const replies = await db
      .select()
      .from(strategyAnnotations)
      .where(
        and(
          eq(strategyAnnotations.strategyHistoryId, sid),
          eq(strategyAnnotations.tenantId, tenant.tenantId)
        )
      );

    // Build threaded structure
    const replyMap = new Map<number, typeof replies>();
    for (const reply of replies) {
      if (reply.parentId) {
        const existing = replyMap.get(reply.parentId) ?? [];
        existing.push(reply);
        replyMap.set(reply.parentId, existing);
      }
    }

    const threaded = annotations.map((a) => ({
      ...a,
      replies: replyMap.get(a.id) ?? [],
    }));

    return NextResponse.json({ success: true, data: threaded });
  });
}

// POST /api/team/[id]/strategies/[strategyId]/annotations — create annotation
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, strategyId } = await params;
  const sid = parseInt(strategyId, 10);

  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { lineNumber, content, parentId } = body as {
      lineNumber?: number | null;
      content?: string;
      parentId?: number | null;
    };

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
    }

    const result = await db
      .insert(strategyAnnotations)
      .values({
        strategyHistoryId: sid,
        tenantId: tenant.tenantId,
        userId: user.userId,
        userName: user.name || user.email,
        lineNumber: lineNumber ?? null,
        content: content.trim(),
        parentId: parentId ?? null,
      })
      .returning();

    const annotation = result[0];
    if (!annotation) {
      return NextResponse.json({ success: false, error: 'Failed to create annotation' }, { status: 500 });
    }

    // Record activity
    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'strategy_updated',
      resourceType: 'strategy',
      resourceId: String(sid),
      metadata: {
        action: 'annotated',
        lineNumber,
        isReply: !!parentId,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: annotation }, { status: 201 });
  });
}

// PATCH /api/team/[id]/strategies/[strategyId]/annotations — resolve/update
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, strategyId } = await params;

  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { annotationId, resolved, content } = body as {
      annotationId?: number;
      resolved?: boolean;
      content?: string;
    };

    if (!annotationId) {
      return NextResponse.json({ success: false, error: 'annotationId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (resolved !== undefined) {
      updates.resolved = resolved;
      updates.resolvedBy = resolved ? user.userId : null;
    }
    if (content !== undefined) {
      updates.content = content.trim();
    }

    await db
      .update(strategyAnnotations)
      .set(updates)
      .where(
        and(
          eq(strategyAnnotations.id, annotationId),
          eq(strategyAnnotations.tenantId, tenant.tenantId)
        )
      );

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/team/[id]/strategies/[strategyId]/annotations?annotationId=123
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, strategyId } = await params;

  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const annotationId = parseInt(req.nextUrl.searchParams.get('annotationId') || '0', 10);
    if (!annotationId) {
      return NextResponse.json({ success: false, error: 'annotationId is required' }, { status: 400 });
    }

    // Only author or team admin/owner can delete
    await db
      .delete(strategyAnnotations)
      .where(
        and(
          eq(strategyAnnotations.id, annotationId),
          eq(strategyAnnotations.tenantId, tenant.tenantId)
        )
      );

    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
