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
import {
  resolveAccountId,
  debitWallet,
  creditWallet,
  PlatformError,
} from '@/lib/platform/client';
import {
  recordEvent,
  USER_EVENT_TYPES,
} from '@/lib/services/user-event-service';
import { createNotification } from '@/lib/services/notification-service';

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
  if (strategy.priceType !== 'per_run') {
    return NextResponse.json({ error: 'strategy is not per-run priced' }, { status: 422 });
  }

  const price = strategy.pricePerRun ?? 0;

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

  // Prevent self-purchase
  if (strategy.authorIdentityAccountId && subscriberAccountId === strategy.authorIdentityAccountId) {
    return NextResponse.json({ error: 'cannot purchase your own strategy' }, { status: 422 });
  }

  // Debit subscriber wallet (full price) and record transaction atomically
  const authorRevenue = price > 0 ? price * (1 - PLATFORM_FEE_RATE) : 0;

  if (price > 0) {
    try {
      await debitWallet(
        subscriberAccountId,
        price,
        'marketplace_run',
        `运行策略「${strategy.title}」`,
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

  // Record transaction in DB (must succeed after debit)
  await db.transaction(async (tx) => {
    await tx.insert(strategySubscriptions).values({
      subscriberIdentityAccountId: subscriberAccountId ?? undefined,
      marketplaceStrategyId: strategy.id,
      type: 'per_run',
      lbPaid: price,
      platformFeeRate: PLATFORM_FEE_RATE,
      authorRevenueLb: authorRevenue,
    });
  });

  // Credit author wallet (70% after platform fee) — must await, not fire-and-forget
  if (authorRevenue > 0 && strategy.authorIdentityAccountId) {
    try {
      await creditWallet(
        strategy.authorIdentityAccountId,
        authorRevenue,
        'marketplace_revenue',
        `策略「${strategy.title}」运行收益`,
      );
    } catch (creditError) {
      // Debit already succeeded and subscription recorded — log for manual reconciliation
      console.error(
        '[CRITICAL] Author credit failed after subscriber debit:',
        { strategyId: strategy.id, authorAccountId: strategy.authorIdentityAccountId, authorRevenue },
        creditError,
      );
      // TODO: Add to outbox for retry
    }
  }

  // Increment run counter (fire-and-forget)
  void db
    .update(marketplaceStrategies)
    .set({ totalRuns: (strategy.totalRuns ?? 0) + 1 })
    .where(eq(marketplaceStrategies.id, strategy.id))
    .catch((err: unknown) => console.error('[marketplace/run] counter update failed:', err));

  // Runner timeline + author notification (fire-and-forget). We reuse
  // marketplaceSubscribed for per-run too — it's a paid usage event; the
  // metadata.kind differentiates 'per_run' from 'subscription'.
  recordEvent({
    userId: session.user.id,
    type: USER_EVENT_TYPES.marketplaceSubscribed,
    entityType: 'marketplace',
    entityId: strategy.id,
    metadata: {
      title: strategy.title,
      kind: 'per_run',
      lbPaid: price,
    },
  });

  if (strategy.authorUserId && strategy.authorUserId !== session.user.id) {
    void createNotification({
      userId: strategy.authorUserId,
      type: 'activity',
      title: `有用户运行了你的策略「${strategy.title}」`,
      body: `本次收入 ${authorRevenue.toFixed(2)} LB`,
      metadata: {
        kind: 'marketplace_run',
        marketplaceId: strategy.id,
        runnerUserId: session.user.id,
        authorRevenue,
      },
    });
  }

  return NextResponse.json({ success: true, lb_paid: price, author_revenue: authorRevenue });
}
