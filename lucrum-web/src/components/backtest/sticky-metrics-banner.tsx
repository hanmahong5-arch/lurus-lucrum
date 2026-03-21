/**
 * StickyMetricsBanner — Sticky top bar showing key backtest metrics
 * when user scrolls down the results page.
 *
 * Displays: Grade + Return + Sharpe + MaxDrawdown + WinRate
 *
 * @module components/backtest/sticky-metrics-banner
 */

"use client";

import { cn } from "@/lib/utils";
import type { ScoreGrade } from "@/lib/backtest/score/types";

export interface StickyMetricsBannerProps {
  grade?: ScoreGrade;
  gradeLabel?: string;
  totalReturn?: number;
  annualizedReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  className?: string;
}

const GRADE_COLORS: Record<ScoreGrade, string> = {
  S: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  A: "text-profit bg-profit/10 border-profit/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-neutral-400 bg-neutral-400/10 border-neutral-400/30",
  D: "text-loss bg-loss/10 border-loss/30",
};

export function StickyMetricsBanner({
  grade,
  gradeLabel,
  totalReturn,
  annualizedReturn,
  sharpeRatio,
  maxDrawdown,
  winRate,
  className,
}: StickyMetricsBannerProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 bg-surface/90 backdrop-blur-xl border-b border-white/5",
        "px-4 py-2.5 flex items-center justify-center gap-6 flex-wrap",
        "animate-in fade-in slide-in-from-top-1 duration-200",
        className,
      )}
    >
      {/* Grade badge */}
      {grade && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-bold",
            GRADE_COLORS[grade],
          )}
        >
          <span className="text-lg leading-none">{grade}</span>
          {gradeLabel && (
            <span className="text-xs font-normal opacity-70">{gradeLabel}</span>
          )}
        </div>
      )}

      {/* Metrics */}
      <MetricPill
        label="收益"
        value={totalReturn}
        format="percent"
        colored
      />
      <MetricPill
        label="年化"
        value={annualizedReturn}
        format="percent"
        colored
      />
      <MetricPill
        label="回撤"
        value={maxDrawdown}
        format="percent"
        inverted
      />
      <MetricPill
        label="胜率"
        value={winRate}
        format="percent"
      />
      <MetricPill
        label="夏普"
        value={sharpeRatio}
        format="number"
      />
    </div>
  );
}

function MetricPill({
  label,
  value,
  format,
  colored = false,
  inverted = false,
}: {
  label: string;
  value?: number;
  format: "percent" | "number";
  colored?: boolean;
  inverted?: boolean;
}) {
  if (value === undefined || !isFinite(value)) return null;

  const displayValue =
    format === "percent"
      ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
      : value.toFixed(2);

  let colorClass = "text-neutral-200";
  if (colored || inverted) {
    const isPositive = inverted ? value <= 0 : value > 0;
    colorClass = isPositive ? "text-profit" : "text-loss";
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className={cn("font-mono tabular-nums font-medium", colorClass)}>
        {displayValue}
      </span>
    </div>
  );
}
