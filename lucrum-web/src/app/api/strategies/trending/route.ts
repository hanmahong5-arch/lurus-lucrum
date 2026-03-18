/**
 * Trending Strategies API
 * 趋势策略API
 *
 * GET /api/strategies/trending - Get trending strategies
 * 获取趋势策略
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { popularStrategies } from '@/lib/db/schema';
import {
  popularStrategyCache,
  getTrendingStrategiesKey,
  CACHE_TTL,
} from '@/lib/cache';

// =============================================================================
// GET - Get Trending Strategies / 获取趋势策略
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // Try cache first
    const cacheKey = getTrendingStrategiesKey(period);
    const cached = await popularStrategyCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Calculate date threshold
    const now = new Date();
    let dateThreshold: Date;
    switch (period) {
      case 'week':
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Query trending strategies
    // Using popularity score with recency boost
    const strategies = await db
      .select({
        id: popularStrategies.id,
        source: popularStrategies.source,
        name: popularStrategies.name,
        description: popularStrategies.description,
        author: popularStrategies.author,
        strategyType: popularStrategies.strategyType,
        indicators: popularStrategies.indicators,
        views: popularStrategies.views,
        likes: popularStrategies.likes,
        popularityScore: popularStrategies.popularityScore,
        isFeatured: popularStrategies.isFeatured,
        originalUrl: popularStrategies.originalUrl,
        updatedAt: popularStrategies.updatedAt,
        // Calculate trending score (popularity * recency factor)
        trendingScore: sql<number>`
          CAST(${popularStrategies.popularityScore} AS FLOAT) *
          (1 + 1.0 / (EXTRACT(EPOCH FROM (NOW() - ${popularStrategies.updatedAt})) / 86400 + 1))
        `.as('trending_score'),
      })
      .from(popularStrategies)
      .orderBy(desc(sql`trending_score`))
      .limit(limit);

    const response = {
      strategies,
      period,
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    await popularStrategyCache.set(cacheKey, response, {
      ttl: CACHE_TTL.TRENDING_STRATEGIES,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Trending strategies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending strategies' },
      { status: 500 }
    );
  }
}
