/**
 * Marketplace Strategy Run API
 *
 * Handles per-run purchases: deducts LB from subscriber,
 * credits 70% to strategy author, records transaction.
 *
 * POST /api/lurus/marketplace/run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { marketplaceStrategies, strategySubscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
        type: 'marketplace_run',
        product_id: 'lurus-gushen',
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
        product_id: 'lurus-gushen',
        description,
      }),
      cache: 'no-store',
    }
  ).catch((err: unknown) => {
    console.error('[marketplace/run] credit failed:', err);
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
  if (strategy.priceType !== 'per_run') {
    return NextResponse.json({ error: 'strategy is not per-run priced' }, { status: 422 });
  }

  const price = strategy.pricePerRun ?? 0;

  // Resolve subscriber's identity account ID
  const subscriberAccountId = await resolveIdentityAccountId(session.user.id);
  if (!subscriberAccountId) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 });
  }

  // Prevent self-purchase
  if (strategy.authorIdentityAccountId && subscriberAccountId === strategy.authorIdentityAccountId) {
    return NextResponse.json({ error: 'cannot purchase your own strategy' }, { status: 422 });
  }

  // Debit subscriber wallet (full price)
  if (price > 0) {
    const debitOk = await debitWallet(
      subscriberAccountId,
      price,
      `运行策略「${strategy.title}」`,
    );
    if (!debitOk) {
      return NextResponse.json({ error: 'insufficient_balance' }, { status: 402 });
    }
  }

  // Credit author wallet (70% after platform fee)
  const authorRevenue = price > 0 ? price * (1 - PLATFORM_FEE_RATE) : 0;
  if (authorRevenue > 0 && strategy.authorIdentityAccountId) {
    await creditWallet(
      strategy.authorIdentityAccountId,
      authorRevenue,
      `策略「${strategy.title}」运行收益`,
    );
  }

  // Record transaction
  await db.insert(strategySubscriptions).values({
    subscriberIdentityAccountId: subscriberAccountId ?? undefined,
    marketplaceStrategyId: strategy.id,
    type: 'per_run',
    lbPaid: price,
    platformFeeRate: PLATFORM_FEE_RATE,
    authorRevenueLb: authorRevenue,
  });

  // Increment run counter (fire-and-forget)
  void db
    .update(marketplaceStrategies)
    .set({ totalRuns: (strategy.totalRuns ?? 0) + 1 })
    .where(eq(marketplaceStrategies.id, strategy.id))
    .catch((err: unknown) => console.error('[marketplace/run] counter update failed:', err));

  return NextResponse.json({ success: true, lb_paid: price, author_revenue: authorRevenue });
}
