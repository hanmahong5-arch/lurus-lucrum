/**
 * Accept Invitation API — Accept a team invitation by token
 * Uses ITeamRepository for all data access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import { getTeamRepository } from '@/lib/repositories';
import { recordActivity } from '@/lib/services/activity-service';

// POST /api/team/invite/accept — accept invitation
export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }

    const repo = getTeamRepository();

    // Find the invitation
    const invite = await repo.findInvitationByToken(token);
    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invalid or already used invitation' },
        { status: 404 }
      );
    }

    // Check expiry
    if (invite.expiresAt < new Date()) {
      await repo.updateInvitationStatus(invite.id, 'expired');
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check email matches
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if already a member
    const existing = await repo.checkAccess(user.userId, invite.tenantId);
    if (existing.hasAccess) {
      await repo.updateInvitationStatus(invite.id, 'accepted');
      return NextResponse.json({ success: true, message: 'Already a member of this team' });
    }

    // Add member
    await repo.addMember(invite.tenantId, user.userId, invite.role, invite.invitedBy);
    await repo.updateInvitationStatus(invite.id, 'accepted');

    // Get team info for response
    const team = await repo.findById(invite.tenantId);

    // Record activity
    recordActivity({
      tenantId: invite.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'member_joined',
      resourceType: 'member',
      resourceId: user.userId,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        tenantId: invite.tenantId,
        teamName: team?.name ?? 'Unknown',
        teamSlug: team?.slug,
        role: invite.role,
      },
    });
  });
}

export const dynamic = 'force-dynamic';
