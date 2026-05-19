/**
 * Daily klines incremental update — Sprint 2 P0a.
 *
 *   POST /api/cron/klines-update
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Invoked by the K8s CronJob in deploy/k8s/cron-klines-update.yaml at
 * 10:10 UTC (= 18:10 CST) Mon–Fri. Replaces the previous in-process
 * node-cron schedule that lived inside the lucrum-web pod and was lost on
 * every pod restart (silent klines drift).
 *
 * GET is supported for ops smoke testing.
 *
 * Failure mode: per-stock failures are recorded in the result; a single
 * stock fetch error does NOT fail the sweep. The route returns 500 only
 * if the orchestration itself throws (DB unavailable, etc.).
 *
 * @module app/api/cron/klines-update/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { runIncrementalUpdate } from '@/lib/cron/incremental-updater';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${CRON_SECRET}`;
}

async function runSweep(): Promise<NextResponse> {
  try {
    const result = await runIncrementalUpdate({
      batchSize: 50,
      batchDelayMs: 1000,
    });
    return NextResponse.json({ success: true, result });
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
