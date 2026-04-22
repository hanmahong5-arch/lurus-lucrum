/**
 * POST /api/backtest/gate — run validation gates against a backtest result.
 *
 * Request body:
 *   {
 *     selectedReturns: number[],           // daily returns of chosen params
 *     trialReturns?: number[][],           // other candidate series (for PBO/DSR)
 *     trialsCount?: number,
 *     walkForwardCandidates?: { id, returns: number[] }[],
 *     thresholds?: Partial<GateThresholds>
 *   }
 *
 * Response: GateReport JSON.
 *
 * @module app/api/backtest/gate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { runGates, type GateThresholds } from '@/lib/backtest/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WalkForwardCandidatePayload {
  id: string;
  returns: number[];
}

interface GateRequest {
  selectedReturns: number[];
  trialReturns?: number[][];
  trialsCount?: number;
  walkForwardCandidates?: WalkForwardCandidatePayload[];
  thresholds?: Partial<GateThresholds>;
}

function isNumericArray(x: unknown): x is number[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'number' && Number.isFinite(v));
}

function validate(body: unknown): GateRequest | string {
  if (!body || typeof body !== 'object') return 'body must be JSON object';
  const b = body as Record<string, unknown>;
  if (!isNumericArray(b.selectedReturns)) return 'selectedReturns must be number[]';
  const req: GateRequest = { selectedReturns: b.selectedReturns };
  if (b.trialReturns !== undefined) {
    if (!Array.isArray(b.trialReturns) || !b.trialReturns.every(isNumericArray)) {
      return 'trialReturns must be number[][]';
    }
    req.trialReturns = b.trialReturns;
  }
  if (typeof b.trialsCount === 'number') {
    req.trialsCount = b.trialsCount;
  }
  if (Array.isArray(b.walkForwardCandidates)) {
    for (const c of b.walkForwardCandidates) {
      if (
        !c ||
        typeof (c as { id?: unknown }).id !== 'string' ||
        !isNumericArray((c as { returns?: unknown }).returns)
      ) {
        return 'walkForwardCandidates[].{id,returns} malformed';
      }
    }
    req.walkForwardCandidates = b.walkForwardCandidates as WalkForwardCandidatePayload[];
  }
  if (b.thresholds && typeof b.thresholds === 'object') {
    req.thresholds = b.thresholds as Partial<GateThresholds>;
  }
  return req;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = validate(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const walkForwardCandidates = parsed.walkForwardCandidates;
  const wfArgs = walkForwardCandidates
    ? {
        walkForwardCandidates: walkForwardCandidates.map((c) => ({
          id: c.id,
          params: {},
        })),
        walkForwardSeries: (id: string) => {
          const found = walkForwardCandidates.find((c) => c.id === id);
          return found?.returns ?? [];
        },
        walkForwardSeriesLength: walkForwardCandidates[0]?.returns.length ?? 0,
      }
    : {};

  try {
    const report = runGates({
      selectedReturns: parsed.selectedReturns,
      trialReturns: parsed.trialReturns,
      trialsCount: parsed.trialsCount,
      thresholds: parsed.thresholds,
      ...wfArgs,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
