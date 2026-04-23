/**
 * GET /api/monitoring/backtest-health — per-user operational snapshot.
 *
 * Query params:
 *   windowDays — optional, clamped to [1, 365], default 30.
 *
 * Returns a BacktestHealthSnapshot derived from backtest_history rows owned by
 * the caller. No writes, no side effects.
 *
 * @module app/api/monitoring/backtest-health/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getBacktestHealthSnapshot,
  type BacktestHealthSnapshot,
} from '@/lib/monitoring/backtest-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
): Promise<NextResponse<BacktestHealthSnapshot | { error: string }>> {
  return withUser<BacktestHealthSnapshot | { error: string }>(
    request,
    async (req: NextRequest, user: UserContext) => {
      const { searchParams } = new URL(req.url);
      const raw = searchParams.get('windowDays');
      const windowDays = raw !== null ? Number(raw) : undefined;

      try {
        const snapshot = await getBacktestHealthSnapshot(user.userId, windowDays);
        return NextResponse.json(snapshot);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `snapshot failed: ${message}` },
          { status: 500 },
        );
      }
    },
  );
}
