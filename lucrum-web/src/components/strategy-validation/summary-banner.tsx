"use client";

/**
 * Summary Banner
 *
 * Level 1 progressive disclosure: always visible after a validation run.
 * Shows overall grade, effective stock count, annualized return, win rate,
 * sharpe ratio, max drawdown, and action buttons.
 */

import { cn } from "@/lib/utils";
import { Download, Save, Share2 } from "lucide-react";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import type { ValidationSummary } from "./result-summary";

// =============================================================================
// Types
// =============================================================================

interface SummaryBannerProps {
  summary: ValidationSummary;
  onExport?: () => void;
  onSave?: () => void;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate an overall rating grade based on performance metrics.
 */
function calculateGrade(summary: ValidationSummary): {
  grade: string;
  color: string;
  bgColor: string;
} {
  const { winRate, excessReturn, sharpeRatio } = summary;
  const sharpe = sharpeRatio ?? 0;

  if (winRate >= 65 && excessReturn >= 5 && sharpe >= 1.5) {
    return { grade: "S", color: "text-score-s", bgColor: "bg-score-s/15 border-score-s/30" };
  }
  if (winRate >= 55 && excessReturn >= 2 && sharpe >= 1.0) {
    return { grade: "A", color: "text-score-a", bgColor: "bg-score-a/15 border-score-a/30" };
  }
  if (winRate >= 48 && excessReturn >= 0) {
    return { grade: "B", color: "text-score-b", bgColor: "bg-score-b/15 border-score-b/30" };
  }
  if (winRate >= 40) {
    return { grade: "C", color: "text-score-c", bgColor: "bg-score-c/15 border-score-c/30" };
  }
  return { grade: "D", color: "text-score-d", bgColor: "bg-score-d/15 border-score-d/30" };
}

// =============================================================================
// Component
// =============================================================================

export function SummaryBanner({
  summary,
  onExport,
  onSave,
  className,
}: SummaryBannerProps) {
  const gradeInfo = calculateGrade(summary);

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface/80 backdrop-blur-sm overflow-hidden",
        gradeInfo.bgColor,
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-stretch">
        {/* Grade badge */}
        <div className="flex items-center justify-center px-6 py-4 sm:border-r border-white/10">
          <div className="text-center">
            <div className="text-xs text-white/40 mb-1">整体评级</div>
            <div
              className={cn(
                "text-4xl font-black font-mono",
                gradeInfo.color,
              )}
            >
              {gradeInfo.grade}
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricItem
              label="有效股数"
              value={`${summary.stocksWithSignals}/${summary.totalStocks}`}
              color="text-white"
            />
            <MetricItem
              label="平均收益"
              value={`${summary.avgReturn >= 0 ? "+" : ""}${summary.avgReturn.toFixed(1)}%`}
              color={summary.avgReturn >= 0 ? "text-profit" : "text-loss"}
            />
            <SmartTooltip term="winRate">
              <MetricItem
                label="胜率"
                value={`${summary.winRate.toFixed(0)}%`}
                color={summary.winRate >= 50 ? "text-profit" : "text-loss"}
              />
            </SmartTooltip>
            <SmartTooltip term="sharpe">
              <MetricItem
                label="Sharpe"
                value={summary.sharpeRatio?.toFixed(2) ?? "--"}
                color={
                  (summary.sharpeRatio ?? 0) >= 1
                    ? "text-profit"
                    : (summary.sharpeRatio ?? 0) >= 0
                      ? "text-accent"
                      : "text-loss"
                }
              />
            </SmartTooltip>
            <SmartTooltip term="maxDrawdown">
              <MetricItem
                label="最大回撤"
                value={
                  summary.maxDrawdown !== undefined
                    ? `${summary.maxDrawdown.toFixed(1)}%`
                    : "--"
                }
                color="text-loss"
              />
            </SmartTooltip>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex sm:flex-col items-center justify-center gap-2 px-4 py-3 border-t sm:border-t-0 sm:border-l border-white/10">
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition"
              title="导出报告"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导出</span>
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition"
              title="保存到历史"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">保存</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component
// =============================================================================

function MetricItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-xs text-white/40">{label}</div>
      <div className={cn("text-lg font-bold font-mono tabular-nums", color)}>
        {value}
      </div>
    </div>
  );
}
