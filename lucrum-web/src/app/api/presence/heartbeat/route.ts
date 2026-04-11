/**
 * Presence Heartbeat API — Record user presence on a resource
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import { heartbeat, removePresence } from '@/lib/services/presence-service';

// POST /api/presence/heartbeat
export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const body = await req.json();
    const { tenantId, resourceType, resourceId, action } = body as {
      tenantId?: number;
      resourceType?: string;
      resourceId?: string;
      action?: 'join' | 'leave';
    };

    if (!tenantId || !resourceType || !resourceId) {
      return NextResponse.json(
        { success: false, error: 'tenantId, resourceType, and resourceId are required' },
        { status: 400 }
      );
    }

    // Handle leave action
    if (action === 'leave') {
      await removePresence(tenantId, resourceType, resourceId, user.userId);
      return NextResponse.json({ success: true });
    }

    // Default: heartbeat (join/refresh)
    const ok = await heartbeat({
      tenantId,
      resourceType,
      resourceId,
      userId: user.userId,
      name: user.name || user.email,
      avatar: null, // Could be fetched from user profile
    });

    return NextResponse.json({ success: ok });
  });
}

export const dynamic = 'force-dynamic';
