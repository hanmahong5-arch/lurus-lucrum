/**
 * Quota Check Middleware
 * 配额检查中间件
 *
 * Checks user's remaining AI token quota before allowing operations.
 * Calls lurus-api billing endpoints through the existing proxy.
 * If lurus-api is unavailable (>500ms), defaults to allow (graceful degradation).
 */

const LURUS_API_URL = process.env.LURUS_API_URL || 'https://api.lurus.cn';
const LURUS_API_KEY = process.env.LURUS_API_KEY || 'sk-gushenAIQuantTradingPlatform2026';

/** Timeout for billing API calls — fail-open after this */
const BILLING_TIMEOUT_MS = 500;

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  total: number;
  plan: string;
  reason?: string;
}

interface BillingQuotaResponse {
  remaining: number;
  total: number;
  reset_at: string;
  plan: string;
}

/**
 * Fetch the user's current quota from lurus-api.
 * Returns null on timeout or error (fail-open policy).
 */
async function fetchQuota(userId: string): Promise<BillingQuotaResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BILLING_TIMEOUT_MS);

  try {
    const res = await fetch(`${LURUS_API_URL}/billing/quota?user_id=${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${LURUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn('[quota-check] Billing API returned non-OK:', res.status);
      return null;
    }

    return (await res.json()) as BillingQuotaResponse;
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      console.warn('[quota-check] Billing API timed out — failing open');
    } else {
      console.warn('[quota-check] Billing API error:', err);
    }
    return null;
  }
}

/**
 * Notify lurus-api of actual token consumption after a successful operation.
 * Fire-and-forget; never throws.
 */
export function consumeQuota(params: {
  userId: string;
  tokens: number;
  operationType: string;
}): void {
  void fetch(`${LURUS_API_URL}/billing/usage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LURUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: params.userId,
      tokens: params.tokens,
      type: params.operationType,
    }),
    cache: 'no-store',
  }).catch((err: unknown) => {
    console.error('[quota-check] consumeQuota failed:', err);
  });
}

/**
 * Check whether the user has sufficient quota for an operation.
 *
 * Policy:
 * - If lurus-api is unreachable → allow (fail-open, log warning)
 * - free plan: 3 AI calls/day (each ~1000 tokens)
 * - standard: 50 calls/day
 * - premium: unlimited
 */
export async function checkAndConsumeQuota(
  userId: string,
  estimatedTokens: number,
  operationType: string
): Promise<QuotaResult> {
  const quota = await fetchQuota(userId);

  // Fail-open: if we can't reach billing, allow the operation
  if (quota === null) {
    return {
      allowed: true,
      remaining: -1,
      total: -1,
      plan: 'unknown',
    };
  }

  // premium plan has no limit
  if (quota.plan === 'premium') {
    return {
      allowed: true,
      remaining: quota.remaining,
      total: quota.total,
      plan: quota.plan,
    };
  }

  if (quota.remaining < estimatedTokens) {
    return {
      allowed: false,
      remaining: quota.remaining,
      total: quota.total,
      plan: quota.plan,
      reason: `QUOTA_EXCEEDED`,
    };
  }

  // Schedule consumption (async, non-blocking)
  consumeQuota({ userId, tokens: estimatedTokens, operationType });

  return {
    allowed: true,
    remaining: quota.remaining - estimatedTokens,
    total: quota.total,
    plan: quota.plan,
  };
}
