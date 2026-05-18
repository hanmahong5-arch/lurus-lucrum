/**
 * Paper Trading runs API — list + create.
 *
 *   GET  /api/paper/runs                 — list current user's runs
 *   POST /api/paper/runs                 — create a new run
 *
 * Sprint 1 skeleton. The "start a run" path is wired so the LiveSignalCard
 * 纸上跑一遍 CTA has a real endpoint; the background mark-to-market
 * sweep that actually moves positions arrives in Sprint 2.
 *
 * @module app/api/paper/runs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import {
  createPaperRun,
  listPaperRunsForUser,
  PaperRunStateError,
  type CreatePaperRunInput,
} from '@/lib/services/paper-trading-service';

// ---------------------------------------------------------------------------
// GET — list runs
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', title: '未登录', description: '请先登录' } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');

  const status =
    statusParam === 'active' || statusParam === 'paused' || statusParam === 'closed'
      ? statusParam
      : undefined;
  const limit = (() => {
    if (!limitParam) return undefined;
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) return undefined;
    return n;
  })();

  const runs = await listPaperRunsForUser(session.user.id, { status, limit });
  return NextResponse.json({ runs });
}

// ---------------------------------------------------------------------------
// POST — create run
// ---------------------------------------------------------------------------

interface CreateRunBody {
  strategy_history_id?: number | null;
  marketplace_strategy_id?: number | null;
  initial_capital?: number;
  strategy_name?: string | null;
  symbol?: string | null;
  seed_position?: {
    symbol: string;
    qty: number;
    avg_cost: number;
  } | null;
}

function parseInteger(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.trunc(v);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', title: '未登录', description: '请先登录' } },
      { status: 401 },
    );
  }

  let body: CreateRunBody;
  try {
    body = (await request.json()) as CreateRunBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', title: '请求格式错误', description: '无法解析 JSON' } },
      { status: 400 },
    );
  }

  // Validate provenance — accept any of: history id, marketplace id, or a
  // (strategy_name + symbol) pair for the LiveSignalCard "just-ran-a-backtest"
  // case where the strategy may not have been persisted yet. An orphan run
  // with neither id nor descriptive metadata is rejected — there'd be
  // nothing to render in the runs list later.
  const strategyHistoryId = parseInteger(body.strategy_history_id);
  const marketplaceStrategyId = parseInteger(body.marketplace_strategy_id);
  const strategyName = body.strategy_name?.trim() || '';
  const symbol = body.symbol?.trim() || '';
  const hasDescriptiveMetadata = strategyName.length > 0 && symbol.length > 0;
  if (strategyHistoryId == null && marketplaceStrategyId == null && !hasDescriptiveMetadata) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_STRATEGY',
          title: '缺少策略来源',
          description:
            '必须提供 strategy_history_id / marketplace_strategy_id,或同时提供 strategy_name + symbol',
        },
      },
      { status: 400 },
    );
  }

  // Validate seed position shape if provided. Reject silently-broken inputs
  // (e.g., negative qty) rather than persisting garbage.
  let seedPosition: CreatePaperRunInput['seedPosition'] = null;
  if (body.seed_position) {
    const { symbol, qty, avg_cost } = body.seed_position;
    if (
      typeof symbol !== 'string' ||
      !symbol.trim() ||
      typeof qty !== 'number' ||
      !Number.isInteger(qty) ||
      qty <= 0 ||
      typeof avg_cost !== 'number' ||
      !Number.isFinite(avg_cost) ||
      avg_cost <= 0
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SEED_POSITION',
            title: '初始持仓数据无效',
            description: 'seed_position.{symbol,qty,avg_cost} 全部必填且为正',
          },
        },
        { status: 400 },
      );
    }
    seedPosition = { symbol: symbol.trim(), qty, avgCost: avg_cost };
  }

  try {
    const run = await createPaperRun({
      userId: session.user.id,
      strategyHistoryId,
      marketplaceStrategyId,
      initialCapital: body.initial_capital,
      strategyName: strategyName || null,
      symbol: symbol || null,
      seedPosition,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    if (err instanceof PaperRunStateError) {
      return NextResponse.json(
        { error: { code: err.code, title: '参数无效', description: err.message } },
        { status: 400 },
      );
    }
    console.error('[api/paper/runs] create failed:', err);
    return NextResponse.json(
      {
        error: {
          code: 'CREATE_FAILED',
          title: '创建失败',
          description: '服务暂时不可用,请稍后重试',
        },
      },
      { status: 500 },
    );
  }
}
