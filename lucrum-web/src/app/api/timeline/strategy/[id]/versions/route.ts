/**
 * Strategy versions endpoint — chronological list of saved `strategy_versions`
 * snapshots for a single strategy_history row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import { getStrategyVersions } from '@/lib/services/user-event-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withUser<unknown>(request, async (_req: NextRequest, _user: UserContext) => {
    const strategyId = parseInt(params.id, 10);
    if (!Number.isFinite(strategyId)) {
      return NextResponse.json(
        { success: false, error: 'invalid id' },
        { status: 400 },
      );
    }

    const versions = await getStrategyVersions(strategyId);
    return NextResponse.json({ success: true, data: versions });
  });
}

export const dynamic = 'force-dynamic';
