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
import { marketplaceStrategies, strategyHistory, strategyVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  resolveAccountId,
  debitWallet,
  PlatformError,
} from "@/lib/platform/client";
import {
  assertStandardCosts,
  type TransactionCosts,
} from "@/lib/backtest/transaction-costs";
import { MARKETPLACE_SUBMIT_GATE } from "@/lib/backtest/validation/gate-runner";
import {
  recordEvent,
  USER_EVENT_TYPES,
} from "@/lib/services/user-event-service";

const STAKE_AMOUNT = 10;

// =============================================================================
// REVERSE-CHERRY-PICKING GUARDS (Sprint 1 招 B + 招 C)
// =============================================================================

/**
 * Reverse-cherry-picking gate B: reject publishes whose stored backtest
 * config has hand-tuned transaction costs that diverge from the
 * STANDARD_MARKETPLACE_COSTS baseline. Legacy strategies without an
 * explicit costs field are treated as compliant (defaults).
 */
function checkStandardCosts(strategyRow: typeof strategyHistory.$inferSelect) {
  // The strategy history row stores its backtest config as a JSON blob in
  // the `parameters` text field (varies by strategy version). We probe for
  // a `costs` sub-object; absence = pass (caller used defaults).
  let parsed: { costs?: TransactionCosts } | undefined;
  try {
    parsed =
      typeof strategyRow.parameters === "string"
        ? JSON.parse(strategyRow.parameters)
        : (strategyRow.parameters as { costs?: TransactionCosts } | undefined);
  } catch {
    return { ok: true as const };
  }
  const mismatches = assertStandardCosts(parsed?.costs ?? null);
  if (mismatches.length === 0) return { ok: true as const };
  return {
    ok: false as const,
    mismatches,
  };
}

/**
 * Reverse-cherry-picking gate C: reject publishes whose stored gate report
 * fails the MARKETPLACE_SUBMIT_GATE thresholds. The gate report lives on
 * the *latest* `strategy_versions` row's `score` JSON blob (written by the
 * Phase 7 monitoring pipeline). If no version row carries a gate report,
 * we soft-warn rather than block — running the gate inline at publish time
 * is too expensive for an interactive POST.
 */
async function checkGateReport(strategyHistoryId: number) {
  const latestVersionRow = await db
    .select({ score: strategyVersions.score })
    .from(strategyVersions)
    .where(eq(strategyVersions.strategyHistoryId, strategyHistoryId))
    .orderBy(desc(strategyVersions.createdAt))
    .limit(1);

  const score = latestVersionRow[0]?.score as
    | {
        gateReport?: {
          passed?: boolean;
          details?: {
            sharpe?: number;
            pbo?: number | null;
            dsrProbability?: number | null;
            bootstrap?: { lower?: number };
            generalisationRatio?: number | null;
          };
        };
      }
    | null
    | undefined;

  if (!score?.gateReport?.details) {
    return { ok: true as const, soft: true as const };
  }
  const d = score.gateReport.details;
  const T = MARKETPLACE_SUBMIT_GATE;
  const failures: Array<{ check: string; actual: number | null; threshold: number }> = [];
  if (typeof d.sharpe === "number" && d.sharpe < T.minSharpe) {
    failures.push({ check: "sharpe", actual: d.sharpe, threshold: T.minSharpe });
  }
  if (typeof d.pbo === "number" && d.pbo > T.maxPBO) {
    failures.push({ check: "pbo", actual: d.pbo, threshold: T.maxPBO });
  }
  if (typeof d.dsrProbability === "number" && d.dsrProbability < T.minDSRProbability) {
    failures.push({
      check: "dsrProbability",
      actual: d.dsrProbability,
      threshold: T.minDSRProbability,
    });
  }
  if (failures.length === 0) return { ok: true as const, soft: false as const };
  return { ok: false as const, failures };
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

  // ---------------------------------------------------------------------------
  // Reverse-cherry-picking guards (Sprint 1 招 B + 招 C)
  // ---------------------------------------------------------------------------
  const costCheck = checkStandardCosts(strategy);
  if (!costCheck.ok) {
    return NextResponse.json(
      {
        code: "non_standard_costs",
        title: "成本不达标准",
        description:
          "Marketplace 要求使用标准化成本配置 (commission 0.025% / 印花税 0.05% / 滑点 10bps)。" +
          "请用标准成本重新回测后再上架。",
        mismatches: costCheck.mismatches,
      },
      { status: 422 },
    );
  }

  const gateCheck = await checkGateReport(body.strategy_history_id);
  if (!gateCheck.ok) {
    return NextResponse.json(
      {
        code: "gate_failed",
        title: "策略未通过 marketplace 提交门槛",
        description:
          "本策略在 DSR / PBO / Sharpe 中至少一项不达标。强健性不足的策略不允许上架,以保护订阅用户。",
        failures: gateCheck.failures,
        thresholds: MARKETPLACE_SUBMIT_GATE,
      },
      { status: 422 },
    );
  }
  // gateCheck.ok === true but soft === true means no gate report on file;
  // we allow it through but flag in the response so frontends can warn.
  const gateSoft = gateCheck.ok && gateCheck.soft === true;

  // Resolve identity account
  let accountId: string;
  try {
    accountId = await resolveAccountId(session.user.id);
  } catch (err) {
    if (err instanceof PlatformError && err.code === "not_found") {
      return NextResponse.json(
        { error: "identity account not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "identity service unavailable" },
      { status: 503 },
    );
  }

  // Debit staking amount
  try {
    await debitWallet(
      accountId,
      STAKE_AMOUNT,
      "marketplace_stake",
      `策略上架质押「${body.title.trim()}」`,
    );
  } catch (err) {
    if (err instanceof PlatformError && err.code === "insufficient_balance") {
      return NextResponse.json(
        { code: "insufficient_balance", topup_url: "https://identity.lurus.cn/wallet/topup" },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "payment failed" }, { status: 503 });
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

  // Author timeline entry — fire-and-forget; failure won't block publish.
  if (listing?.id) {
    recordEvent({
      userId: session.user.id,
      type: USER_EVENT_TYPES.marketplacePublished,
      entityType: "marketplace",
      entityId: listing.id,
      metadata: {
        title: body.title.trim().slice(0, 100),
        priceType: body.price_type,
        stakedLb: STAKE_AMOUNT,
        gatePending: gateSoft,
      },
    });
  }

  return NextResponse.json({
    success: true,
    listing_id: listing?.id,
    staked_lb: STAKE_AMOUNT,
    // When gateSoft is true the strategy was published without a stored
    // gate report — frontends can surface this so the author knows their
    // listing won't display robustness badges until a gate run completes.
    gate_pending: gateSoft,
  });
}
