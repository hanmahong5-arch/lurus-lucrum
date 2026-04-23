/**
 * GET /api/monitoring/pack-runs — recent funnel / pack pipeline executions.
 *
 * Query params:
 *   limit — optional, clamped to [1, 100], default 20.
 *
 * Returns the caller's own rows sorted by createdAt DESC. Read-only.
 *
 * @module app/api/monitoring/pack-runs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getRecentPackRuns,
  type PackRunListItem,
} from '@/lib/strategy-packs/pack-run-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ListResponse {
  readonly items: ReadonlyArray<PackRunListItem>;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ListResponse | { error: string }>> {
  return withUser<ListResponse | { error: string }>(
    request,
    async (req: NextRequest, user: UserContext) => {
      const { searchParams } = new URL(req.url);
      const raw = searchParams.get('limit');
      const limit = raw !== null ? Number(raw) : undefined;

      try {
        const items = await getRecentPackRuns(user.userId, limit);
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `list failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
