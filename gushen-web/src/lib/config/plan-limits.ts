/**
 * Plan Limits Configuration
 * Single source of truth for feature limits per subscription plan.
 *
 * @module lib/config/plan-limits
 */

// =============================================================================
// TYPES
// =============================================================================

export type PlanTier = "free" | "standard" | "premium";

export interface PlanLimits {
  /** Max backtests per day (Infinity = unlimited) */
  dailyBacktests: number;
  /** Max AI calls per day (Infinity = unlimited) */
  dailyAiCalls: number;
  /** Number of accessible builtin templates */
  accessibleTemplates: number;
  /** Max stocks in multi-stock validation */
  maxMultiStocks: number;
  /** Historical data lookback in years */
  historyYears: number;
  /** Whether advanced metrics are available */
  advancedMetrics: boolean;
  /** Custom agent tier limits */
  customAgent: {
    maxAgents: number;
    runsPerDay: number;
    maxStocks: number;
    allowDeep: boolean;
  };
}

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    dailyBacktests: 5,
    dailyAiCalls: 3,
    accessibleTemplates: 3,
    maxMultiStocks: 3,
    historyYears: 1,
    advancedMetrics: false,
    customAgent: { maxAgents: 2, runsPerDay: 2, maxStocks: 5, allowDeep: false },
  },
  standard: {
    dailyBacktests: 50,
    dailyAiCalls: 50,
    accessibleTemplates: Infinity,
    maxMultiStocks: 50,
    historyYears: 5,
    advancedMetrics: true,
    customAgent: { maxAgents: 10, runsPerDay: 20, maxStocks: 30, allowDeep: true },
  },
  premium: {
    dailyBacktests: Infinity,
    dailyAiCalls: Infinity,
    accessibleTemplates: Infinity,
    maxMultiStocks: 100,
    historyYears: 10,
    advancedMetrics: true,
    customAgent: { maxAgents: -1, runsPerDay: -1, maxStocks: -1, allowDeep: true },
  },
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get feature limits for a given plan tier.
 * Defaults to "free" for unknown/missing values.
 */
export function getLimitsForPlan(plan: string | undefined | null): PlanLimits {
  const tier = (plan?.toLowerCase() ?? "free") as PlanTier;
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
}

/** Feature keys used in usage tracking */
export type UsageFeature = "backtest" | "ai_call" | "custom_agent_run";

/**
 * Get the daily limit for a specific feature based on plan.
 */
export function getFeatureLimit(
  plan: string | undefined | null,
  feature: UsageFeature,
): number {
  const limits = getLimitsForPlan(plan);
  switch (feature) {
    case "backtest":
      return limits.dailyBacktests;
    case "ai_call":
      return limits.dailyAiCalls;
    case "custom_agent_run":
      return limits.customAgent.runsPerDay === -1
        ? Infinity
        : limits.customAgent.runsPerDay;
    default:
      return 0;
  }
}
