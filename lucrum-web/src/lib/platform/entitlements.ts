/**
 * Entitlement-Based Feature Gating
 *
 * Resolves Zitadel sub -> platform account -> entitlements for lurus-lucrum.
 * Caches resolved tier in Redis (60s) to avoid per-request platform calls.
 */

import { getRedis } from '@/lib/redis';
import {
  getAccountByZitadelSub,
  getEntitlements,
  PlatformError,
} from './client';

export type EntitlementTier = 'free' | 'standard' | 'premium';

const CACHE_PREFIX = 'entitlement:lucrum:';
const CACHE_TTL_SECONDS = 60;
const PRODUCT_ID = 'lurus-lucrum';

/**
 * Resolve the entitlement tier for a Zitadel user.
 *
 * Lookup chain:
 *   1. Redis cache (60s TTL)
 *   2. Platform API: resolve sub -> account ID -> entitlements
 *   3. Fallback: 'free' on any error (fail-open)
 */
export async function getEntitlementTier(zitadelSub: string): Promise<EntitlementTier> {
  // 1. Check cache
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}${zitadelSub}`);
      if (cached && isValidTier(cached)) {
        return cached;
      }
    } catch {
      // Redis unavailable — proceed to platform call
    }
  }

  // 2. Resolve from platform
  try {
    const account = await getAccountByZitadelSub(zitadelSub);
    const ents = await getEntitlements(account.id, PRODUCT_ID);

    const tier = mapEntitlementsToTier(ents);

    // Cache result
    if (redis) {
      void redis.set(`${CACHE_PREFIX}${zitadelSub}`, tier, 'EX', CACHE_TTL_SECONDS)
        .catch(() => { /* ignore cache write failure */ });
    }

    return tier;
  } catch (err) {
    // Fail-open: if platform is down, default to free
    if (err instanceof PlatformError) {
      console.warn(`[entitlements] platform error for ${zitadelSub}: ${err.code}`);
    }
    return 'free';
  }
}

/**
 * Invalidate cached entitlement tier (e.g., after subscription change).
 */
export async function invalidateEntitlementCache(zitadelSub: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${CACHE_PREFIX}${zitadelSub}`).catch(() => {});
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────────

function isValidTier(value: string): value is EntitlementTier {
  return value === 'free' || value === 'standard' || value === 'premium';
}

function mapEntitlementsToTier(ents: Record<string, string>): EntitlementTier {
  // Platform entitlements use a "tier" key, or we infer from plan_code
  const tier = ents['tier'] ?? ents['plan_tier'] ?? ents['plan_code'];
  if (tier === 'premium' || tier === 'enterprise') return 'premium';
  if (tier === 'standard' || tier === 'pro' || tier === 'basic') return 'standard';
  return 'free';
}
