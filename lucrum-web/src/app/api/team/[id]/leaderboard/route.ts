/**
 * Team Leaderboard API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { getTeamLeaderboard } from '@/lib/services/leaderboard-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id]/leaderboard?period=weekly
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (req, _user, tenant) => {
    const period = (req.nextUrl.searchParams.get('period') || 'weekly') as 'weekly' | 'monthly' | 'all_time';

    const result = await getTeamLeaderboard(tenant.tenantId, period);
    return NextResponse.json({ success: true, data: result });
  });
}

export const dynamic = 'force-dynamic';
