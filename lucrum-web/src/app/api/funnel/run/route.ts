/**
 * POST /api/funnel/run — Stock Selection Funnel (v2)
 *
 * Streams Server-Sent Events as the selection pipeline executes each stage.
 * Gated behind `NEXT_PUBLIC_FUNNEL_V2` on the client; server-side the route
 * is always available so we can integration-test before flipping the flag.
 *
 * Request shape:
 *   {
 *     universe: { kind: 'sector' | 'symbols' | 'all', sectorCode?, symbols? },
 *     asOfDate?: string,   // YYYY-MM-DD, default today
 *     hardFilter?: HardFilterOptions,
 *     portfolio?: { topN?: number },
 *     maxUniverseSize?: number
 *   }
 *
 * Event payloads are JSON serialisations of `FunnelEvent` from
 * `@/lib/funnel/types`.
 *
 * @module app/api/funnel/run/route
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyZitadelJWT } from '@/lib/auth/jwt-verify';
import {
  runPipeline,
  createFunnelContext,
  type FunnelEvent,
} from '@/lib/funnel';
import {
  makeDefaultFunnel,
  type DefaultFunnelOptions,
} from '@/lib/funnel/stages';
import { persistPackRun } from '@/lib/strategy-packs/pack-run-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FunnelRunRequest {
  universe: {
    kind: 'sector' | 'symbols' | 'all';
    sectorCode?: string;
    symbols?: string[];
  };
  asOfDate?: string;
  hardFilter?: DefaultFunnelOptions['hardFilter'];
  portfolio?: DefaultFunnelOptions['portfolio'];
  maxUniverseSize?: number;
}

/**
 * Resolve the calling user from session or Bearer JWT. Returns the Zitadel
 * `sub`, never accepting userId from the request body — callers MUST NOT be
 * able to attribute funnel runs to arbitrary users.
 */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const claims = await verifyZitadelJWT(auth.slice(7));
    if (claims?.sub) return claims.sub;
  }
  return null;
}

function sseFrame(event: FunnelEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function errorFrame(message: string, code: string): string {
  return `data: ${JSON.stringify({ kind: 'error', message, code })}\n\n`;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

function validate(body: unknown): FunnelRunRequest | string {
  if (!body || typeof body !== 'object') return 'body must be a JSON object';
  const b = body as Record<string, unknown>;
  const universe = b.universe as Record<string, unknown> | undefined;
  if (!universe || typeof universe !== 'object') {
    return 'universe is required';
  }
  const kind = universe.kind;
  if (kind !== 'sector' && kind !== 'symbols' && kind !== 'all') {
    return 'universe.kind must be "sector" | "symbols" | "all"';
  }
  if (kind === 'sector' && typeof universe.sectorCode !== 'string') {
    return 'universe.sectorCode required when kind=sector';
  }
  if (kind === 'symbols' && !Array.isArray(universe.symbols)) {
    return 'universe.symbols[] required when kind=symbols';
  }
  return b as unknown as FunnelRunRequest;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await resolveUserId(request);
  if (!userId) {
    return new Response(errorFrame('login required', 'AUTH_NO_SESSION'), {
      status: 401,
      headers: SSE_HEADERS,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(errorFrame('invalid JSON body', 'BAD_JSON'), {
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: FunnelEvent) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(event)));
        } catch {
          // client disconnected — subsequent writes are no-ops
        }
      };

      try {
        const context = createFunnelContext({
          asOfDate: parsed.asOfDate,
          options: { ...parsed },
          userId,
          runIdPrefix: 'funnel-v2',
        });

        const stages = makeDefaultFunnel({
          universe: {
            spec: {
              kind: parsed.universe.kind,
              sectorCode: parsed.universe.sectorCode,
              symbols: parsed.universe.symbols,
            },
            maxSize: parsed.maxUniverseSize,
          },
          hardFilter: parsed.hardFilter,
          portfolio: parsed.portfolio,
        });

        const result = await runPipeline({
          stages,
          context,
          onEvent: send,
        });

        await persistPackRun({
          context,
          result,
          universe: {
            kind: parsed.universe.kind,
            sectorCode: parsed.universe.sectorCode,
            symbols: parsed.universe.symbols,
          },
          topN: parsed.portfolio?.topN,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(errorFrame(message, 'PIPELINE_THREW'))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
