/**
 * Marketplace Strategy Publish API
 *
 * POST /api/lurus/marketplace/publish
 * Allows Pro users to publish their strategies to the marketplace.
 * Requires staking 10 LB as anti-spam deposit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketplaceStrategies, strategyHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const IDENTITY_URL = process.env.LURUS_IDENTITY_URL ?? "https://identity.lurus.cn";
const IDENTITY_INTERNAL_KEY = process.env.LURUS_IDENTITY_INTERNAL_KEY ?? "";
const STAKE_AMOUNT = 10;

const internalHeaders = {
  Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}`,
  "Content-Type": "application/json",
};

async function resolveIdentityAccountId(
  zitadelSub: string,
): Promise<string | null> {
  const res = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(zitadelSub)}`,
    { headers: internalHeaders, cache: "no-store" },
  );
  if (!res.ok) return null;
  const account = (await res.json()) as { id: number };
  return String(account.id);
}

async function debitWallet(
  accountId: string,
  amount: number,
  description: string,
): Promise<boolean> {
  const res = await fetch(
    `${IDENTITY_URL}/internal/v1/accounts/${accountId}/wallet/debit`,
    {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({
        amount,
        type: "marketplace_stake",
        product_id: "lurus-lucrum",
        description,
      }),
      cache: "no-store",
    },
  );
  return res.ok;
}

interface PublishBody {
  strategy_history_id: number;
  title: string;
  description: string | null;
  price_type: "free" | "per_run" | "subscription";
  price_per_run: number;
  price_monthly: number;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PublishBody;

  // Validate required fields
  if (!body.strategy_history_id || !body.title?.trim()) {
    return NextResponse.json(
      { error: "strategy_history_id and title are required" },
      { status: 400 },
    );
  }

  if (!["free", "per_run", "subscription"].includes(body.price_type)) {
    return NextResponse.json(
      { error: "invalid price_type" },
      { status: 400 },
    );
  }

  // Verify strategy ownership
  const strategyRows = await db
    .select()
    .from(strategyHistory)
    .where(
      and(
        eq(strategyHistory.id, body.strategy_history_id),
        eq(strategyHistory.userId, session.user.id),
      ),
    )
    .limit(1);

  const strategy = strategyRows[0];
  if (!strategy) {
    return NextResponse.json(
      { error: "strategy not found or not owned by you" },
      { status: 404 },
    );
  }

  // Check if already published
  const existingRows = await db
    .select({ id: marketplaceStrategies.id })
    .from(marketplaceStrategies)
    .where(eq(marketplaceStrategies.strategyHistoryId, body.strategy_history_id))
    .limit(1);

  if (existingRows.length > 0) {
    return NextResponse.json(
      { error: "already_published" },
      { status: 409 },
    );
  }

  // Resolve identity account
  const accountId = await resolveIdentityAccountId(session.user.id);
  if (!accountId) {
    return NextResponse.json(
      { error: "identity account not found" },
      { status: 404 },
    );
  }

  // Debit staking amount
  const debitOk = await debitWallet(
    accountId,
    STAKE_AMOUNT,
    `策略上架质押「${body.title.trim()}」`,
  );
  if (!debitOk) {
    return NextResponse.json(
      { error: "insufficient_balance" },
      { status: 402 },
    );
  }

  // Insert marketplace listing
  const [listing] = await db
    .insert(marketplaceStrategies)
    .values({
      strategyHistoryId: body.strategy_history_id,
      authorUserId: session.user.id,
      title: body.title.trim().slice(0, 100),
      description: body.description?.trim() || null,
      priceType: body.price_type,
      pricePerRun: body.price_type === "per_run" ? body.price_per_run : 0,
      priceMonthly: body.price_type === "subscription" ? body.price_monthly : 0,
      authorIdentityAccountId: accountId,
      stakedLb: STAKE_AMOUNT,
      status: "active",
    })
    .returning({ id: marketplaceStrategies.id });

  return NextResponse.json({
    success: true,
    listing_id: listing?.id,
    staked_lb: STAKE_AMOUNT,
  });
}
