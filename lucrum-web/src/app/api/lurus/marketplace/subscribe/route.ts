/**
 * Marketplace Strategy Subscribe API
 *
 * Handles monthly subscription purchases: deducts LB from subscriber,
 * credits 70% to strategy author, records subscription period.
 *
 * POST /api/lurus/marketplace/subscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { marketplaceStrategies, strategySubscriptions } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import {
  resolveAccountId,
  debitWallet,
  creditWallet,
  PlatformError,
} from '@/lib/platform/client';

const PLATFORM_FEE_RATE = 0.30;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { strategy_id: number };
  if (!body.strategy_id || typeof body.strategy_id !== 'number') {
    return NextResponse.json({ error: 'strategy_id required' }, { status: 400 });
  }

  // Load strategy listing
  const rows = await db
    .select()
    .from(marketplaceStrategies)
    .where(eq(marketplaceStrategies.id, body.strategy_id))
    .limit(1);
  const strategy = rows[0];

  if (!strategy) {
    return NextResponse.json({ error: 'strategy not found' }, { status: 404 });
  }
  if (strategy.status !== 'active') {
    return NextResponse.json({ error: 'strategy not available' }, { status: 422 });
  }
  if (strategy.priceType !== 'subscription') {
    return NextResponse.json({ error: 'strategy is not subscription priced' }, { status: 422 });
  }

  const price = strategy.priceMonthly ?? 0;

  // Resolve subscriber's identity account ID
  let subscriberAccountId: string;
  try {
    subscriberAccountId = await resolveAccountId(session.user.id);
  } catch (err) {
    if (err instanceof PlatformError && err.code === 'not_found') {
      return NextResponse.json({ error: 'account not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'identity service unavailable' }, { status: 503 });
  }

  // Check for existing active subscription
  const now = new Date();
  const existing = await db
    .select()
    .from(strategySubscriptions)
    .where(
      and(
        eq(strategySubscriptions.marketplaceStrategyId, strategy.id),
        eq(strategySubscriptions.subscriberIdentityAccountId, subscriberAccountId),
        gte(strategySubscriptions.periodEnd!, now),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'already subscribed' }, { status: 409 });
  }

  // Prevent self-purchase
  if (strategy.authorIdentityAccountId && subscriberAccountId === strategy.authorIdentityAccountId) {
    return NextResponse.json({ error: 'cannot subscribe to your own strategy' }, { status: 422 });
  }

  // Debit subscriber wallet
  if (price > 0) {
    try {
      await debitWallet(
        subscriberAccountId,
        price,
        'marketplace_subscription',
        `订阅策略「${strategy.title}」(月付)`,
      );
    } catch (err) {
      if (err instanceof PlatformError && err.code === 'insufficient_balance') {
        return NextResponse.json(
          { code: 'insufficient_balance', topup_url: 'https://identity.lurus.cn/wallet/topup' },
          { status: 402 },
        );
      }
      return NextResponse.json({ error: 'payment failed' }, { status: 503 });
    }
  }

  // Credit author wallet (70%)
  const authorRevenue = price > 0 ? price * (1 - PLATFORM_FEE_RATE) : 0;
  if (authorRevenue > 0 && strategy.authorIdentityAccountId) {
    void creditWallet(
      strategy.authorIdentityAccountId,
      authorRevenue,
      'marketplace_revenue',
      `策略「${strategy.title}」订阅收益`,
    ).catch((err: unknown) => {
      console.error('[marketplace/subscribe] credit failed:', err);
    });
  }

  // Calculate subscription period (1 calendar month)
  const periodStart = now;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Record subscription
  await db.insert(strategySubscriptions).values({
    subscriberIdentityAccountId: subscriberAccountId,
    marketplaceStrategyId: strategy.id,
    type: 'subscription',
    lbPaid: price,
    platformFeeRate: PLATFORM_FEE_RATE,
    authorRevenueLb: authorRevenue,
    periodStart,
    periodEnd,
  });

  // Increment subscriber counter (fire-and-forget)
  void db
    .update(marketplaceStrategies)
    .set({ totalSubscribers: (strategy.totalSubscribers ?? 0) + 1 })
    .where(eq(marketplaceStrategies.id, strategy.id))
    .catch((err: unknown) => console.error('[marketplace/subscribe] counter update failed:', err));

  return NextResponse.json({
    success: true,
    lb_paid: price,
    author_revenue: authorRevenue,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
  });
}
