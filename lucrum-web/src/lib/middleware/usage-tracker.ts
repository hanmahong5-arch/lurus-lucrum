/**
 * Server-side Usage Tracker
 * Tracks daily feature usage per user via Redis with in-memory fallback.
 *
 * Redis key format: usage:{userId}:{feature}:{YYYY-MM-DD}
 * TTL: 48 hours (covers timezone edge cases)
 *
 * @module lib/middleware/usage-tracker
 */

import { getRedis } from "@/lib/redis/client";
import {
  getFeatureLimit,
  type UsageFeature,
} from "@/lib/config/plan-limits";

// =============================================================================
// TYPES
// =============================================================================

export interface UsageStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** ISO string of when the counter resets (next midnight UTC+8) */
  resetAt: string;
}

// =============================================================================
// IN-MEMORY FALLBACK
// =============================================================================

/** Fallback store when Redis is unavailable. Keyed by the same Redis key format. */
const memoryStore = new Map<string, number>();

/** Periodically clean up expired keys from the memory store */
const MEMORY_CLEANUP_INTERVAL = 600_000; // 10 min
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const todayKey = getTodayKey();
    memoryStore.forEach((_value, key) => {
      // Keys contain the date segment; prune keys that don't match today
      if (!key.includes(todayKey)) {
        memoryStore.delete(key);
      }
    });
  }, MEMORY_CLEANUP_INTERVAL);
  // Allow process to exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// =============================================================================
// HELPERS
// =============================================================================

const USAGE_TTL_SECONDS = 48 * 60 * 60; // 48 hours

/** Get today's date key in Beijing timezone (UTC+8) */
function getTodayKey(): string {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Get the next midnight (Beijing time) as ISO string */
function getResetAt(): string {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const tomorrow = new Date(bj);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  // Convert back from BJ to UTC
  const resetUtc = new Date(tomorrow.getTime() - 8 * 60 * 60 * 1000);
  return resetUtc.toISOString();
}

function buildKey(userId: string, feature: string): string {
  return `usage:${userId}:${feature}:${getTodayKey()}`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check whether a user can use a feature and return current usage stats.
 * Fail-open: if Redis is unavailable, uses in-memory counter.
 */
export async function checkUsage(
  userId: string,
  feature: UsageFeature,
  plan: string | undefined | null,
): Promise<UsageStatus> {
  const limit = getFeatureLimit(plan, feature);
  const key = buildKey(userId, feature);

  // Unlimited plan
  if (!isFinite(limit)) {
    return { allowed: true, used: 0, limit, remaining: Infinity, resetAt: getResetAt() };
  }

  let used = 0;
  const redis = getRedis();

  if (redis) {
    try {
      const val = await redis.get(key);
      used = val ? parseInt(val, 10) : 0;
    } catch {
      // Fall through to memory store
      used = memoryStore.get(key) ?? 0;
    }
  } else {
    ensureCleanupTimer();
    used = memoryStore.get(key) ?? 0;
  }

  if (isNaN(used)) used = 0;

  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    resetAt: getResetAt(),
  };
}

/**
 * Increment usage counter for a feature. Fire-and-forget.
 * Does not throw — logs errors and continues.
 */
export async function incrementUsage(
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const key = buildKey(userId, feature);
  const redis = getRedis();

  if (redis) {
    try {
      const newVal = await redis.incr(key);
      // Set TTL only on first increment
      if (newVal === 1) {
        await redis.expire(key, USAGE_TTL_SECONDS);
      }
      return;
    } catch (err) {
      console.error("[UsageTracker] Redis incr failed, falling back to memory:", err);
    }
  }

  // In-memory fallback
  ensureCleanupTimer();
  const current = memoryStore.get(key) ?? 0;
  memoryStore.set(key, current + 1);
}
