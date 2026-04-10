/**
 * Team Detail API — Get / Update / Delete a team
 * Uses ITeamRepository for all data access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { getTeamRepository } from '@/lib/repositories';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id] — team detail with member count
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (_req, user, tenant) => {
    const repo = getTeamRepository();
    const team = await repo.findById(tenant.tenantId);
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const memberCount = await repo.getMemberCount(tenant.tenantId);

    return NextResponse.json({
      success: true,
      data: { ...team, memberCount },
    });
  });
}

// PATCH /api/team/[id] — update team name/settings (owner/admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin'], async (req, user, tenant) => {
    const body = await req.json();
    const updates: { name?: string; settings?: string } = {};

    if (body.name) updates.name = body.name;
    if (body.settings !== undefined) {
      updates.settings = typeof body.settings === 'string' ? body.settings : JSON.stringify(body.settings);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const repo = getTeamRepository();
    await repo.update(tenant.tenantId, updates);

    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'team_updated',
      resourceType: 'team',
      resourceId: String(tenant.tenantId),
      metadata: { fields: Object.keys(updates) },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/team/[id] — delete team (owner only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner'], async (_req, user, tenant) => {
    const repo = getTeamRepository();
    await repo.delete(tenant.tenantId);
    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
