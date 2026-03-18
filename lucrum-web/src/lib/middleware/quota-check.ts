/**
 * Three-layer AI Quota Enforcement Middleware
 *
 * Layer 1: Plan monthly token ceiling (hardcoded per plan_code)
 * Layer 2: Redis monthly counter (quota:{userId}:{YYYY-MM} hash)
 * Layer 3: LuBell (LB) fallback — debit wallet when plan ceiling exceeded
 *
 * Flow:
 *   checkAndConsumeQuota()
 *     → fetch plan via GET /api/lurus/overview
 *     → read Redis counter
 *     → if within plan limit → increment counter → allow
 *     → if over plan limit + has LB → debit wallet → allow
 *     → if over plan limit + no LB (or free) → 429
 *   consumeQuota() (post-op)
 *     → POST /internal/v1/usage/report (fire-and-forget)
 */

import { getRedis } from '@/lib/redis';

// ─── Constants ────────────────────────────────────────────────────────────────

const IDENTITY_URL = process.env.LURUS_IDENTITY_URL ?? 'https://identity.lurus.cn';
const IDENTITY_INTERNAL_KEY = process.env.LURUS_IDENTITY_INTERNAL_KEY ?? '';

/** 1 LB covers this many tokens when used as overage fallback */
const TOKENS_PER_LB = 10_000;

/** Monthly token limits per plan_code. 0 means "no limit". */
const PLAN_MONTHLY_TOKENS: Record<string, number> = {
  free:       50_000,
  basic:     500_000,
  pro:     5_000_000,
  enterprise:        0, // unlimited
};

/** Fallback limit when plan_code is unrecognised (treat as free). */
const FREE_MONTHLY_TOKENS = PLAN_MONTHLY_TOKENS.free as number;

/** Plans that use LB fallback when over limit (free plan is hard-blocked). */
const LB_FALLBACK_PLANS = new Set(['basic', 'pro']);

/** Timeout for identity service calls (ms). */
const IDENTITY_TIMEOUT_MS = 1_500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotaResult {
  allowed: boolean;
  remaining: number;    // -1 = unlimited
  total: number;        // -1 = unlimited
  plan: string;
  lb_spent?: number;    // LB deducted this call (if overage path)
  reason?: string;      // Error code when allowed=false
  topup_url?: string;
}

interface OverviewResponse {
  subscription?: { plan_code?: string } | null;
  wallet?: { balance?: number };
}

interface MonthlyUsage {
  used_tokens: number;
  lb_spent: number;
}

// ─── Redis helpers ─────────────────────────────────────────────────────────────

function quotaKey(userId: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `quota:${userId}:${ym}`;
}

/** Returns seconds until the end of the current UTC month. */
function secondsUntilMonthEnd(): number {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
}

async function getMonthlyUsage(userId: string): Promise<MonthlyUsage> {
  const client = getRedis();
  if (!client) return { used_tokens: 0, lb_spent: 0 };
  try {
    const key = quotaKey(userId);
    const [usedRaw, lbRaw] = await client.hmget(key, 'used_tokens', 'lb_spent');
    return {
      used_tokens: usedRaw ? parseInt(usedRaw, 10) : 0,
      lb_spent:    lbRaw   ? parseFloat(lbRaw)     : 0,
    };
  } catch (err) {
    console.error('[quota] getMonthlyUsage error:', err);
    return { used_tokens: 0, lb_spent: 0 };
  }
}

async function incrementUsage(userId: string, tokens: number, lbSpent = 0): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const key = quotaKey(userId);
    const pipeline = client.pipeline();
    pipeline.hincrby(key, 'used_tokens', tokens);
    if (lbSpent > 0) {
      pipeline.hincrbyfloat(key, 'lb_spent', lbSpent);
    }
    pipeline.expireat(key, Math.floor(Date.now() / 1000) + secondsUntilMonthEnd());
    await pipeline.exec();
  } catch (err) {
    console.error('[quota] incrementUsage error:', err);
  }
}

// ─── Identity service helpers ──────────────────────────────────────────────────

/**
 * Resolve a numeric lurus-platform account ID from a Zitadel sub.
 * Returns null when the identity service is unavailable (fail-open).
 */
