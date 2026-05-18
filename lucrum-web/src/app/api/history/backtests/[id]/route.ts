/**
 * Single Backtest History API
 *
 * GET /api/history/backtests/[id] — fetch one persisted backtest record by id.
 * Powers the "在编辑器中打开 / 重新运行" deep-link from /dashboard/history:
 * the dashboard reads ?historyId=<id>, calls this endpoint, and rehydrates
 * the workspace (code + prompt + result view) exactly as it was when saved.
 *
 * Ownership check is mandatory — userId from the session must match the row.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBacktestRepository } from "@/lib/repositories";

interface RouteContext {
  readonly params: { readonly id: string };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const idNum = Number.parseInt(ctx.params.id, 10);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400 },
    );
  }

  const repo = getBacktestRepository();
  const row = await repo.findById(idNum);
  if (!row) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
  }
  // Ownership: only the user who ran the backtest may rehydrate it.
  if (row.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  // config / result are stored as JSON text. Parse defensively — a corrupt
  // record shouldn't 500 the whole endpoint.
  let parsedConfig: unknown = null;
  let parsedResult: unknown = null;
  try {
    parsedConfig = JSON.parse(row.config);
  } catch {
    parsedConfig = null;
  }
  try {
    parsedResult = JSON.parse(row.result);
  } catch {
    parsedResult = null;
  }

  return NextResponse.json({
    success: true,
    data: {
      id: row.id,
      symbol: row.symbol,
      stockName: row.stockName,
      startDate: row.startDate,
      endDate: row.endDate,
      timeframe: row.timeframe,
      config: parsedConfig,
      result: parsedResult,
      dataSource: row.dataSource,
      dataCoverage: row.dataCoverage,
      totalReturn: row.totalReturn,
      sharpeRatio: row.sharpeRatio,
      maxDrawdown: row.maxDrawdown,
      winRate: row.winRate,
      executionTime: row.executionTime,
      notes: row.notes,
      createdAt: row.createdAt,
    },
  });
}

export const dynamic = "force-dynamic";
