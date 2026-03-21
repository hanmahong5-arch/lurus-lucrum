/**
 * Usage Limits — Client-side Constants
 *
 * Single source of truth for free/pro feature limits displayed in the UI.
 * Server-side enforcement lives in lib/config/plan-limits.ts + lib/middleware/usage-tracker.ts.
 * This module provides lightweight constants for client components that need
 * to display limit information without importing the full server config.
 *
 * @module lib/paywall/usage-limits
 */

// =============================================================================
// TYPES
// =============================================================================

export type UserPlan = "free" | "basic" | "pro" | "enterprise";

export interface UsageLimits {
  /** Max AI strategy generations per day */
  aiGenerations: number;
  /** Max backtests per day */
  backtests: number;
  /** Number of accessible strategy templates */
  templates: number;
  /** Max stocks in multi-stock validation */
  multiStockMax: number;
  /** Historical data lookback in years */
  historyYears: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const FREE_LIMITS: UsageLimits = {
  aiGenerations: 3,
  backtests: 5,
  templates: 5,
  multiStockMax: 3,
  historyYears: 1,
};

export const PRO_LIMITS: UsageLimits = {
  aiGenerations: Infinity,
  backtests: Infinity,
  templates: Infinity,
  multiStockMax: 50,
  historyYears: 10,
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get usage limits for a given plan.
 * For unknown/null plans, defaults to free tier.
 */
export function getUsageLimits(plan: UserPlan | string | undefined | null): UsageLimits {
  const normalized = plan?.toLowerCase() ?? "free";
  switch (normalized) {
    case "pro":
    case "enterprise":
      return PRO_LIMITS;
    case "basic":
      return {
        aiGenerations: 30,
        backtests: 50,
        templates: Infinity,
        multiStockMax: 5,
        historyYears: 3,
      };
    case "free":
    default:
      return FREE_LIMITS;
  }
}
