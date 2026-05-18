/**
 * Timeline API — exposes the per-user event stream.
 *
 * GET  /api/timeline?cursor=&type=&entityId=&limit=
 * POST /api/timeline { type, entityType?, entityId?, metadata? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getUserTimeline,
  recordEvent,
} from '@/lib/services/user-event-service';
import {
  USER_EVENT_TYPES,
  type UserEventType,
} from '@/lib/services/user-event-types';

const VALID_EVENT_TYPES = new Set<string>(Object.values(USER_EVENT_TYPES));

export async function GET(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const { searchParams } = new URL(req.url);

    const cursor = searchParams.get('cursor') ?? undefined;
    const type = (searchParams.get('type') as UserEventType | null) ?? undefined;
    const entityId = searchParams.get('entityId') ?? undefined;
    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

    const page = await getUserTimeline({
      userId: user.userId,
      cursor,
      filterType: type,
      entityId,
      limit,
    });

    return NextResponse.json({ success: true, data: page });
  });
}

export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'invalid json' },
        { status: 400 },
      );
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const type = typeof b.type === 'string' ? b.type : '';
    if (!VALID_EVENT_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: 'invalid event type' },
        { status: 400 },
      );
    }
    recordEvent({
      userId: user.userId,
      type: type as UserEventType,
      entityType: typeof b.entityType === 'string' ? b.entityType : undefined,
      entityId:
        typeof b.entityId === 'string' || typeof b.entityId === 'number'
          ? b.entityId
          : undefined,
      metadata:
        b.metadata && typeof b.metadata === 'object'
          ? (b.metadata as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json({ success: true }, { status: 202 });
  });
}

export const dynamic = 'force-dynamic';
