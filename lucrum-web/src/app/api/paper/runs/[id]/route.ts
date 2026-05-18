/**
 * Paper Trading single-run API — detail + close.
 *
 *   GET    /api/paper/runs/:id   — run + positions + recent trades
 *   DELETE /api/paper/runs/:id   — close the run (idempotent)
 *
 * @module app/api/paper/runs/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import {
  closePaperRun,
  getPaperRun,
  PaperRunNotFoundError,
  PaperRunOwnershipError,
} from '@/lib/services/paper-trading-service';

interface RouteContext {
  params: { id: string };
}

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', title: '未登录', description: '请先登录' } },
      { status: 401 },
    );
  }

  const id = parseId(context.params.id);
  if (id == null) {
    return NextResponse.json(
      { error: { code: 'INVALID_ID', title: '无效 ID', description: 'id 必须是正整数' } },
      { status: 400 },
    );
  }

  try {
    const { run, positions, recentTrades } = await getPaperRun(session.user.id, id);
    return NextResponse.json({ run, positions, recentTrades });
  } catch (err) {
    if (err instanceof PaperRunNotFoundError) {
      return NextResponse.json(
        { error: { code: err.code, title: '运行不存在', description: '指定的 paper run 不存在' } },
        { status: 404 },
      );
    }
    if (err instanceof PaperRunOwnershipError) {
      return NextResponse.json(
        { error: { code: err.code, title: '无访问权限', description: '此 paper run 不属于当前用户' } },
        { status: 403 },
      );
    }
    console.error('[api/paper/runs/:id] load failed:', err);
    return NextResponse.json(
      {
        error: {
          code: 'LOAD_FAILED',
          title: '加载失败',
          description: '服务暂时不可用',
        },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', title: '未登录', description: '请先登录' } },
      { status: 401 },
    );
  }

  const id = parseId(context.params.id);
  if (id == null) {
    return NextResponse.json(
      { error: { code: 'INVALID_ID', title: '无效 ID', description: 'id 必须是正整数' } },
      { status: 400 },
    );
  }

  try {
    const run = await closePaperRun(session.user.id, id);
    return NextResponse.json({ run });
  } catch (err) {
    if (err instanceof PaperRunNotFoundError) {
      return NextResponse.json(
        { error: { code: err.code, title: '运行不存在', description: '指定的 paper run 不存在' } },
        { status: 404 },
      );
    }
    if (err instanceof PaperRunOwnershipError) {
      return NextResponse.json(
        { error: { code: err.code, title: '无访问权限', description: '此 paper run 不属于当前用户' } },
        { status: 403 },
      );
    }
    console.error('[api/paper/runs/:id] close failed:', err);
    return NextResponse.json(
      {
        error: {
          code: 'CLOSE_FAILED',
          title: '关闭失败',
          description: '服务暂时不可用',
        },
      },
      { status: 500 },
    );
  }
}
