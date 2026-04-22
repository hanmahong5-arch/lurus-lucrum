/**
 * POST /api/strategy-packs/run — execute a preset pack against a universe.
 *
 * Streams the same FunnelEvent SSE frames as /api/funnel/run but prefixed
 * with a `pack-meta` event describing the pack that was selected, so the
 * UI can render the pack card above the progress output.
 *
 * Request body:
 *   {
 *     packId: StrategyPackId,
 *     universe: { kind: 'sector'|'symbols', sectorCode?, symbols? },
 *     asOfDate?: string,
 *     topN?: number,
 *     userId?: string
 *   }
 *
 * @module app/api/strategy-packs/run/route
 */

import { NextRequest } from 'next/server';
import { runPack, getPack, type StrategyPackId } from '@/lib/strategy-packs';
import type { FunnelEvent } from '@/lib/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PackRunPayload {
  packId: StrategyPackId;
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

function validate(body: unknown): PackRunPayload | string {
  if (!body || typeof body !== 'object') return 'body must be JSON';
  const b = body as Record<string, unknown>;
  if (typeof b.packId !== 'string') return 'packId required';
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
  return b as unknown as PackRunPayload;
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

  const pack = getPack(parsed.packId);
  if (!pack) {
    return new Response(
      errorFrame(`unknown packId: ${parsed.packId}`, 'UNKNOWN_PACK'),
      { status: 404, headers: SSE_HEADERS }
    );
  }

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

      // Pack metadata frame so the UI can render the card immediately.
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
      });

      try {
        await runPack({
          request: {
            packId: parsed.packId,
            universe: parsed.universe,
            asOfDate: parsed.asOfDate,
            topN: parsed.topN,
            userId: parsed.userId,
          },
          onEvent: (event: FunnelEvent) => send(event),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ kind: 'error', message, code: 'PACK_THREW' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
