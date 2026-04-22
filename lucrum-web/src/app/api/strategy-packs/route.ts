/**
 * GET /api/strategy-packs — list all strategy packs with metadata.
 * GET /api/strategy-packs?regime=<bull|bear|sideways|rebound>
 *    → ordered recommendations for that regime.
 *
 * @module app/api/strategy-packs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPacks, recommendPacks } from '@/lib/strategy-packs';
import type { Regime } from '@/lib/regime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGIMES: ReadonlyArray<Regime> = ['bull', 'bear', 'sideways', 'rebound'];

export async function GET(request: NextRequest): Promise<Response> {
  const regimeParam = request.nextUrl.searchParams.get('regime');
  if (regimeParam) {
    if (!REGIMES.includes(regimeParam as Regime)) {
      return NextResponse.json(
        { error: `regime must be one of ${REGIMES.join(', ')}` },
        { status: 400 }
      );
    }
    const recs = recommendPacks(regimeParam as Regime);
    return NextResponse.json({
      regime: regimeParam,
      recommendations: recs.map((r) => ({
        pack: r.pack,
        fit: r.fit,
        rationale: r.rationale,
      })),
    });
  }

  return NextResponse.json({ packs: listPacks() });
}
