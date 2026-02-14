"use client";

/**
 * FailureAnalysisPanel Component
 * Displays failure breakdown when anomaly mode is triggered (>50% failure rate).
 * Shows categorized failures: data insufficient, suspended, format error, timeout.
 */

import { cn } from "@/lib/utils";
import type { FailureBreakdown } from "@/lib/backtest/parallel/batch-backtest-types";

export interface FailureAnalysisPanelProps {
  breakdowns: FailureBreakdown[];
  totalStocks: number;
  failedStocks: number;
  className?: string;
}

const REASON_ICONS: Record<string, string> = {
  data_insufficient: "📊",
  suspended: "⏸️",
  format_error: "⚠️",
  timeout: "⏱️",
  unknown: "❓",
};

export function FailureAnalysisPanel({ breakdowns, totalStocks, failedStocks, className }: FailureAnalysisPanelProps) {
  if (breakdowns.length === 0) return null;

  const failureRate = totalStocks > 0 ? Math.round((failedStocks / totalStocks) * 100) : 0;

  return (
    <div
      className={cn("rounded-lg border border-loss/20 bg-loss/5 p-4", className)}
      data-testid="failure-analysis-panel"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-loss font-medium text-sm">异常分析</span>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {failedStocks}/{totalStocks} 失败 ({failureRate}%)
        </span>
      </div>

      <div className="space-y-2">
        {breakdowns.map((b) => (
          <div key={b.reason} className="flex items-start gap-2 p-2 rounded bg-void/30" data-testid={"failure-row-" + b.reason}>
            <span className="text-sm mt-0.5">{REASON_ICONS[b.reason] || "?"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/80">{b.label}</span>
                <span className="text-xs text-white/40">{b.labelEn}</span>
                <span className="font-mono tabular-nums text-xs text-loss">{b.count}</span>
              </div>
              <div className="text-xs text-white/30 truncate mt-0.5">
                {b.symbols.slice(0, 5).join(", ")}
                {b.symbols.length > 5 && " 等" + b.symbols.length + "只"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
