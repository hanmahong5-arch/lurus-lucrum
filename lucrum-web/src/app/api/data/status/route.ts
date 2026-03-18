/**
 * Data Update Status API
 * 数据更新状态API
 *
 * GET /api/data/status - Get update history and current status
 *
 * Returns recent update logs and current update status
 * 返回最近的更新日志和当前更新状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dataUpdateLog } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { getDailyUpdater } from '@/lib/cron/daily-updater';

// ============================================================================
// Types
// ============================================================================

interface UpdateLogEntry {
  id: number;
  updateDate: string;
  updateType: string;
  startTime: string;
  endTime: string | null;
  status: string;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  createdAt: string;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    // Get recent update logs
    const logs = await db
      .select()
      .from(dataUpdateLog)
      .orderBy(desc(dataUpdateLog.createdAt))
      .limit(limit);

    // Get current updater status
    const updater = getDailyUpdater();
    const isUpdating = updater.isUpdating();

    // Calculate statistics
    const totalUpdates = logs.length;
    const successfulUpdates = logs.filter(l => l.status === 'success').length;
    const failedUpdates = logs.filter(l => l.status === 'failed').length;
    const partialUpdates = logs.filter(l => l.status === 'partial').length;

    const latestUpdate = logs[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        currentStatus: {
          isUpdating,
          latestUpdate: latestUpdate ? {
            date: latestUpdate.updateDate,
            status: latestUpdate.status,
            recordsUpdated: latestUpdate.recordsUpdated,
            recordsFailed: latestUpdate.recordsFailed,
            startTime: latestUpdate.startTime,
            endTime: latestUpdate.endTime,
          } : null,
        },
        statistics: {
          total: totalUpdates,
          successful: successfulUpdates,
          failed: failedUpdates,
          partial: partialUpdates,
          successRate: totalUpdates > 0
            ? ((successfulUpdates / totalUpdates) * 100).toFixed(2) + '%'
            : 'N/A',
        },
        recentLogs: logs.map(log => ({
          id: log.id,
          updateDate: log.updateDate,
          updateType: log.updateType,
          status: log.status,
          recordsUpdated: log.recordsUpdated,
          recordsFailed: log.recordsFailed,
          duration: log.endTime && log.startTime
            ? (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
            : null,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt,
        })),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Status query error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch update status',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
