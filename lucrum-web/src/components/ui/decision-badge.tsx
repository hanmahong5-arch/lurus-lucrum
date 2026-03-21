"use client";

/**
 * DecisionBadge Component
 *
 * Smart badges that help users evaluate strategies at a glance.
 * Badges are computed automatically from metrics data.
 *
 * Two badge sets:
 * 1. BacktestDecisionBadges - computed from backtest result metrics
 * 2. MarketplaceDecisionBadges - computed from marketplace strategy data
 */

import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface DecisionBadgeItem {
  /** Badge key for React key */
  key: string;
  /** Display label (Chinese) */
  label: string;
  /** Visual variant for coloring */
  variant: "positive" | "warning" | "neutral" | "hot";
}

export interface BacktestMetricsInput {
  annualizedReturn?: number | null;
  maxDrawdown?: number | null;
  winRate?: number | null;
  sharpeRatio?: number | null;
  avgHoldingDays?: number | null;
  tradeCount?: number | null;
  profitFactor?: number | null;
}

export interface MarketplaceMetricsInput {
  annualizedReturn?: number | null;
  maxDrawdown?: number | null;
  winRate?: number | null;
  sharpeRatio?: number | null;
  totalRuns?: number | null;
  totalSubscribers?: number | null;
  publishedAt?: string | null;
  /** Whether the strategy has been independently validated */
  verified?: boolean;
}

// =============================================================================
// Badge computation: Backtest
// =============================================================================

/**
 * Compute decision badges from backtest metrics.
 * Returns only applicable badges (max ~4 to avoid clutter).
 */
export function computeBacktestBadges(
  metrics: BacktestMetricsInput,
): DecisionBadgeItem[] {
  const badges: DecisionBadgeItem[] = [];

  const annualized = metrics.annualizedReturn ?? null;
  const maxDD = metrics.maxDrawdown ?? null;
  const winRate = metrics.winRate ?? null;
  const sharpe = metrics.sharpeRatio ?? null;
  const holdDays = metrics.avgHoldingDays ?? null;
  const trades = metrics.tradeCount ?? null;
  const pf = metrics.profitFactor ?? null;

  // High return (tiered)
  if (annualized !== null && annualized > 30) {
    badges.push({ key: "high-return", label: "高收益", variant: "positive" });
  } else if (annualized !== null && annualized > 15) {
    badges.push({ key: "good-return", label: "收益良好", variant: "positive" });
  }

  // High Sharpe
  if (sharpe !== null && sharpe > 2) {
    badges.push({ key: "high-sharpe", label: "高夏普", variant: "positive" });
  }

  // High win rate
  if (winRate !== null && winRate > 65) {
    badges.push({ key: "high-winrate", label: "高胜率", variant: "positive" });
  }

  // High profit factor
  if (pf !== null && pf > 2) {
    badges.push({ key: "high-pf", label: "高盈亏比", variant: "positive" });
  }

  // High drawdown warning (>25 per spec)
  if (maxDD !== null && Math.abs(maxDD) > 25) {
    badges.push({ key: "high-dd", label: "高回撤", variant: "warning" });
  }

  // Short-term strategy
  if (holdDays !== null && holdDays < 5) {
    badges.push({ key: "short-term", label: "短线策略", variant: "neutral" });
  } else if (holdDays !== null && holdDays > 20) {
    badges.push({ key: "long-term", label: "中长线", variant: "neutral" });
  }

  // Low trade count warning
  if (trades !== null && trades < 10) {
    badges.push({ key: "low-trades", label: "样本不足", variant: "warning" });
  }

  // Trend-following indicator (high win rate + moderate hold)
  if (
    winRate !== null &&
    holdDays !== null &&
    winRate > 50 &&
    holdDays >= 5 &&
    holdDays <= 20
  ) {
    badges.push({ key: "trend", label: "适合趋势市", variant: "neutral" });
  }

  // Cap at 4 badges to avoid clutter
  return badges.slice(0, 4);
}

// =============================================================================
// Badge computation: Marketplace
// =============================================================================

/**
 * Compute decision badges from marketplace strategy data.
 */
