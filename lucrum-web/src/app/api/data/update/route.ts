/**
 * Data Update API
 * 数据更新API
 *
 * POST /api/data/update - Manually trigger data update
 *
 * Allows administrators to manually trigger data updates
 * 允许管理员手动触发数据更新
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailyUpdater, UpdateOptions } from '@/lib/cron/daily-updater';
import { runIncrementalUpdate } from '@/lib/cron/incremental-updater';

// ============================================================================
// Types
// ============================================================================

interface UpdateRequest {
  updateType?: 'daily' | 'full' | 'partial' | 'incremental';
  date?: string;              // YYYY-MM-DD
  symbols?: string[];         // Specific symbols to update
  force?: boolean;            // Force update even if data exists
}

// ============================================================================
// POST Handler - Trigger Update
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: UpdateRequest = await request.json();

    // Handle incremental update (new code path)
    if (body.updateType === 'incremental') {
      console.log('[API] Starting incremental data update');

      const result = await runIncrementalUpdate({
        symbols: body.symbols,
        force: body.force ?? false,
      });

      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Incremental update completed: ${result.stocksUpdated}/${result.stocksChecked} stocks updated`
          : `Incremental update completed with errors: ${result.failedSymbols.length} stocks failed`,
        stats: {
          stocksChecked: result.stocksChecked,
          stocksUpdated: result.stocksUpdated,
          recordsInserted: result.recordsInserted,
          recordsFailed: result.recordsFailed,
          duration: result.durationMs,
        },
        failedSymbols: result.failedSymbols,
        timestamp: new Date().toISOString(),
      });
    }

    // Existing update logic (daily/full/partial)
    const updater = getDailyUpdater();

    // Check if already running
    if (updater.isUpdating()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Update already in progress',
          message: '数据更新正在进行中，请稍后再试',
        },
        { status: 409 } // Conflict
      );
    }

    // Validate date format if provided
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date format',
          message: '日期格式错误，应为 YYYY-MM-DD',
        },
        { status: 400 }
      );
    }

    // Prepare update options
    const options: UpdateOptions = {
      updateType: body.updateType || 'daily',
      date: body.date,
      symbols: body.symbols,
      force: body.force || false,
    };

    // Start update asynchronously
    console.log('[API] Starting data update:', options);

    // Run update
    const result = await updater.runUpdate(options);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        duration: result.duration,
      },
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Data update error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Update request failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler - Get Update Status
// ============================================================================

export async function GET() {
  try {
    const updater = getDailyUpdater();

    return NextResponse.json({
      success: true,
      isUpdating: updater.isUpdating(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Get status error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
