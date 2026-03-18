/**
 * Popular Strategies API
 * 流行策略API
 *
 * GET /api/strategies/popular - Get list of popular strategies
 * 获取流行策略列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, and, sql, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { popularStrategies } from '@/lib/db/schema';
import {
  popularStrategyCache,
  getPopularStrategyListKey,
  CACHE_TTL,
} from '@/lib/cache';

// =============================================================================
// GET - List Popular Strategies / 获取流行策略列表
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const source = searchParams.get('source') || undefined;
    const type = searchParams.get('type') || undefined;
    const search = searchParams.get('search') || undefined;
    const featured = searchParams.get('featured') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Try cache first
    const cacheKey = getPopularStrategyListKey(source, type, page);
    const cached = await popularStrategyCache.get(cacheKey);
    if (cached && !search) {
      return NextResponse.json(cached);
    }

    // Build query conditions
    const conditions = [];

    if (source) {
      conditions.push(eq(popularStrategies.source, source));
    }

    if (type) {
      conditions.push(eq(popularStrategies.strategyType, type));
    }

    if (featured) {
      conditions.push(eq(popularStrategies.isFeatured, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(popularStrategies.name, `%${search}%`),
          ilike(popularStrategies.description, `%${search}%`),
          ilike(popularStrategies.author, `%${search}%`)
        )
      );
    }

    // Execute query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [strategies, countResult] = await Promise.all([
      db
        .select({
          id: popularStrategies.id,
          source: popularStrategies.source,
          sourceId: popularStrategies.sourceId,
          name: popularStrategies.name,
          description: popularStrategies.description,
          author: popularStrategies.author,
          strategyType: popularStrategies.strategyType,
          markets: popularStrategies.markets,
          indicators: popularStrategies.indicators,
          annualReturn: popularStrategies.annualReturn,
          maxDrawdown: popularStrategies.maxDrawdown,
          sharpeRatio: popularStrategies.sharpeRatio,
          views: popularStrategies.views,
          likes: popularStrategies.likes,
          popularityScore: popularStrategies.popularityScore,
          isFeatured: popularStrategies.isFeatured,
          tags: popularStrategies.tags,
          originalUrl: popularStrategies.originalUrl,
          conversionStatus: popularStrategies.conversionStatus,
          updatedAt: popularStrategies.updatedAt,
        })
        .from(popularStrategies)
        .where(whereClause)
        .orderBy(desc(popularStrategies.popularityScore))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(popularStrategies)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const response = {
      strategies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + strategies.length < total,
      },
    };

    // Cache result (skip if search query)
    if (!search) {
      await popularStrategyCache.set(cacheKey, response, {
        ttl: CACHE_TTL.POPULAR_STRATEGY_LIST,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Popular strategies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular strategies' },
      { status: 500 }
    );
  }
}
