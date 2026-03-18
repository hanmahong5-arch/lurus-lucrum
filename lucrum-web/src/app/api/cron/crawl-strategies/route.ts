/**
 * Strategy Crawl Cron API
 * 策略爬取定时任务API
 *
 * POST /api/cron/crawl-strategies - Trigger manual crawl
 * GET /api/cron/crawl-strategies - Get crawler status
 * 触发手动爬取 / 获取爬虫状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getCrawlerScheduler,
  triggerManualCrawl,
  type StrategySource,
} from '@/lib/crawler';

// Valid sources
const VALID_SOURCES: StrategySource[] = ['github', 'joinquant', 'uqer', 'xueqiu'];

// =============================================================================
// POST - Trigger Manual Crawl / 触发手动爬取
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user (require admin or special permission in production)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, check for admin role
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const body = await request.json();
    const source = (body.source as StrategySource) ?? 'github';

    // Validate source
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }

    // Currently only GitHub is implemented
    if (source !== 'github') {
      return NextResponse.json(
        { error: `Source '${source}' is not yet implemented. Only 'github' is available.` },
        { status: 501 }
      );
    }

    // Trigger crawl
    const result = await triggerManualCrawl(source);

    return NextResponse.json({
      success: result.status === 'success' || result.status === 'partial',
      result: {
        source: result.source,
        status: result.status,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        duration: result.endTime.getTime() - result.startTime.getTime(),
        strategiesFound: result.strategiesFound,
        strategiesNew: result.strategiesNew,
        strategiesUpdated: result.strategiesUpdated,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('[API] Crawl trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger crawl' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get Crawler Status / 获取爬虫状态
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduler = getCrawlerScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      scheduler: status,
      availableSources: VALID_SOURCES,
      implementedSources: ['github'],
    });
  } catch (error) {
    console.error('[API] Get crawler status error:', error);
    return NextResponse.json(
      { error: 'Failed to get crawler status' },
      { status: 500 }
    );
  }
}