export function computeMarketplaceBadges(
  metrics: MarketplaceMetricsInput,
): DecisionBadgeItem[] {
  const badges: DecisionBadgeItem[] = [];

  const annualized = metrics.annualizedReturn ?? null;
  const maxDD = metrics.maxDrawdown ?? null;
  const sharpe = metrics.sharpeRatio ?? null;
  const winRate = metrics.winRate ?? null;
  const runs = metrics.totalRuns ?? 0;
  const subs = metrics.totalSubscribers ?? 0;

  // Hot (popular)
  if (runs > 100 || subs > 50) {
    badges.push({ key: "hot", label: "本月热门", variant: "hot" });
  }

  // Verified
  if (metrics.verified) {
    badges.push({ key: "verified", label: "已验证", variant: "positive" });
  }

  // High Sharpe
  if (sharpe !== null && sharpe > 2) {
    badges.push({ key: "high-sharpe", label: "高夏普", variant: "positive" });
  }

  // High return
  if (annualized !== null && annualized > 30) {
    badges.push({ key: "high-return", label: "高收益", variant: "positive" });
  }

  // High win rate
  if (winRate !== null && winRate > 65) {
    badges.push({ key: "high-winrate", label: "高胜率", variant: "positive" });
  }

  // High drawdown warning
  if (maxDD !== null && Math.abs(maxDD) > 20) {
    badges.push({ key: "high-dd", label: "高回撤", variant: "warning" });
  }

  return badges.slice(0, 4);
}

// =============================================================================
// Badge display component
// =============================================================================

const VARIANT_STYLES: Record<DecisionBadgeItem["variant"], string> = {
  positive: "bg-profit/10 text-profit border-profit/20",
  warning: "bg-accent/10 text-accent border-accent/20",
  neutral: "bg-white/5 text-white/50 border-white/10",
  hot: "bg-score-s/10 text-score-s border-score-s/20",
};

export function DecisionBadge({ badge }: { badge: DecisionBadgeItem }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium",
        VARIANT_STYLES[badge.variant],
      )}
    >
      {badge.label}
    </span>
  );
}

/**
 * Renders a row of decision badges from metrics.
 */
export function DecisionBadgeRow({
  badges,
  className,
}: {
  badges: DecisionBadgeItem[];
  className?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((badge) => (
        <DecisionBadge key={badge.key} badge={badge} />
      ))}
    </div>
  );
}

// =============================================================================
// Convenience wrappers
// =============================================================================

/**
 * Auto-compute and render backtest decision badges from metrics.
 */
export function BacktestDecisionBadges({
  metrics,
  className,
}: {
  metrics: BacktestMetricsInput;
  className?: string;
}) {
  const badges = computeBacktestBadges(metrics);
  return <DecisionBadgeRow badges={badges} className={className} />;
}

/**
 * Auto-compute and render marketplace decision badges from strategy data.
 */
export function MarketplaceDecisionBadges({
  metrics,
  className,
}: {
  metrics: MarketplaceMetricsInput;
  className?: string;
}) {
  const badges = computeMarketplaceBadges(metrics);
  return <DecisionBadgeRow badges={badges} className={className} />;
}

// =============================================================================
// Shorthand: flat-props interface (matches spec DecisionBadgesProps)
// =============================================================================

export interface DecisionBadgesProps {
  annualReturn?: number;
  maxDrawdown?: number;
  winRate?: number;
  sharpe?: number;
  avgHoldingDays?: number;
  totalTrades?: number;
  className?: string;
}

/**
 * Convenience component that accepts flat metric props and renders badges.
 * Useful when metrics are available as individual values rather than an object.
 */
export function DecisionBadges({
  annualReturn,
  maxDrawdown,
  winRate,
  sharpe,
  avgHoldingDays,
  totalTrades,
  className,
}: DecisionBadgesProps) {
  const badges = computeBacktestBadges({
    annualizedReturn: annualReturn,
    maxDrawdown: maxDrawdown,
    winRate: winRate,
    sharpeRatio: sharpe,
    avgHoldingDays: avgHoldingDays,
    tradeCount: totalTrades,
  });
  return <DecisionBadgeRow badges={badges} className={className} />;
}
