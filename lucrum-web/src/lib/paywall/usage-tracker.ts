/**
 * Client-side Usage Tracker
 *
 * Lightweight localStorage-based tracker for client-side paywall pre-checks.
 * This is a UX optimization — the actual enforcement happens server-side
 * in lib/middleware/usage-tracker.ts (Redis-backed).
 *
 * The client tracker prevents unnecessary API calls by checking limits
 * before the request is made. It auto-resets daily based on date comparison.
 *
 * @module lib/paywall/usage-tracker
 */

import { getUsageLimits, type UserPlan } from "./usage-limits";

// =============================================================================
// TYPES
// =============================================================================

export type UsageType = "ai" | "backtest";

interface DailyUsageData {
  /** Date string in YYYY-MM-DD format (Beijing time) */
  date: string;
  /** AI strategy generation count */
  ai: number;
  /** Backtest count */
  backtest: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = "lucrum_daily_usage";

// =============================================================================
// HELPERS
// =============================================================================

/** Get today's date in Beijing timezone (UTC+8), formatted as YYYY-MM-DD */
function getTodayBeijing(): string {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(0, 10);
}

/** Read usage data from localStorage, auto-resetting if date has changed */
function readUsage(): DailyUsageData {
  const today = getTodayBeijing();
  const defaults: DailyUsageData = { date: today, ai: 0, backtest: 0 };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as DailyUsageData;

    // Auto-reset if not today
    if (parsed.date !== today) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }

    return {
      date: parsed.date,
      ai: typeof parsed.ai === "number" ? parsed.ai : 0,
      backtest: typeof parsed.backtest === "number" ? parsed.backtest : 0,
    };
  } catch {
    return defaults;
  }
}

/** Write usage data to localStorage */
function writeUsage(data: DailyUsageData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Increment the usage counter for a feature type.
 * Call this after a successful API call (AI generation or backtest).
 */
export function trackUsage(type: UsageType): void {
  const data = readUsage();
  data[type] += 1;
  writeUsage(data);
}

/**
 * Get the number of times a feature has been used today.
 */
export function getUsageToday(type: UsageType): number {
  return readUsage()[type];
}

/**
 * Get the remaining usage count for a feature today.
 * Returns Infinity for unlimited plans.
 */
export function getRemainingToday(
  type: UsageType,
  plan: UserPlan | string | undefined | null,
): number {
  const limits = getUsageLimits(plan);
  const used = getUsageToday(type);
  const limit = type === "ai" ? limits.aiGenerations : limits.backtests;
  if (!isFinite(limit)) return Infinity;
  return Math.max(0, limit - used);
}

/**
 * Check if the daily limit has been reached for a feature.
 * Returns false (not blocked) for unlimited plans.
 */
export function isLimitReached(
  type: UsageType,
  plan: UserPlan | string | undefined | null,
): boolean {
  const remaining = getRemainingToday(type, plan);
  return remaining <= 0;
}

/**
 * Sync local tracker with server-reported usage data.
 * Called when the server returns usage info (e.g., from /api/usage/status).
 */
export function syncFromServer(
  aiUsed: number | undefined,
  backtestUsed: number | undefined,
): void {
  const data = readUsage();
  if (typeof aiUsed === "number") data.ai = aiUsed;
  if (typeof backtestUsed === "number") data.backtest = backtestUsed;
  writeUsage(data);
}
