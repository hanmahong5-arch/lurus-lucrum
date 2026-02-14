/**
 * MetricComparisonTable Component
 *
 * Displays a grouped, side-by-side comparison of metrics between two strategies.
 * Each row shows Strategy A value, Strategy B value, and the difference
 * with directional indicators (arrows + colors).
 *
 * @module components/backtest/comparison/metric-comparison-table
 */

"use client";

import { cn } from "@/lib/utils";
import type { MetricGroup, MetricDiff, MetricWinner } from "@/lib/comparison/types";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Format display values based on metric format type */
function formatValue(value: number, key: string): string {
  // Percent format: multiply by 100 and show %
  const percentKeys = [
    "totalReturn",
    "annualizedReturn",
    "returnVolatility",
    "maxDrawdown",
    "winRate",
  ];
  if (percentKeys.includes(key)) {
    return `${(value * 100).toFixed(2)}%`;
  }

  // Ratio format: show 2 decimal places
  const ratioKeys = ["sharpeRatio", "sortinoRatio", "calmarRatio", "profitFactor"];
  if (ratioKeys.includes(key)) {
    return value.toFixed(2);
  }

  // Days format
  if (key === "avgHoldingDays") {
    return `${value.toFixed(1)}d`;
  }

  // Count format: integers
  return Math.round(value).toString();
}

/** Direction arrow and color class */
function getDiffDisplay(diff: MetricDiff): {
  arrow: string;
  colorClass: string;
  diffText: string;
} {
  if (diff.directionForA === "neutral") {
    return { arrow: "-", colorClass: "text-muted-foreground", diffText: "-" };
  }

  const absDiff = Math.abs(diff.absoluteDiff);
  const pctText =
    diff.percentDiff !== null ? ` (${Math.abs(diff.percentDiff).toFixed(1)}%)` : "";

  if (diff.directionForA === "better") {
    return {
      arrow: "▲",
      colorClass: "text-profit",
      diffText: `${formatValue(absDiff, diff.key)}${pctText}`,
    };
  }

  return {
    arrow: "▼",
    colorClass: "text-loss",
    diffText: `${formatValue(absDiff, diff.key)}${pctText}`,
  };
}

/** Winner highlight class for a cell */
function getWinnerHighlight(winner: MetricWinner, side: "a" | "b"): string {
  if (winner === "tie") return "";
  if (winner === side) return "bg-profit/5";
  return "";
}

// =============================================================================
// TYPES / 类型
// =============================================================================

export interface MetricComparisonTableProps {
  /** Metric groups to display */
  groups: MetricGroup[];
  /** Strategy A name */
  nameA: string;
  /** Strategy B name */
  nameB: string;
  /** Additional className */
  className?: string;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function MetricComparisonTable({
  groups,
  nameA,
  nameB,
  className,
}: MetricComparisonTableProps) {
  return (
    <div
      className={cn("overflow-x-auto", className)}
      role="table"
      aria-label="策略指标对比表"
    >
      {/* Table Header */}
      <div
        className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-0 border-b border-border px-2 py-2 text-xs text-muted-foreground"
        role="row"
      >
        <div role="columnheader">指标</div>
        <div role="columnheader" className="text-right font-mono">
          {nameA}
        </div>
        <div role="columnheader" className="text-right font-mono">
          {nameB}
        </div>
        <div role="columnheader" className="text-right">
          差异
        </div>
      </div>

      {/* Metric Groups */}
      {groups.map((group) => (
        <div key={group.key} data-testid={`metric-group-${group.key}`}>
          {/* Group Header */}
          <div
            className="border-b border-border/50 bg-surface-elevated px-2 py-1.5 text-xs font-medium text-muted-foreground"
            role="row"
          >
            <span role="cell">{group.label}</span>
          </div>

          {/* Metric Rows */}
          {group.metrics.map((metric) => {
            const diffDisplay = getDiffDisplay(metric);

            return (
              <div
                key={metric.key}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-0 border-b border-border/30 px-2 py-1.5 text-sm hover:bg-muted/10"
                role="row"
                data-testid={`metric-row-${metric.key}`}
              >
                {/* Label */}
                <div
                  role="cell"
                  className="flex items-center text-foreground/80"
                >
                  {metric.label}
                </div>

                {/* Strategy A Value */}
                <div
                  role="cell"
                  className={cn(
                    "text-right font-mono tabular-nums",
                    getWinnerHighlight(metric.winner, "a")
                  )}
                >
                  {formatValue(metric.valueA, metric.key)}
                </div>

                {/* Strategy B Value */}
                <div
                  role="cell"
                  className={cn(
                    "text-right font-mono tabular-nums",
                    getWinnerHighlight(metric.winner, "b")
                  )}
                >
                  {formatValue(metric.valueB, metric.key)}
                </div>

                {/* Difference */}
                <div
                  role="cell"
                  className={cn(
                    "flex items-center justify-end gap-1 font-mono tabular-nums text-xs",
                    diffDisplay.colorClass
                  )}
                >
                  <span aria-hidden="true">{diffDisplay.arrow}</span>
                  <span>{diffDisplay.diffText}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
