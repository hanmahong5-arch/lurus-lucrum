/**
 * GET /api/monitoring/alpha-trend
 *
 * Returns the recent-N pack-run forward-return rollups at a single (horizon,
 * topN) cohort, ordered chronologically by as_of_date. Powers the "Alpha
 * 趋势" sparkline on /dashboard/monitoring — the answer to "is my alpha
 * decaying?", not "what was the absolute return on Tuesday?".
 *
 * Owner-scoped via withUser; only the caller's runs are returned.
 *
 * Query params:
 *   horizon (default 20, range 1..120)
 *   topN    (default 10, range 1..50)
 *   limit   (default 20, range 1..100)
 *
 * @module app/api/monitoring/alpha-trend/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { withUser, type UserContext } from '@/lib/auth';
import { db } from '@/lib/db';
import { packRuns, packRunPerformance } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TrendPoint {
  readonly runId: string;
  readonly asOfDate: string;
  readonly packId: string | null;
  readonly packName: string | null;
  readonly evaluatedCount: number;
  readonly meanReturn: number | null;
  readonly benchmarkReturn: number | null;
  readonly excessMeanReturn: number | null;
  readonly computedAt: string;
}

interface TrendResponse {
  readonly horizon: number;
  readonly topN: number;
  readonly items: ReadonlyArray<TrendPoint>;
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (raw === null) return def;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<TrendResponse | { error: string }>> {
  const url = new URL(request.url);
  const horizon = clampInt(url.searchParams.get('horizon'), 20, 1, 120);
  const topN = clampInt(url.searchParams.get('topN'), 10, 1, 50);
  const limit = clampInt(url.searchParams.get('limit'), 20, 1, 100);

  return withUser<TrendResponse | { error: string }>(
    request,
    async (_req: NextRequest, user: UserContext) => {
      try {
        const rows = await db
          .select({
            runId: packRuns.runId,
            asOfDate: packRuns.asOfDate,
            packId: packRuns.packId,
            packName: packRuns.packName,
            evaluatedCount: packRunPerformance.evaluatedCount,
            meanReturn: packRunPerformance.meanReturn,
            benchmarkReturn: packRunPerformance.benchmarkReturn,
            excessMeanReturn: packRunPerformance.excessMeanReturn,
            computedAt: packRunPerformance.computedAt,
          })
          .from(packRuns)
          .innerJoin(
            packRunPerformance,
            eq(packRunPerformance.runId, packRuns.runId),
          )
          .where(
            and(
              eq(packRuns.userId, user.userId),
              eq(packRuns.status, 'success'),
              eq(packRunPerformance.horizonDays, horizon),
              eq(packRunPerformance.topN, topN),
            ),
          )
          // Chronological — UI plots oldest → newest left-to-right
          .orderBy(
            desc(packRuns.asOfDate),
            sql`${packRuns.createdAt} DESC`,
          )
          .limit(limit);

        const items: TrendPoint[] = rows
          .map((r) => ({
            runId: r.runId,
            asOfDate: r.asOfDate,
            packId: r.packId,
            packName: r.packName,
            evaluatedCount: r.evaluatedCount,
            meanReturn: r.meanReturn,
            benchmarkReturn: r.benchmarkReturn,
            excessMeanReturn: r.excessMeanReturn,
            computedAt: r.computedAt.toISOString(),
          }))
          .reverse(); // oldest first for left-to-right rendering

        return NextResponse.json({ horizon, topN, items });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `alpha-trend fetch failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
