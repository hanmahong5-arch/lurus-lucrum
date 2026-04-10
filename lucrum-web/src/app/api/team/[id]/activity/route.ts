/**
 * Team Activity API — Paginated activity feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { getTeamActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id]/activity?before=123&limit=30
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (req, _user, tenant) => {
    const { searchParams } = new URL(req.url);
    const before = searchParams.get('before');
    const limit = searchParams.get('limit');

    const result = await getTeamActivity(tenant.tenantId, {
      before: before ? parseInt(before, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 30,
    });

    return NextResponse.json({ success: true, ...result });
  });
}

export const dynamic = 'force-dynamic';
