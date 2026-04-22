/**
 * POST /api/strategy-packs/dial — run a synthesized pack from style dial values.
 *
 * Accepts { dial, universe, asOfDate?, topN?, userId? } and synthesizes a
 * full StrategyPack server-side, then streams the same SSE frames as the
 * preset-pack route (pack-meta + funnel events).
 *
 * @module app/api/strategy-packs/dial/route
 */

import { NextRequest } from 'next/server';
import {
  runPackDirect,
  synthesizePack,
  validateDial,
} from '@/lib/strategy-packs';
import type { FunnelEvent } from '@/lib/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DialRunPayload {
  dial: unknown;
  universe: {
    kind: 'sector' | 'symbols';
    sectorCode?: string;
    symbols?: string[];
  };
  asOfDate?: string;
  topN?: number;
  userId?: string;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

function frame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function errorFrame(message: string, code: string): string {
  return frame({ kind: 'error', message, code });
}

function validate(body: unknown): DialRunPayload | string {
  if (!body || typeof body !== 'object') return 'body must be JSON';
  const b = body as Record<string, unknown>;
  if (!b.dial) return 'dial required';
  const u = b.universe as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return 'universe required';
  if (u.kind !== 'sector' && u.kind !== 'symbols') {
    return 'universe.kind must be sector|symbols';
  }
  if (u.kind === 'sector' && typeof u.sectorCode !== 'string') {
    return 'universe.sectorCode required for kind=sector';
  }
  if (u.kind === 'symbols' && !Array.isArray(u.symbols)) {
    return 'universe.symbols[] required for kind=symbols';
  }
  return b as unknown as DialRunPayload;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(errorFrame('invalid JSON', 'BAD_JSON'), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const parsed = validate(body);
  if (typeof parsed === 'string') {
    return new Response(errorFrame(parsed, 'VALIDATION'), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const dialResult = validateDial(parsed.dial);
  if (typeof dialResult === 'string') {
    return new Response(errorFrame(dialResult, 'BAD_DIAL'), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const pack = synthesizePack(dialResult);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(frame(payload)));
        } catch {
          /* client disconnected */
        }
      };

      send({
        kind: 'pack-meta',
        pack: {
          id: pack.id,
          name: pack.name,
          tagline: pack.tagline,
          description: pack.description,
          riskLevel: pack.riskLevel,
          holdingHorizon: pack.holdingHorizon,
          regimeFit: pack.regimeFit,
          expectedProfile: pack.expectedProfile,
        },
        dial: dialResult,
        synthesized: {
          factorWeights: pack.factorWeights,
          leaderWeight: pack.leaderWeight,
          topN: pack.portfolio.topN,
          klineWindow: pack.klineWindow,
          hardFilter: pack.hardFilter,
        },
      });

      try {
        await runPackDirect({
          pack,
          universe: parsed.universe,
          asOfDate: parsed.asOfDate,
          topN: parsed.topN,
          userId: parsed.userId,
          runIdPrefix: 'dial',
          onEvent: (event: FunnelEvent) => send(event),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ kind: 'error', message, code: 'DIAL_THREW' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