export async function resolveAccountId(zitadelSub: string): Promise<string | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), IDENTITY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${IDENTITY_URL}/internal/v1/accounts/by-zitadel-sub/${encodeURIComponent(zitadelSub)}`,
      {
        headers: { Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}` },
        cache: 'no-store',
        signal: ac.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const account = (await res.json()) as { id: number };
    return String(account.id);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchOverview(accountId: string): Promise<OverviewResponse | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), IDENTITY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${IDENTITY_URL}/internal/v1/accounts/${encodeURIComponent(accountId)}/overview?product_id=lurus-lucrum`,
      {
        headers: { Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}` },
        cache: 'no-store',
        signal: ac.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as OverviewResponse;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function deductLubell(accountId: string, tokens: number): Promise<{ success: boolean; balanceAfter?: number }> {
  const lbNeeded = Math.ceil(tokens / TOKENS_PER_LB);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), IDENTITY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${IDENTITY_URL}/internal/v1/accounts/${encodeURIComponent(accountId)}/wallet/debit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount:      lbNeeded,
          type:        'ai_quota_overage',
          product_id:  'lurus-lucrum',
          description: `超出月度 AI 配额，消耗 ${tokens.toLocaleString()} tokens`,
        }),
        cache: 'no-store',
        signal: ac.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return { success: false };
    const body = (await res.json()) as { success: boolean; balance_after?: number };
    return { success: body.success, balanceAfter: body.balance_after };
  } catch {
    clearTimeout(timer);
    return { success: false };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the user has sufficient quota for an AI operation.
 *
 * @param accountId   lurus-platform account ID (numeric string)
 * @param userId      lucrum local user identifier (used as Redis key prefix)
 * @param estimatedTokens  Expected token consumption for this operation
 */
export async function checkAndConsumeQuota(
  accountId: string,
  userId: string,
  estimatedTokens: number,
): Promise<QuotaResult> {
  // Fetch plan from identity service — fail-open on error (graceful degradation)
  const overview = await fetchOverview(accountId);
  const planCode = overview?.subscription?.plan_code ?? 'free';

  const monthlyLimit: number = PLAN_MONTHLY_TOKENS[planCode] ?? FREE_MONTHLY_TOKENS;

  // Enterprise: unlimited, skip all checks
  if (monthlyLimit === 0) {
    return { allowed: true, remaining: -1, total: -1, plan: planCode };
  }

  const usage = await getMonthlyUsage(userId);
  const projectedUsed = usage.used_tokens + estimatedTokens;

  // Within plan limit → increment and allow
  if (projectedUsed <= monthlyLimit) {
    await incrementUsage(userId, estimatedTokens);
    return {
      allowed:   true,
      remaining: monthlyLimit - projectedUsed,
      total:     monthlyLimit,
      plan:      planCode,
    };
  }

  // Over plan limit: free plan → hard block
  if (!LB_FALLBACK_PLANS.has(planCode)) {
    return {
      allowed:   false,
      remaining: Math.max(0, monthlyLimit - usage.used_tokens),
      total:     monthlyLimit,
      plan:      planCode,
      reason:    'insufficient_quota',
      topup_url: 'https://identity.lurus.cn/wallet/topup',
    };
  }

  // Over plan limit: paid plan → attempt LB deduction
  const overageTokens = projectedUsed - monthlyLimit;
  const debit = await deductLubell(accountId, overageTokens);

  if (!debit.success) {
    return {
      allowed:   false,
      remaining: 0,
      total:     monthlyLimit,
      plan:      planCode,
      reason:    'insufficient_balance',
      topup_url: 'https://identity.lurus.cn/wallet/topup',
    };
  }

  const lbSpent = Math.ceil(overageTokens / TOKENS_PER_LB);
  await incrementUsage(userId, estimatedTokens, lbSpent);

  return {
    allowed:   true,
    remaining: 0,
    total:     monthlyLimit,
    plan:      planCode,
    lb_spent:  lbSpent,
  };
}

/**
 * Report actual token consumption to lurus-platform after a successful operation.
 * Fire-and-forget — never throws.
 */
export function consumeQuota(params: {
  accountId?: string;   // numeric identity account ID; skips identity report if absent
  userId: string;
  tokens: number;
  operationType: string;
}): void {
  // Update Redis counter with actual usage (may differ from estimate)
  void incrementUsage(params.userId, params.tokens);

  // Report to identity for VIP accumulation (skip if accountId not provided)
  if (!params.accountId) return;
  void fetch(`${IDENTITY_URL}/internal/v1/usage/report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${IDENTITY_INTERNAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: parseInt(params.accountId, 10),
      amount_cny: params.tokens / TOKENS_PER_LB, // LB equivalent
    }),
    cache: 'no-store',
  }).catch((err: unknown) => {
    console.error('[quota] consumeQuota report failed:', err);
  });
}
