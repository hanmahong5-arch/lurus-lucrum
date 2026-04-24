/**
 * Pack-run forward-return endpoints (alpha-decay).
 *
 *   GET  /api/monitoring/pack-runs/:runId/performance
 *        -> cached rollups from pack_run_performance (empty if never computed)
 *
 *   POST /api/monitoring/pack-runs/:runId/performance
 *        body: { horizons?: number[], topN?: number }
 *        -> computes forward returns from kline_daily, upserts into
 *           pack_run_performance, and returns the fresh rows.
 *
 * Owner-scoped via withUser; returns empty array if the run is not owned
 * by the caller (same pattern as the stages endpoint).
 *
 * @module app/api/monitoring/pack-runs/[runId]/performance/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  computePackRunPerformance,
  getPackRunPerformance,
  type PackRunPerformanceRow,
} from '@/lib/strategy-packs/pack-run-performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PerformanceResponse {
  readonly items: ReadonlyArray<PackRunPerformanceRow>;
}

interface RouteContext {
  readonly params: { readonly runId: string };
}

function validateRunId(runId: string): string | null {
  if (!runId) return 'runId required';
  if (runId.length > 100) return 'runId too long';
  return null;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<PerformanceResponse | { error: string }>> {
  const { runId } = context.params;
  const badReq = validateRunId(runId);
  if (badReq) return NextResponse.json({ error: badReq }, { status: 400 });

  return withUser<PerformanceResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const items = await getPackRunPerformance(user.userId, runId);
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `performance fetch failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}

interface ComputeBody {
  readonly horizons?: ReadonlyArray<number>;
  readonly topN?: number;
}

function parseBody(raw: unknown): ComputeBody {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  const out: { horizons?: number[]; topN?: number } = {};
  if (Array.isArray(body.horizons)) {
    const horizons: number[] = [];
    for (const h of body.horizons) {
      if (typeof h === 'number' && Number.isFinite(h)) horizons.push(h);
    }
    if (horizons.length > 0) out.horizons = horizons;
  }
  if (typeof body.topN === 'number' && Number.isFinite(body.topN)) {
    out.topN = body.topN;
  }
  return out;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<PerformanceResponse | { error: string }>> {
  const { runId } = context.params;
  const badReq = validateRunId(runId);
  if (badReq) return NextResponse.json({ error: badReq }, { status: 400 });

  let body: ComputeBody = {};
  try {
    const raw = await request.json().catch(() => null);
    body = parseBody(raw);
  } catch {
    body = {};
  }

  return withUser<PerformanceResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const items = await computePackRunPerformance(
          user.userId,
          runId,
          body,
        );
        return NextResponse.json({ items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `performance compute failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
