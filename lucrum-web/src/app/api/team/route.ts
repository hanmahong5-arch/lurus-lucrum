/**
 * Team API — List user teams / Create a new team
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getUserTenants,
  createTenant,
} from '@/lib/services/history-service';
import { recordActivity } from '@/lib/services/activity-service';

// GET /api/team — list teams the user belongs to
export async function GET(request: NextRequest) {
  return withUser<unknown>(request, async (_req: NextRequest, user: UserContext) => {
    const teams = await getUserTenants(user.userId);
    return NextResponse.json({ success: true, data: teams });
  });
}

// POST /api/team — create a new team
export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const body = await req.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'name and slug are required' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]{2,50}$/.test(slug)) {
      return NextResponse.json(
        { success: false, error: 'slug must be 2-50 lowercase alphanumeric characters or hyphens' },
        { status: 400 }
      );
    }

    const tenant = await createTenant({
      name,
      slug,
      ownerId: user.userId,
      plan: 'free',
      maxMembers: parseInt(process.env.TEAM_MAX_MEMBERS_FREE || '5', 10),
      settings: null,
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Failed to create team. Slug may already be taken.' },
        { status: 409 }
      );
    }

    // Record activity (fire-and-forget)
    recordActivity({
      tenantId: tenant.id,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'team_updated',
      resourceType: 'team',
      resourceId: String(tenant.id),
      metadata: { action: 'created' },
      silent: true,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: tenant }, { status: 201 });
  });
}

export const dynamic = 'force-dynamic';
