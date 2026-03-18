/**
 * History API Route
 * 历史记录API路由
 *
 * Endpoints:
 * - GET /api/history?type=strategy&limit=50 - Get history records
 * - POST /api/history - Save new history record
 * - DELETE /api/history?id=123&type=strategy - Delete history record
 *
 * Supports:
 * - Strategy history
 * - Backtest history
 * - Trading history
 *
 * Authentication:
 * - All endpoints require user authentication
 * - User ID is automatically extracted from session
 * - Tenant access is verified for multi-tenant operations
 *
 * @module api/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from '@/lib/auth';
import {
  getStrategyHistory,
  saveStrategyHistory,
  deleteStrategy,
  getBacktestHistory,
  saveBacktestHistory,
  deleteBacktest,
  getTradingHistory,
  saveTradingHistory,
  deleteTrade,
  checkTenantAccess,
  type HistoryFilter,
  type PaginationParams,
} from '@/lib/services/history-service';

// =============================================================================
// Types
// =============================================================================

type HistoryType = 'strategy' | 'backtest' | 'trading';

interface HistoryRequest {
  type: HistoryType;
  data: Record<string, unknown>;
}

// =============================================================================
// GET - Retrieve History Records
// =============================================================================

export async function GET(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const type = searchParams.get('type') as HistoryType | null;
    const tenantId = searchParams.get('tenantId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search');
    const symbol = searchParams.get('symbol');
    const isActive = searchParams.get('isActive');
    const isStarred = searchParams.get('isStarred');

    // Validate type
    if (!type || !['strategy', 'backtest', 'trading'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid history type. Must be one of: strategy, backtest, trading',
        },
        { status: 400 }
      );
    }

    // User ID is now from session (authenticated user)
    const userId = user.userId;

    // Check tenant access if tenantId provided
    if (tenantId) {
      const access = await checkTenantAccess(userId, parseInt(tenantId, 10));
      if (!access.hasAccess) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access denied to this tenant',
          },
          { status: 403 }
        );
      }
    }

    // Build filter
    const filter: HistoryFilter = {
      userId,
      tenantId: tenantId ? parseInt(tenantId, 10) : undefined,
      search: search || undefined,
      symbol: symbol || undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      isStarred: isStarred ? isStarred === 'true' : undefined,
    };

    // Build pagination
    const pagination: PaginationParams = {
      page,
      limit: Math.min(limit, 100), // Cap at 100
    };

    // Fetch based on type
    let result;
    switch (type) {
      case 'strategy':
        result = await getStrategyHistory(filter, pagination);
        break;
      case 'backtest':
        result = await getBacktestHistory(filter, pagination);
        break;
      case 'trading':
        result = await getTradingHistory(filter, pagination);
        break;
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  });
}

// =============================================================================
// POST - Create History Record
// =============================================================================

export async function POST(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const body = (await req.json()) as HistoryRequest;
    const { type, data } = body;

    // Validate type
    if (!type || !['strategy', 'backtest', 'trading'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid history type. Must be one of: strategy, backtest, trading',
        },
        { status: 400 }
      );
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Data object is required',
        },
        { status: 400 }
      );
    }

    // User ID is now from session (authenticated user)
    const userId = user.userId;

    // Check tenant access if tenantId provided
    const tenantId = data.tenantId as number | undefined;
    if (tenantId) {
      const access = await checkTenantAccess(userId, tenantId, ['owner', 'admin', 'member']);
      if (!access.hasAccess) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access denied: insufficient permissions for this tenant',
          },
          { status: 403 }
        );
      }
    }

    // Save based on type
    let result;
    switch (type) {
      case 'strategy':
        // Validate required strategy fields
        if (!data.strategyName || !data.strategyCode || !data.parameters) {
          return NextResponse.json(
            {
              success: false,
              error: 'strategyName, strategyCode, and parameters are required for strategy history',
            },
            { status: 400 }
          );
        }
        result = await saveStrategyHistory({
          userId,
          tenantId: tenantId || null,
          strategyName: data.strategyName as string,
          description: (data.description as string) || null,
          strategyCode: data.strategyCode as string,
          parameters: typeof data.parameters === 'string' ? data.parameters : JSON.stringify(data.parameters),
          strategyType: (data.strategyType as string) || 'ai_generated',
          version: (data.version as number) || 1,
          parentVersionId: (data.parentVersionId as number) || null,
          tags: data.tags ? (typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags)) : null,
          isActive: (data.isActive as boolean) ?? true,
          isStarred: (data.isStarred as boolean) ?? false,
        });
        break;

      case 'backtest':
        // Validate required backtest fields
        if (!data.symbol || !data.startDate || !data.endDate || !data.config || !data.result) {
          return NextResponse.json(
            {
              success: false,
              error: 'symbol, startDate, endDate, config, and result are required for backtest history',
            },
            { status: 400 }
          );
        }
        result = await saveBacktestHistory({
          userId,
          tenantId: tenantId || null,
          strategyHistoryId: (data.strategyHistoryId as number) || null,
          symbol: data.symbol as string,
          stockName: (data.stockName as string) || null,
          startDate: data.startDate as string,
          endDate: data.endDate as string,
          timeframe: (data.timeframe as string) || '1d',
          config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config),
          result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
          dataSource: (data.dataSource as string) || 'unknown',
          dataCoverage: (data.dataCoverage as number) || null,
          totalReturn: (data.totalReturn as number) || null,
          sharpeRatio: (data.sharpeRatio as number) || null,
          maxDrawdown: (data.maxDrawdown as number) || null,
          winRate: (data.winRate as number) || null,
          executionTime: (data.executionTime as number) || null,
          notes: (data.notes as string) || null,
        });
        break;

      case 'trading':
        // Validate required trading fields
        if (!data.symbol || !data.side || !data.price || !data.size || !data.amount) {
          return NextResponse.json(
            {
              success: false,
              error: 'symbol, side, price, size, and amount are required for trading history',
            },
            { status: 400 }
          );
        }
        result = await saveTradingHistory({
          userId,
          tenantId: tenantId || null,
          strategyHistoryId: (data.strategyHistoryId as number) || null,
          symbol: data.symbol as string,
          stockName: (data.stockName as string) || null,
          side: data.side as string,
          orderType: (data.orderType as string) || 'market',
          price: data.price as number,
          size: data.size as number,
          amount: data.amount as number,
          commission: (data.commission as number) || null,
          status: (data.status as string) || 'filled',
          realizedPnl: (data.realizedPnl as number) || null,
          isPaperTrade: (data.isPaperTrade as boolean) ?? true,
          broker: (data.broker as string) || 'mock',
          externalOrderId: (data.externalOrderId as string) || null,
          notes: (data.notes as string) || null,
          executedAt: data.executedAt ? new Date(data.executedAt as string) : new Date(),
        });
        break;
    }

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save history record',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  });
}

// =============================================================================
// DELETE - Delete History Record
// =============================================================================

export async function DELETE(request: NextRequest) {
  return withUser<unknown>(request, async (req: NextRequest, user: UserContext) => {
    const { searchParams } = new URL(req.url);

    const type = searchParams.get('type') as HistoryType | null;
    const id = searchParams.get('id');

    // Validate parameters
    if (!type || !['strategy', 'backtest', 'trading'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid history type. Must be one of: strategy, backtest, trading',
        },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'id is required',
        },
        { status: 400 }
      );
    }

    // User ID is now from session (authenticated user)
    // TODO: Verify ownership before deleting (check that record belongs to user)
    const _userId = user.userId;

    // Delete based on type
    let success = false;
    const recordId = parseInt(id, 10);

    switch (type) {
      case 'strategy':
        success = await deleteStrategy(recordId);
        break;
      case 'backtest':
        success = await deleteBacktest(recordId);
        break;
      case 'trading':
        success = await deleteTrade(recordId);
        break;
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete record or record not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type} record deleted successfully`,
    });
  });
}

export const dynamic = 'force-dynamic';
