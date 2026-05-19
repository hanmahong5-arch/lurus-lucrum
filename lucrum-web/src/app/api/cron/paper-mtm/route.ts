/**
 * Paper Trading mark-to-market cron entry.
 *
 *   POST /api/cron/paper-mtm
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Invoked by the K8s CronJob defined in deploy/k8s/cron-paper-mtm.yaml,
 * scheduled to run shortly after A-share close (15:00 CST = 07:00 UTC) on
 * trading days. The route is also callable from any internal source with
 * the shared secret — handy for backfill or manual reruns.
 *
 * Returns a summary JSON of how many runs were swept, succeeded, skipped,
 * and failed. Errors are per-run, not fatal to the sweep.
 *
 * GET is supported for ops smoke testing — same auth, runs the sweep too.
 *
 * @module app/api/cron/paper-mtm/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { tickAllActiveRuns } from '@/lib/services/paper-engine';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    // Missing secret is a config error — refuse all traffic so we don't
    // silently expose the endpoint to the open internet.
    return false;
  }
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${CRON_SECRET}`;
  return header === expected;
}

async function runSweep(): Promise<NextResponse> {
  try {
    const report = await tickAllActiveRuns();
    return NextResponse.json({ success: true, report });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runSweep();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runSweep();
}
