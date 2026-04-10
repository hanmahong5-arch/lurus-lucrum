/**
 * Team Members API — List / Update role / Remove members
 * Uses ITeamRepository for all data access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { getTeamRepository } from '@/lib/repositories';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id]/members — list members with user info
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (_req, _user, tenant) => {
    const repo = getTeamRepository();
    const members = await repo.getMembers(tenant.tenantId);
    return NextResponse.json({ success: true, data: members });
  });
}

// PATCH /api/team/[id]/members — update member role (owner/admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin'], async (req, user, tenant) => {
    const body = await req.json();
    const { userId: targetUserId, role } = body as { userId?: string; role?: string };

    if (!targetUserId || !role) {
      return NextResponse.json(
        { success: false, error: 'userId and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const repo = getTeamRepository();

    // Check target member exists and their current role
    const access = await repo.checkAccess(targetUserId, tenant.tenantId);
    if (!access.hasAccess) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }
    if (access.role === 'owner') {
      return NextResponse.json({ success: false, error: 'Cannot change the owner role' }, { status: 403 });
    }
    if (tenant.role === 'admin' && role === 'admin') {
      return NextResponse.json({ success: false, error: 'Only the owner can promote to admin' }, { status: 403 });
    }

    await repo.updateMemberRole(tenant.tenantId, targetUserId, role);

    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'member_role_changed',
      resourceType: 'member',
      resourceId: targetUserId,
      metadata: { newRole: role, previousRole: access.role },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/team/[id]/members — remove a member (owner/admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin'], async (req, user, tenant) => {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'userId query param required' }, { status: 400 });
    }

    const repo = getTeamRepository();

    const access = await repo.checkAccess(targetUserId, tenant.tenantId);
    if (!access.hasAccess) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }
    if (access.role === 'owner') {
      return NextResponse.json({ success: false, error: 'Cannot remove the team owner' }, { status: 403 });
    }
    if (tenant.role === 'admin' && access.role === 'admin') {
      return NextResponse.json({ success: false, error: 'Admins cannot remove other admins' }, { status: 403 });
    }

    await repo.removeMember(tenant.tenantId, targetUserId);

    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'member_removed',
      resourceType: 'member',
      resourceId: targetUserId,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
