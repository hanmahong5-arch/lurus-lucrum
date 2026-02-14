/**
 * WinnerSummary Component
 *
 * Displays the overall comparison winner with category breakdown.
 * Shows key advantages and a human-readable summary.
 *
 * @module components/backtest/comparison/winner-summary
 */

"use client";

import { cn } from "@/lib/utils";
import type { CategoryWinners, MetricWinner } from "@/lib/comparison/types";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  byReturn: "收益",
  byRisk: "风险",
  byTrading: "交易效率",
};

/** Winner badge display config */
function getWinnerBadge(
  winner: MetricWinner,
  nameA: string,
  nameB: string
): { text: string; colorClass: string } {
  if (winner === "tie") {
    return { text: "平手", colorClass: "text-muted-foreground" };
  }
  if (winner === "a") {
    return { text: nameA, colorClass: "text-profit" };
  }
  return { text: nameB, colorClass: "text-score-a" };
}

// =============================================================================
// TYPES / 类型
// =============================================================================

export interface WinnerSummaryProps {
  /** Category winners breakdown */
  winners: CategoryWinners;
  /** Strategy A name */
  nameA: string;
  /** Strategy B name */
  nameB: string;
  /** Human-readable summary text */
  summaryText: string;
  /** Additional className */
  className?: string;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function WinnerSummary({
  winners,
  nameA,
  nameB,
  summaryText,
  className,
}: WinnerSummaryProps) {
  const overallBadge = getWinnerBadge(winners.overall, nameA, nameB);

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface-elevated p-4",
        winners.overall === "a" && "border-profit/30",
        winners.overall === "b" && "border-score-a/30",
        winners.overall === "tie" && "border-muted",
        className
      )}
      role="region"
      aria-label="对比结论"
      data-testid="winner-summary"
    >
      {/* Overall Winner */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">综合胜者</span>
          <span
            className={cn("text-sm font-semibold", overallBadge.colorClass)}
            data-testid="overall-winner"
          >
            {overallBadge.text}
          </span>
        </div>
      </div>

      {/* Summary Text */}
      <p
        className="text-sm text-foreground/80 mb-3"
        data-testid="summary-text"
      >
        {summaryText}
      </p>

      {/* Category Breakdown */}
      <div className="flex gap-4 flex-wrap">
        {(
          Object.entries(CATEGORY_LABELS) as Array<
            [keyof typeof CATEGORY_LABELS, string]
          >
        ).map(([key, label]) => {
          const winner = winners[key as keyof CategoryWinners] as MetricWinner;
          const badge = getWinnerBadge(winner, nameA, nameB);

          return (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs"
              data-testid={`category-${key}`}
            >
              <span className="text-muted-foreground">{label}:</span>
              <span className={cn("font-medium", badge.colorClass)}>
                {badge.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
