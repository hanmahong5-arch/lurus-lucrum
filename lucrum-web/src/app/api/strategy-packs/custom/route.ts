/**
 * POST /api/strategy-packs/custom — run a user-tuned pack.
 *
 * Request body:
 *   {
 *     basePackId: StrategyPackId,
 *     override:   PackOverride (partial),
 *     universe:   { kind, sectorCode?, symbols? },
 *     asOfDate?: string,
 *     userId?:   string
 *   }
 *
 * Server resolves the base pack, merges the override (with clamping &
 * validation), then runs the pipeline and streams pack-meta + funnel
 * events. Rejects unknown factor IDs and out-of-range weights.
 *
 * @module app/api/strategy-packs/custom/route
 */

import { NextRequest } from 'next/server';
import {
  applyOverride,
  getPack,
  runPackDirect,
  validateOverride,
  type StrategyPackId,
} from '@/lib/strategy-packs';
import type { FunnelEvent } from '@/lib/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CustomRunPayload {
  basePackId: StrategyPackId;
  override?: unknown;
  universe: {
    kind: 'sector' | 'symbols';
    sectorCode?: string;
    symbols?: string[];
  };
  asOfDate?: string;
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

function validate(body: unknown): CustomRunPayload | string {
  if (!body || typeof body !== 'object') return 'body must be JSON';
  const b = body as Record<string, unknown>;
  if (typeof b.basePackId !== 'string') return 'basePackId required';
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
  return b as unknown as CustomRunPayload;
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

  const basePack = getPack(parsed.basePackId);
  if (!basePack) {
    return new Response(
      errorFrame(`unknown basePackId: ${parsed.basePackId}`, 'UNKNOWN_PACK'),
      { status: 404, headers: SSE_HEADERS }
    );
  }

  const overrideResult = validateOverride(parsed.override);
  if (typeof overrideResult === 'string') {
    return new Response(errorFrame(overrideResult, 'BAD_OVERRIDE'), {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const pack = applyOverride(basePack, overrideResult);

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
          name: `${pack.name} (自定义)`,
          tagline: pack.tagline,
          description: pack.description,
          riskLevel: pack.riskLevel,
          holdingHorizon: pack.holdingHorizon,
          regimeFit: pack.regimeFit,
          expectedProfile: pack.expectedProfile,
        },
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
          userId: parsed.userId,
          runIdPrefix: `custom-${basePack.id}`,
          onEvent: (event: FunnelEvent) => send(event),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ kind: 'error', message, code: 'CUSTOM_THREW' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
