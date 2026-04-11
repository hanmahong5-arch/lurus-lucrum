/**
 * Strategy Reviews API — PR-like review workflow
 * GET: list reviews, POST: create review, PATCH: update status / add comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { strategyReviews, reviewComments, strategyHistory } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id]/reviews?status=open
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (req, _user, tenant) => {
    const status = req.nextUrl.searchParams.get('status');

    const conditions = [eq(strategyReviews.tenantId, tenant.tenantId)];
    if (status) conditions.push(eq(strategyReviews.status, status));

    const reviews = await db
      .select({
        id: strategyReviews.id,
        title: strategyReviews.title,
        description: strategyReviews.description,
        status: strategyReviews.status,
        authorId: strategyReviews.authorId,
        authorName: strategyReviews.authorName,
        strategyHistoryId: strategyReviews.strategyHistoryId,
        requiredApprovals: strategyReviews.requiredApprovals,
        approvalCount: strategyReviews.approvalCount,
        createdAt: strategyReviews.createdAt,
        updatedAt: strategyReviews.updatedAt,
        closedAt: strategyReviews.closedAt,
        strategyName: strategyHistory.strategyName,
      })
      .from(strategyReviews)
      .leftJoin(strategyHistory, eq(strategyHistory.id, strategyReviews.strategyHistoryId))
      .where(and(...conditions))
      .orderBy(desc(strategyReviews.createdAt))
      .limit(50);

    // Get comment counts per review
    const reviewIds = reviews.map((r) => r.id);
    let commentCounts: Record<number, number> = {};
    if (reviewIds.length > 0) {
      const counts = await db
        .select({
          reviewId: reviewComments.reviewId,
          count: sql<number>`count(*)::int`,
        })
        .from(reviewComments)
        .where(sql`${reviewComments.reviewId} = ANY(${reviewIds})`)
        .groupBy(reviewComments.reviewId);
      commentCounts = Object.fromEntries(counts.map((c) => [c.reviewId, c.count]));
    }

    const data = reviews.map((r) => ({
      ...r,
      commentCount: commentCounts[r.id] ?? 0,
    }));

    return NextResponse.json({ success: true, data });
  });
}

// POST /api/team/[id]/reviews — create a new review
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { strategyHistoryId, title, description } = body as {
      strategyHistoryId?: number;
      title?: string;
      description?: string;
    };

    if (!strategyHistoryId || !title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'strategyHistoryId and title are required' },
        { status: 400 }
      );
    }

    const result = await db
      .insert(strategyReviews)
      .values({
        tenantId: tenant.tenantId,
        strategyHistoryId,
        authorId: user.userId,
        authorName: user.name || user.email,
        title: title.trim(),
        description: description?.trim() ?? null,
        status: 'open',
      })
      .returning();

    const review = result[0];
    if (!review) {
      return NextResponse.json({ success: false, error: 'Failed to create review' }, { status: 500 });
    }

    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'review_submitted',
      resourceType: 'review',
      resourceId: String(review.id),
      metadata: { title, strategyHistoryId },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  });
}

// PATCH /api/team/[id]/reviews — add comment or change status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { reviewId, action, content } = body as {
      reviewId?: number;
      action?: 'comment' | 'approve' | 'reject' | 'request_changes' | 'withdraw';
      content?: string;
    };

    if (!reviewId || !action) {
      return NextResponse.json(
        { success: false, error: 'reviewId and action are required' },
        { status: 400 }
      );
    }

    // Verify review belongs to this tenant
    const review = await db
      .select()
      .from(strategyReviews)
      .where(and(eq(strategyReviews.id, reviewId), eq(strategyReviews.tenantId, tenant.tenantId)))
      .limit(1);

    if (!review[0]) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    }

    // Add comment
    if (content?.trim()) {
      await db.insert(reviewComments).values({
        reviewId,
        userId: user.userId,
        userName: user.name || user.email,
        type: action,
        content: content.trim(),
      });
    }

    // Handle status transitions
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (action === 'approve') {
      const newCount = (review[0].approvalCount ?? 0) + 1;
      updates.approvalCount = newCount;
      if (newCount >= (review[0].requiredApprovals ?? 1)) {
        updates.status = 'approved';
        updates.closedAt = new Date();
      }
    } else if (action === 'reject') {
      updates.status = 'rejected';
      updates.closedAt = new Date();
    } else if (action === 'withdraw') {
      // Only author can withdraw
      if (review[0].authorId !== user.userId) {
        return NextResponse.json({ success: false, error: 'Only the author can withdraw' }, { status: 403 });
      }
      updates.status = 'withdrawn';
      updates.closedAt = new Date();
    }

    if (Object.keys(updates).length > 1) { // More than just updatedAt
      await db
        .update(strategyReviews)
        .set(updates)
        .where(eq(strategyReviews.id, reviewId));
    }

    // Record activity for status changes
    if (['approve', 'reject'].includes(action)) {
      const actionType = action === 'approve' ? 'review_approved' : 'review_rejected';
      recordActivity({
        tenantId: tenant.tenantId,
        userId: user.userId,
        actorName: user.name || user.email,
        actionType: actionType as 'review_approved' | 'review_rejected',
        resourceType: 'review',
        resourceId: String(reviewId),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
