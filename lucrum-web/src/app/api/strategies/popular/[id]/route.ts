/**
 * Popular Strategy Detail API
 * 流行策略详情API
 *
 * GET /api/strategies/popular/[id] - Get strategy details
 * POST /api/strategies/popular/[id] - Trigger code conversion
 * 获取策略详情 / 触发代码转换
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { popularStrategies } from '@/lib/db/schema';
import {
  popularStrategyCache,
  getPopularStrategyKey,
  CACHE_TTL,
} from '@/lib/cache';
import { convertStrategy } from '@/lib/crawler';

// =============================================================================
// GET - Get Strategy Detail / 获取策略详情
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategyId = parseInt(id, 10);

    if (isNaN(strategyId)) {
      return NextResponse.json({ error: 'Invalid strategy ID' }, { status: 400 });
    }

    // Try cache first
    const cacheKey = getPopularStrategyKey(strategyId);
    const cached = await popularStrategyCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Query database
    const strategy = await db.query.popularStrategies.findFirst({
      where: eq(popularStrategies.id, strategyId),
    });

    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Update view count (fire and forget)
    db.update(popularStrategies)
      .set({ views: strategy.views + 1 })
      .where(eq(popularStrategies.id, strategyId))
      .catch((err) => console.error('[API] View count update error:', err));

    // Cache result
    await popularStrategyCache.set(cacheKey, strategy, {
      ttl: CACHE_TTL.STRATEGY_DETAIL,
    });

    return NextResponse.json(strategy);
  } catch (error) {
    console.error('[API] Strategy detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategy' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Trigger Code Conversion / 触发代码转换
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategyId = parseInt(id, 10);

    if (isNaN(strategyId)) {
      return NextResponse.json({ error: 'Invalid strategy ID' }, { status: 400 });
    }

    // Get strategy
    const strategy = await db.query.popularStrategies.findFirst({
      where: eq(popularStrategies.id, strategyId),
    });

    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    if (!strategy.originalCode) {
      return NextResponse.json(
        { error: 'No source code available for conversion' },
        { status: 400 }
      );
    }

    // Update status to processing
    await db
      .update(popularStrategies)
      .set({ conversionStatus: 'processing' })
      .where(eq(popularStrategies.id, strategyId));

    // Perform conversion
    const result = await convertStrategy({
      strategyId,
      originalCode: strategy.originalCode,
      sourceLanguage: 'python',
      targetFramework: 'veighna',
      metadata: {
        name: strategy.name,
        description: strategy.description ?? undefined,
        indicators: (strategy.indicators as string[]) ?? undefined,
      },
    });

    // Update database with result
    await db
      .update(popularStrategies)
      .set({
        conversionStatus: result.success ? 'success' : 'failed',
        veighnaCode: result.convertedCode ?? null,
        conversionError: result.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(popularStrategies.id, strategyId));

    // Invalidate cache
    const cacheKey = getPopularStrategyKey(strategyId);
    await popularStrategyCache.delete(cacheKey);

    return NextResponse.json({
      success: result.success,
      convertedCode: result.convertedCode,
      error: result.error,
      warnings: result.warnings,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[API] Strategy conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert strategy' },
      { status: 500 }
    );
  }
}
