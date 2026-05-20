/**
 * GET /api/postmortem/[runId]
 *
 * Returns a saved postmortem run for the calling user. Reading is free
 * (no LLM call, no wallet debit) — this is the cache-hit path used by
 * the results panel when the user re-opens an old postmortem.
 *
 * @module app/api/postmortem/[runId]/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadPostmortemRun } from "@/lib/services/postmortem-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const runId = parseInt(params.runId, 10);
  if (!Number.isFinite(runId) || runId <= 0) {
    return NextResponse.json({ error: "invalid runId" }, { status: 400 });
  }

  const summary = await loadPostmortemRun(runId, session.user.id);
  if (!summary) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: summary });
}
