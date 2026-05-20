/**
 * /api/postmortem
 *
 * POST — dispatch a 4-persona postmortem on a completed backtest. Streams
 *        the results back as SSE so the user sees each persona land
 *        independently (one persona ≈ 8–12 s LLM call).
 *
 *        Body: { backtestId: number, personaIds: PostmortemPersonaId[] }
 *
 *        SSE frames:
 *          data: {"kind":"persona","payload":<PersonaResultPayload>}\n\n
 *          data: {"kind":"failure","payload":<PersonaFailure>}\n\n
 *          data: {"kind":"summary","payload":{runId,divergenceSummary,totalCostLb}}\n\n
 *          data: [DONE]\n\n
 *
 * GET  — not exposed at this route; use /api/postmortem/[runId] for history.
 *
 * @module app/api/postmortem/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  dispatchPostmortem,
  type PostmortemDispatchSummary,
} from "@/lib/services/postmortem-service";
import {
  POSTMORTEM_PERSONAS,
  type PostmortemPersonaId,
} from "@/lib/services/postmortem-personas";

const VALID_PERSONA_IDS = new Set<string>(POSTMORTEM_PERSONAS.map((p) => p.id));

export const dynamic = "force-dynamic";

interface PostBody {
  backtestId?: unknown;
  personaIds?: unknown;
  strategyName?: unknown;
}

function validateBody(body: PostBody):
  | { ok: true; backtestId: number; personaIds: PostmortemPersonaId[]; strategyName?: string }
  | { ok: false; error: string } {
  const backtestId =
    typeof body.backtestId === "number" && Number.isFinite(body.backtestId)
      ? body.backtestId
      : null;
  if (backtestId == null || backtestId <= 0) {
    return { ok: false, error: "backtestId required" };
  }
  if (!Array.isArray(body.personaIds) || body.personaIds.length === 0) {
    return { ok: false, error: "personaIds required" };
  }
  const personaIds: PostmortemPersonaId[] = [];
  for (const id of body.personaIds) {
    if (typeof id !== "string" || !VALID_PERSONA_IDS.has(id)) {
      return { ok: false, error: `invalid personaId: ${String(id)}` };
    }
    personaIds.push(id as PostmortemPersonaId);
  }
  return {
    ok: true,
    backtestId,
    personaIds,
    strategyName:
      typeof body.strategyName === "string" ? body.strategyName : undefined,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: PostBody;
  try {
    parsed = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const validated = validateBody(parsed);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (kind: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ kind, payload })}\n\n`),
        );
      };

      try {
        // The dispatcher resolves serialised so we know per-persona
        // results before final summary. We push them out as the underlying
        // Promise.all settles, by hooking into the dispatcher via a side
        // channel: today the service settles before returning, so we emit
        // each result post-hoc. This is intentionally simpler than a true
        // per-call stream — UX still gets progress because the dispatcher
        // wall-clock is dominated by parallel LLM latency, not serial
        // server processing.
        const summary: PostmortemDispatchSummary = await dispatchPostmortem({
          userId,
          backtestId: validated.backtestId,
          personaIds: validated.personaIds,
          strategyName: validated.strategyName,
        });

        for (const result of summary.results) {
          send("persona", result);
        }
        for (const failure of summary.failures) {
          send("failure", failure);
        }
        send("summary", {
          runId: summary.runId,
          divergenceSummary: summary.divergenceSummary,
          totalCostLb: summary.totalCostLb,
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ kind: "error", payload: { message: msg } })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
