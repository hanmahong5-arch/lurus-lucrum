"use client";

/**
 * StrategyComparison - Side-by-side metric comparison for selected strategies.
 * Opens as a dialog when 2+ strategies are selected in comparison mode.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketplaceStrategy } from "./strategy-card";

// =============================================================================
// TYPES
// =============================================================================

interface StrategyComparisonProps {
  strategies: MarketplaceStrategy[];
  onClose: () => void;
}

interface MetricRow {
  label: string;
  key: string;
  format: (s: MarketplaceStrategy) => string;
  colorFn?: (s: MarketplaceStrategy) => string;
}

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

const METRIC_ROWS: MetricRow[] = [
  {
    label: "评级",
    key: "grade",
    format: (s) => s.gradeScore?.charAt(0).toUpperCase() ?? "--",
    colorFn: (s) => {
      const g = s.gradeScore?.charAt(0).toUpperCase();
      if (g === "S") return "text-score-s";
      if (g === "A") return "text-score-a";
      if (g === "B") return "text-score-b";
      return "text-white/60";
    },
  },
  {
    label: "年化收益",
    key: "annualized",
    format: (s) =>
      s.annualizedReturn != null
        ? `${s.annualizedReturn >= 0 ? "+" : ""}${s.annualizedReturn.toFixed(1)}%`
        : "--",
    colorFn: (s) =>
      s.annualizedReturn != null
        ? s.annualizedReturn >= 0
          ? "text-profit"
          : "text-loss"
        : "text-white/40",
  },
  {
    label: "胜率",
    key: "winRate",
    format: (s) => (s.winRate != null ? `${s.winRate.toFixed(1)}%` : "--"),
  },
  {
    label: "最大回撤",
    key: "maxDD",
    format: (s) => (s.maxDrawdown != null ? `${s.maxDrawdown.toFixed(1)}%` : "--"),
    colorFn: (s) =>
      s.maxDrawdown != null && s.maxDrawdown < 0 ? "text-loss" : "text-white/60",
  },
  {
    label: "Sharpe",
    key: "sharpe",
    format: (s) => (s.sharpeRatio != null ? s.sharpeRatio.toFixed(2) : "--"),
    colorFn: (s) =>
      s.sharpeRatio != null
        ? s.sharpeRatio >= 1.5
          ? "text-profit"
          : s.sharpeRatio >= 1.0
            ? "text-accent"
            : "text-white/60"
        : "text-white/40",
  },
  {
    label: "总运行次数",
    key: "runs",
    format: (s) => String(s.totalRuns ?? 0),
  },
  {
    label: "订阅人数",
    key: "subs",
    format: (s) => String(s.totalSubscribers ?? 0),
  },
  {
    label: "评分",
    key: "rating",
    format: (s) => (s.rating != null ? s.rating.toFixed(1) : "--"),
  },
  {
    label: "价格",
    key: "price",
    format: (s) =>
      s.priceType === "free"
        ? "免费"
        : s.priceType === "subscription"
          ? `${s.priceMonthly ?? 0} LB/月`
          : `${s.pricePerRun ?? 0} LB/次`,
  },
];

// =============================================================================
// FIND BEST VALUE IN A ROW
// =============================================================================

function findBestIdx(
  strategies: MarketplaceStrategy[],
  key: string,
): number | null {
  const getVal = (s: MarketplaceStrategy): number | null => {
    switch (key) {
      case "annualized":
        return s.annualizedReturn ?? null;
      case "winRate":
        return s.winRate ?? null;
      case "maxDD":
        // Less negative is better
        return s.maxDrawdown != null ? -Math.abs(s.maxDrawdown) : null;
      case "sharpe":
        return s.sharpeRatio ?? null;
      case "runs":
        return s.totalRuns ?? null;
      case "subs":
        return s.totalSubscribers ?? null;
      case "rating":
        return s.rating ?? null;
      default:
        return null;
    }
  };

  let bestIdx: number | null = null;
  let bestVal = -Infinity;
  strategies.forEach((s, i) => {
    const v = getVal(s);
    if (v != null && v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyComparison({
  strategies,
  onClose,
}: StrategyComparisonProps) {
  if (strategies.length < 2) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-surface rounded-lg border border-border overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-white">
            策略对比
            <span className="text-xs text-white/40 ml-2 font-normal">
              {strategies.length} 个策略
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
            aria-label="Close comparison"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(85vh-64px)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 bg-surface px-4 py-3 text-left text-xs text-white/40 font-medium w-28">
                  指标
                </th>
                {strategies.map((s) => (
                  <th
                    key={s.id}
                    className="px-4 py-3 text-center text-xs font-medium text-white/80 min-w-[140px]"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {s.gradeScore && (
                        <span className="text-[10px] font-bold text-score-a">
                          {s.gradeScore.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate max-w-[120px]">{s.title}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row) => {
                const bestIdx = findBestIdx(strategies, row.key);
                return (
                  <tr
                    key={row.key}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <td className="sticky left-0 bg-surface px-4 py-2.5 text-xs text-white/50 font-medium">
                      {row.label}
                    </td>
                    {strategies.map((s, i) => {
                      const color = row.colorFn?.(s) ?? "text-white/60";
                      const isBest = bestIdx === i;
                      return (
                        <td
                          key={s.id}
                          className={cn(
                            "px-4 py-2.5 text-center font-mono tabular-nums",
                            color,
                            isBest && "font-semibold",
                          )}
                        >
                          <span className={cn(isBest && "relative")}>
                            {row.format(s)}
                            {isBest && (
                              <span className="absolute -top-0.5 -right-3 text-[8px] text-accent">
                                *
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
