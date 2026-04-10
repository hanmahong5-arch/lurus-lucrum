/**
 * Team Invite API — Send an invitation
 * Uses ITeamRepository for all data access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { getTeamRepository } from '@/lib/repositories';
import { randomBytes } from 'crypto';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/team/[id]/invite — send invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin'], async (req, user, tenant) => {
    const body = await req.json();
    const { email, role = 'member' } = body as { email?: string; role?: string };

    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }

    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const repo = getTeamRepository();

    // Check max members
    const team = await repo.findById(tenant.tenantId);
    const maxMembers = team?.maxMembers ?? 5;
    const memberCount = await repo.getMemberCount(tenant.tenantId);

    if (memberCount >= maxMembers) {
      return NextResponse.json(
        { success: false, error: `Team has reached the maximum of ${maxMembers} members` },
        { status: 403 }
      );
    }

    // Check for pending invitation
    if (await repo.hasPendingInvitation(tenant.tenantId, email)) {
      return NextResponse.json(
        { success: false, error: 'An invitation is already pending for this email' },
        { status: 409 }
      );
    }

    // Create invitation
    const token = randomBytes(32).toString('hex');
    const expiryHours = parseInt(process.env.TEAM_INVITE_EXPIRY_HOURS || '72', 10);
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    const invitation = await repo.createInvitation({
      tenantId: tenant.tenantId,
      email,
      role,
      token,
      invitedBy: user.userId,
      expiresAt,
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Failed to create invitation' }, { status: 500 });
    }

    // Record activity
    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'member_invited',
      resourceType: 'member',
      metadata: { inviteeEmail: email, role },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email,
        role,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    }, { status: 201 });
  });
}

export const dynamic = 'force-dynamic';
