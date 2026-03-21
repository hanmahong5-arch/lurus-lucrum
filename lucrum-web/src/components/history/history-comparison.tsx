"use client";

/**
 * HistoryComparison - Side-by-side metric comparison for backtest history entries.
 * Similar to marketplace comparison but adapted for backtest result data.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import type { BacktestTimelineEntry } from "./backtest-timeline";

// =============================================================================
// TYPES
// =============================================================================

interface HistoryComparisonProps {
  entries: BacktestTimelineEntry[];
  onClose: () => void;
}

interface MetricRow {
  label: string;
  key: string;
  /** Dictionary key for SmartTooltip financial term lookup */
  termKey?: string;
  format: (e: BacktestTimelineEntry) => string;
  colorFn?: (e: BacktestTimelineEntry) => string;
  /** If true, higher is better for "best" highlighting */
  higherBetter?: boolean;
}

// =============================================================================
// METRICS
// =============================================================================

const METRICS: MetricRow[] = [
  {
    label: "评级",
    key: "grade",
    format: (e) => e.grade?.charAt(0).toUpperCase() ?? "--",
    colorFn: (e) => {
      const g = e.grade?.charAt(0).toUpperCase();
      if (g === "S") return "text-score-s";
      if (g === "A") return "text-score-a";
      if (g === "B") return "text-score-b";
      return "text-white/60";
    },
  },
  {
    label: "年化收益",
    key: "annualized",
    termKey: "annualReturn",
    format: (e) =>
      e.annualizedReturn != null
        ? `${e.annualizedReturn >= 0 ? "+" : ""}${e.annualizedReturn.toFixed(1)}%`
        : "--",
    colorFn: (e) =>
      e.annualizedReturn != null
        ? e.annualizedReturn >= 0 ? "text-profit" : "text-loss"
        : "text-white/40",
    higherBetter: true,
  },
  {
    label: "胜率",
    key: "winRate",
    termKey: "winRate",
    format: (e) => (e.winRate != null ? `${e.winRate.toFixed(1)}%` : "--"),
    higherBetter: true,
  },
  {
    label: "最大回撤",
    key: "maxDD",
    termKey: "maxDrawdown",
    format: (e) => (e.maxDrawdown != null ? `${e.maxDrawdown.toFixed(1)}%` : "--"),
    colorFn: (e) =>
      e.maxDrawdown != null && e.maxDrawdown < 0 ? "text-loss" : "text-white/60",
  },
  {
    label: "Sharpe",
    key: "sharpe",
    termKey: "sharpe",
    format: (e) => (e.sharpeRatio != null ? e.sharpeRatio.toFixed(2) : "--"),
    colorFn: (e) =>
      e.sharpeRatio != null
        ? e.sharpeRatio >= 1.5 ? "text-profit" : e.sharpeRatio >= 1.0 ? "text-accent" : "text-white/60"
        : "text-white/40",
    higherBetter: true,
  },
  {
    label: "标的",
    key: "symbol",
    format: (e) => e.symbolName || e.symbol || "--",
  },
  {
    label: "策略名称",
    key: "strategy",
    format: (e) => e.strategyName || "--",
  },
  {
    label: "运行时间",
    key: "timestamp",
    format: (e) => {
      const d = new Date(e.timestamp);
      return isNaN(d.getTime())
        ? "--"
        : d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    },
  },
];

// =============================================================================
// FIND BEST INDEX
// =============================================================================

function findBestIdx(
  entries: BacktestTimelineEntry[],
  key: string,
): number | null {
  const getVal = (e: BacktestTimelineEntry): number | null => {
    switch (key) {
      case "annualized": return e.annualizedReturn ?? null;
      case "winRate": return e.winRate ?? null;
      case "maxDD": return e.maxDrawdown != null ? -Math.abs(e.maxDrawdown) : null;
      case "sharpe": return e.sharpeRatio ?? null;
      default: return null;
    }
  };

  let bestIdx: number | null = null;
  let bestVal = -Infinity;
  entries.forEach((e, i) => {
    const v = getVal(e);
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

export function HistoryComparison({
  entries,
  onClose,
}: HistoryComparisonProps) {
  if (entries.length < 2) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-surface rounded-lg border border-border overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-white">
            回测对比
            <span className="text-xs text-white/40 ml-2 font-normal">
              {entries.length} 条记录
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
                {entries.map((e) => (
                  <th
                    key={e.id}
                    className="px-4 py-3 text-center text-xs font-medium text-white/80 min-w-[140px]"
                  >
                    <div className="truncate max-w-[130px] mx-auto">
                      {e.strategyName}
                    </div>
                    <div className="text-[10px] text-white/30 font-normal mt-0.5">
                      {e.symbolName || e.symbol}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((row) => {
                const bestIdx = findBestIdx(entries, row.key);
                return (
                  <tr
                    key={row.key}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <td className="sticky left-0 bg-surface px-4 py-2.5 text-xs text-white/50 font-medium">
                      {row.termKey ? (
                        <SmartTooltip term={row.termKey}>{row.label}</SmartTooltip>
                      ) : (
                        row.label
                      )}
                    </td>
                    {entries.map((e, i) => {
                      const color = row.colorFn?.(e) ?? "text-white/60";
                      const isBest = bestIdx === i;
                      return (
                        <td
                          key={e.id}
                          className={cn(
                            "px-4 py-2.5 text-center font-mono tabular-nums",
                            color,
                            isBest && "font-semibold",
                          )}
                        >
                          {row.format(e)}
                          {isBest && (
                            <span className="ml-1 text-[8px] text-accent">*</span>
                          )}
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
