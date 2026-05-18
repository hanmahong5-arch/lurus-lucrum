/**
 * Plan Limits Configuration
 * Single source of truth for feature limits per subscription plan.
 *
 * Tier codes match lurus-platform plan_code values:
 *   free → Explorer | basic → Trader | pro → Pro | enterprise → Enterprise
 *
 * @module lib/config/plan-limits
 */

// =============================================================================
// TYPES
// =============================================================================

export type PlanTier = "free" | "basic" | "pro" | "enterprise";

export interface PlanLimits {
  /** Max backtests per day (Infinity = unlimited) */
  dailyBacktests: number;
  /** Max AI strategy generations per day */
  dailyAiCalls: number;
  /** Number of accessible builtin templates */
  accessibleTemplates: number;
  /** Max stocks in multi-stock validation (0 = not available) */
  maxMultiStocks: number;
  /** Historical data lookback in years */
  historyYears: number;
  /** Whether advanced metrics are available */
  advancedMetrics: boolean;
  /** Max saved backtest results */
  maxSavedResults: number;
  /** Whether data export is available */
  dataExport: "none" | "csv" | "csv_json_pdf";
  /** Strategy marketplace access level */
  marketplace: "browse" | "subscribe" | "publish";
  /** Max marketplace strategy subscriptions (Infinity = unlimited) */
  maxMarketplaceSubs: number;
  /** AI advisor mode */
  advisorMode: "none" | "single" | "full";
  /** Strategy diagnostics rule count (0 = not available) */
  diagnosticRules: number;
  /** Custom agent tier limits */
  customAgent: {
    maxAgents: number;
    runsPerDay: number;
    maxStocks: number;
    allowDeep: boolean;
  };
}

/** Display info for each plan tier */
export interface PlanDisplayInfo {
  code: PlanTier;
  name: string;
  nameEn: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  icon: string;
  highlighted?: boolean;
}

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    // Bumped 5→10 (2026-05-18) per analyst risk #3 hedging — give free users
    // enough runway to evaluate before hitting paywall; below 10 the funnel
    // dies before strategy-validation completes. dailyAiCalls stays 3 since
    // LLM cost dwarfs backtest cost and is the actual cash-burn channel.
    dailyBacktests: 10,
    dailyAiCalls: 3,
    accessibleTemplates: 5,
    maxMultiStocks: 3,
    historyYears: 1,
    advancedMetrics: false,
    maxSavedResults: 3,
    dataExport: "none",
    marketplace: "browse",
    maxMarketplaceSubs: 0,
    advisorMode: "none",
    diagnosticRules: 0,
    customAgent: { maxAgents: 2, runsPerDay: 2, maxStocks: 5, allowDeep: false },
  },
  basic: {
    dailyBacktests: 50,
    dailyAiCalls: 30,
    accessibleTemplates: Infinity,
    maxMultiStocks: 5,
    historyYears: 3,
    advancedMetrics: true,
    maxSavedResults: 30,
    dataExport: "csv",
    marketplace: "subscribe",
    maxMarketplaceSubs: 3,
    advisorMode: "single",
    diagnosticRules: 5,
    customAgent: { maxAgents: 5, runsPerDay: 10, maxStocks: 15, allowDeep: false },
  },
  pro: {
    dailyBacktests: Infinity,
    dailyAiCalls: Infinity,
    accessibleTemplates: Infinity,
    maxMultiStocks: 50,
    historyYears: 10,
    advancedMetrics: true,
    maxSavedResults: Infinity,
    dataExport: "csv_json_pdf",
    marketplace: "publish",
    maxMarketplaceSubs: Infinity,
    advisorMode: "full",
    diagnosticRules: 20,
    customAgent: { maxAgents: -1, runsPerDay: -1, maxStocks: -1, allowDeep: true },
  },
  enterprise: {
    dailyBacktests: Infinity,
    dailyAiCalls: Infinity,
    accessibleTemplates: Infinity,
    maxMultiStocks: Infinity,
    historyYears: Infinity,
    advancedMetrics: true,
    maxSavedResults: Infinity,
    dataExport: "csv_json_pdf",
    marketplace: "publish",
    maxMarketplaceSubs: Infinity,
    advisorMode: "full",
    diagnosticRules: Infinity,
    customAgent: { maxAgents: -1, runsPerDay: -1, maxStocks: -1, allowDeep: true },
  },
};

/** Display metadata for plan tiers */
export const PLAN_DISPLAY: PlanDisplayInfo[] = [
  {
    code: "free",
    name: "体验者",
    nameEn: "Explorer",
    tagline: "先让你爱上，再让你付费",
    priceMonthly: 0,
    priceYearly: 0,
    icon: "🔍",
  },
  {
    code: "basic",
    name: "进阶者",
    nameEn: "Trader",
    tagline: "想多验证几只股票的那个瞬间",
    priceMonthly: 49,
    priceYearly: 468,
    icon: "📈",
    highlighted: true,
  },
  {
    code: "pro",
    name: "专业者",
    nameEn: "Pro",
    tagline: "当你开始认真对待策略",
    priceMonthly: 149,
    priceYearly: 1428,
    icon: "🏆",
  },
  {
    code: "enterprise",
    name: "机构",
    nameEn: "Enterprise",
    tagline: "团队级部署和定制",
    priceMonthly: -1,
    priceYearly: -1,
    icon: "🏢",
  },
];

// =============================================================================
// LEGACY MAPPING
// =============================================================================

/** Map old tier names (standard/premium) to new codes for backward compat */
const LEGACY_TIER_MAP: Record<string, PlanTier> = {
  standard: "basic",
  premium: "pro",
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get feature limits for a given plan tier.
 * Accepts both new codes (free/basic/pro/enterprise) and legacy names (standard/premium).
 * Defaults to "free" for unknown/missing values.
 */
export function getLimitsForPlan(plan: string | undefined | null): PlanLimits {
  const raw = plan?.toLowerCase() ?? "free";
  const tier = (LEGACY_TIER_MAP[raw] ?? raw) as PlanTier;
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
}

/**
 * Normalize any plan code (including legacy) to a valid PlanTier.
 */
export function normalizePlanTier(plan: string | undefined | null): PlanTier {
  const raw = plan?.toLowerCase() ?? "free";
  const mapped = LEGACY_TIER_MAP[raw] ?? raw;
  return (mapped in PLAN_LIMITS) ? mapped as PlanTier : "free";
}

/**
 * Get display info for a plan tier.
 */
export function getPlanDisplay(plan: string | undefined | null): PlanDisplayInfo {
  const tier = normalizePlanTier(plan);
  return PLAN_DISPLAY.find((p) => p.code === tier) ?? PLAN_DISPLAY[0]!;
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
