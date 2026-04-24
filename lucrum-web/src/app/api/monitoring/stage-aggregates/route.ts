/**
 * GET /api/monitoring/stage-aggregates — per-stage rollup across the caller's
 * pack_run_stages rows (owner-scoped via join to pack_runs). Returns one row
 * per stage_name with totals, averages, and warning rate.
 *
 * Read-only, owner-scoped via withUser.
 *
 * @module app/api/monitoring/stage-aggregates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getStageAggregates,
  type StageAggregate,
} from '@/lib/strategy-packs/pack-run-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StageAggregatesResponse {
  readonly items: ReadonlyArray<StageAggregate>;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<StageAggregatesResponse | { error: string }>> {
  return withUser<StageAggregatesResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const items = await getStageAggregates(user.userId);
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `stage aggregate failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
