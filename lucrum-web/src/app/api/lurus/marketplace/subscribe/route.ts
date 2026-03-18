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

const IDENTITY_URL = process.env.LURUS_IDENTITY_URL ?? 'https://identity.lurus.cn';
const IDENTITY_INTERNAL_KEY = process.env.LURUS_IDENTITY_INTERNAL_KEY ?? '';
const PLATFORM_FEE_RATE = 0.30;

const internalHeaders = {
  Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}`,
  'Content-Type': 'application/json',
};

async function resolveIdentityAccountId(zitadelSub: string): Promise<string | null> {
  const res = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(zitadelSub)}`,
    { headers: internalHeaders, cache: 'no-store' }
  );
  if (!res.ok) return null;
  const account = (await res.json()) as { id: number };
  return String(account.id);
}

async function debitWallet(accountId: string, amount: number, description: string): Promise<boolean> {
  const res = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/${accountId}/wallet/debit`,
    {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        amount,
        type: 'marketplace_subscription',
        product_id: 'lurus-lucrum',
        description,
      }),
      cache: 'no-store',
    }
  );
  return res.ok;
}

async function creditWallet(accountId: string, amount: number, description: string): Promise<void> {
  await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/${accountId}/wallet/credit`,
    {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        amount,
        type: 'marketplace_revenue',
        product_id: 'lurus-lucrum',
        description,
      }),
      cache: 'no-store',
    }
  ).catch((err: unknown) => {
    console.error('[marketplace/subscribe] credit failed:', err);
  });
}

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

  // Resolve subscriber's identity account ID (needed for duplicate check and wallet debit)
  const subscriberAccountId = await resolveIdentityAccountId(session.user.id);
  if (!subscriberAccountId) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 });
  }

  // Check for existing active subscription for this specific subscriber
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
    const debitOk = await debitWallet(
      subscriberAccountId,
      price,
      `订阅策略「${strategy.title}」(月付)`,
    );
    if (!debitOk) {
      return NextResponse.json({ error: 'insufficient_balance' }, { status: 402 });
    }
  }

  // Credit author wallet (70%)
  const authorRevenue = price > 0 ? price * (1 - PLATFORM_FEE_RATE) : 0;
  if (authorRevenue > 0 && strategy.authorIdentityAccountId) {
    await creditWallet(
      strategy.authorIdentityAccountId,
      authorRevenue,
      `策略「${strategy.title}」订阅收益`,
    );
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
