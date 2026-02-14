/**
 * Cron Initialization API
 * 定时任务初始化API
 *
 * This endpoint is called on server startup to initialize cron jobs
 * 此端点在服务器启动时调用以初始化定时任务
 */

import { NextResponse } from 'next/server';
import { initializeDailyUpdater } from '@/lib/cron/daily-updater';

// ============================================================================
// GET Handler - Initialize Cron Jobs
// ============================================================================

export async function GET() {
  try {
    // Initialize daily updater
    initializeDailyUpdater();

    return NextResponse.json({
      success: true,
      message: 'Cron jobs initialized successfully',
      jobs: {
        dailyDataUpdater: {
          enabled: process.env.NODE_ENV === 'production',
          schedule: '15:30 CST (Mon-Fri)',
        },
        incrementalUpdater: {
          enabled: process.env.NODE_ENV === 'production',
          schedule: '18:00 CST (Mon-Fri)',
          description: 'Incremental K-line data update for all active stocks',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Cron initialization error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize cron jobs',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
