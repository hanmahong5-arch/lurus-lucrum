/**
 * GET/HEAD /api/health — connectivity probe.
 *
 * Used by useNetworkStatus's 30s ping to verify the app is reachable.
 * Must be cheap (no DB / no auth) and respond fast — slowness here is
 * indistinguishable from a real network outage and triggers the
 * "网络连接中断" banner across the app.
 *
 * @module app/api/health/route
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { status: 'ok' },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function HEAD(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
