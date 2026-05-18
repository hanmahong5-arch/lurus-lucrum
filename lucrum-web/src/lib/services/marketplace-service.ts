/**
 * Marketplace service.
 *
 * Operations on `marketplace_strategies` beyond CRUD list/publish:
 *   - forkStrategy:  copy a marketplace strategy into the user's own
 *                    strategy_history (carrying a parent_marketplace_id ref).
 *   - rateStrategy:  upsert a 1–5 rating and recompute the rolling avg.
 *
 * Fire-and-forget timeline events are emitted on success so the user's
 * action shows up in /api/timeline.
 *
 * @module lib/services/marketplace-service
 */

import { db } from '@/lib/db';
import {
  marketplaceStrategies,
  strategyHistory,
  strategyRatings,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
  recordEvent,
  USER_EVENT_TYPES,
} from '@/lib/services/user-event-service';

export interface ForkResult {
  newStrategyId: number;
  marketplaceId: number;
  title: string;
}

/**
 * Fork a marketplace strategy into the requesting user's strategy_history.
 *
 * The new row carries the source code + params verbatim, links back via
 * `parent_marketplace_id`, and increments the marketplace `fork_count`. A
 * `marketplace.forked` event is emitted for the timeline.
 */
export async function forkStrategy(
  userId: string,
  marketplaceId: number,
): Promise<ForkResult | null> {
  try {
    // Load source strategy + its referenced strategy_history
    const sourceRows = await db
      .select({
        marketplace: marketplaceStrategies,
        source: strategyHistory,
      })
      .from(marketplaceStrategies)
      .innerJoin(
        strategyHistory,
        eq(marketplaceStrategies.strategyHistoryId, strategyHistory.id),
      )
      .where(eq(marketplaceStrategies.id, marketplaceId))
      .limit(1);

    const sourceRow = sourceRows[0];
    if (!sourceRow) return null;
    const { marketplace, source } = sourceRow;

    // Insert a fork row owned by the user.
    const inserted = await db
      .insert(strategyHistory)
      .values({
        userId,
        tenantId: null,
        strategyName: `${marketplace.title} (Fork)`,
        description: marketplace.description ?? source.description,
        strategyCode: source.strategyCode,
        parameters: source.parameters,
        strategyType: 'forked',
        version: 1,
        parentMarketplaceId: marketplaceId,
        isActive: true,
        isStarred: false,
      })
      .returning();

    const newRow = inserted[0];
    if (!newRow) return null;

    // Bump fork_count. Failure is non-fatal — the fork is the user-facing
    // success; counter drift is acceptable.
    await db
      .update(marketplaceStrategies)
      .set({ forkCount: sql`COALESCE(${marketplaceStrategies.forkCount}, 0) + 1` })
      .where(eq(marketplaceStrategies.id, marketplaceId))
      .catch((err: unknown) => {
        console.warn('[marketplace-service] forkCount bump failed:', err);
      });

    recordEvent({
      userId,
      type: USER_EVENT_TYPES.marketplaceForked,
      entityType: 'marketplace',
      entityId: marketplaceId,
      metadata: {
        title: marketplace.title,
        newStrategyId: newRow.id,
      },
    });

    return {
      newStrategyId: newRow.id,
      marketplaceId,
      title: marketplace.title,
    };
  } catch (err) {
    console.error('[marketplace-service] forkStrategy failed:', err);
    return null;
  }
}

export interface RateResult {
  marketplaceId: number;
  ratingAvg: number;
  ratingCount: number;
}

/**
 * Upsert a rating; recompute the avg/count for the strategy in a single
 * transaction so the listing card stays consistent.
 */
export async function rateStrategy(
  userId: string,
  marketplaceId: number,
  stars: number,
  review?: string,
): Promise<RateResult | null> {
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return null;

  try {
    // Upsert via ON CONFLICT — replaces the user's previous rating if any.
    await db
      .insert(strategyRatings)
      .values({
        marketplaceStrategyId: marketplaceId,
        userId,
        stars,
        review: review ?? null,
      })
      .onConflictDoUpdate({
        target: [strategyRatings.marketplaceStrategyId, strategyRatings.userId],
        set: {
          stars,
          review: review ?? null,
          updatedAt: new Date(),
        },
      });

    // Recompute aggregates from the source of truth (cheap; ratings/strategy
    // is bounded and we always want the cached values to match).
    const aggRows = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${strategyRatings.stars}), 0)::numeric(3,2)`,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(strategyRatings)
      .where(eq(strategyRatings.marketplaceStrategyId, marketplaceId));

    const agg = aggRows[0];
    const avg = agg ? Number(agg.avg) : 0;
    const cnt = agg ? Number(agg.cnt) : 0;

    await db
      .update(marketplaceStrategies)
      .set({
        ratingAvg: String(avg),
        ratingCount: cnt,
      })
      .where(eq(marketplaceStrategies.id, marketplaceId));

    recordEvent({
      userId,
      type: USER_EVENT_TYPES.marketplaceRated,
      entityType: 'marketplace',
      entityId: marketplaceId,
      metadata: { stars, review: review ? review.slice(0, 200) : undefined },
    });

    return { marketplaceId, ratingAvg: avg, ratingCount: cnt };
  } catch (err) {
    console.error('[marketplace-service] rateStrategy failed:', err);
    return null;
  }
}
