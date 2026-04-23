/**
 * GET /api/monitoring/pack-runs/:runId/stages — per-stage evaluations for
 * a single run. Owner-scoped via withUser; returns an empty array if the
 * run isn't found or isn't owned by the caller.
 *
 * @module app/api/monitoring/pack-runs/[runId]/stages/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getPackRunStages,
  type PackRunStageRow,
} from '@/lib/strategy-packs/pack-run-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StagesResponse {
  readonly items: ReadonlyArray<PackRunStageRow>;
}

interface RouteContext {
  readonly params: { readonly runId: string };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<StagesResponse | { error: string }>> {
  const { runId } = context.params;
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  return withUser<StagesResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const items = await getPackRunStages(user.userId, runId);
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `stages fetch failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
