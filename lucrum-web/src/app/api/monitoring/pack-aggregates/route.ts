/**
 * GET /api/monitoring/pack-aggregates — per-pack rollup over the caller's
 * pack_runs rows. Returns one row per (pack_id, pack_name) with total/success/
 * error counts, success rate, average duration + candidate count, and most-
 * recent run timestamp.
 *
 * Read-only, owner-scoped via withUser.
 *
 * @module app/api/monitoring/pack-aggregates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getPackRunAggregates,
  type PackRunAggregate,
} from '@/lib/strategy-packs/pack-run-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AggregatesResponse {
  readonly items: ReadonlyArray<PackRunAggregate>;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<AggregatesResponse | { error: string }>> {
  return withUser<AggregatesResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const items = await getPackRunAggregates(user.userId);
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `aggregate failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
