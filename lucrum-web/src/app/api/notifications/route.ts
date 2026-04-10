/**
 * Notifications API — Get notifications / Mark as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '@/lib/services/notification-service';

// GET /api/notifications?before=123&limit=20&unreadOnly=true
export async function GET(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get('before');
    const limit = searchParams.get('limit');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';

    // Fast path for unread count only
    if (countOnly) {
      const count = await getUnreadCount(user.userId);
      return NextResponse.json({ success: true, unreadCount: count });
    }

    const result = await getUserNotifications(user.userId, {
      before: before ? parseInt(before, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 20,
      unreadOnly,
    });

    const unreadCount = await getUnreadCount(user.userId);

    return NextResponse.json({
      success: true,
      ...result,
      unreadCount,
    });
  });
}

// PATCH /api/notifications — mark as read
export async function PATCH(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const body = await req.json();
    const { ids, all } = body as { ids?: number[]; all?: boolean };

    if (all) {
      await markAllAsRead(user.userId);
      return NextResponse.json({ success: true });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array or all=true is required' },
        { status: 400 }
      );
    }

    await markAsRead(user.userId, ids);
    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
