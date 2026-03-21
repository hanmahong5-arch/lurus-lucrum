/**
 * Quick Preview Panel Component
 *
 * After strategy generation, shows a compact 2x2 grid of key metrics
 * from an automatic 1-year quick backtest. Provides an at-a-glance
 * performance summary before the user runs a full validation.
 *
 * Metrics: Score Badge, Annual Return, Max Drawdown, Win Rate.
 *
 * @module components/strategy-editor/quick-preview-panel
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAbortController } from "@/hooks/use-abort-controller";
import { cn } from "@/lib/utils";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import Link from "next/link";

// =============================================================================
// TYPES
// =============================================================================

interface QuickPreviewMetrics {
  score: string;
  scoreLabel: string;
  annualReturn: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
}

interface QuickPreviewPanelProps {
  /** The generated strategy code to quick-test */
  strategyCode: string;
  /** Whether a generation is in progress */
  isGenerating: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SCORE HELPERS
// =============================================================================

const SCORE_GRADES = [
  { min: 80, label: "S", color: "text-score-s", bg: "bg-score-s/20", border: "border-score-s/30" },
  { min: 60, label: "A", color: "text-score-a", bg: "bg-score-a/20", border: "border-score-a/30" },
  { min: 40, label: "B", color: "text-score-b", bg: "bg-score-b/20", border: "border-score-b/30" },
  { min: 20, label: "C", color: "text-score-c", bg: "bg-score-c/20", border: "border-score-c/30" },
  { min: 0, label: "D", color: "text-score-d", bg: "bg-score-d/20", border: "border-score-d/30" },
] as const;

function getScoreGrade(sharpe: number, annualReturn: number, maxDrawdown: number, winRate: number) {
  // Simplified scoring: weighted combination of key metrics
  let score = 0;
  // Sharpe contribution (0-30 points)
  score += Math.min(30, Math.max(0, sharpe * 15));
  // Annual return contribution (0-25 points)
  score += Math.min(25, Math.max(0, annualReturn * 0.5));
  // Drawdown contribution (0-25 points, lower is better)
  score += Math.min(25, Math.max(0, 25 - Math.abs(maxDrawdown) * 0.5));
  // Win rate contribution (0-20 points)
  score += Math.min(20, Math.max(0, (winRate - 30) * 0.5));

  score = Math.max(0, Math.min(100, score));

  for (const grade of SCORE_GRADES) {
    if (score >= grade.min) {
      return { label: grade.label, score: Math.round(score), color: grade.color, bg: grade.bg, border: grade.border };
    }
  }
  return { label: "D", score: 0, color: "text-score-d", bg: "bg-score-d/20", border: "border-score-d/30" };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickPreviewPanel({
  strategyCode,
  isGenerating,
  className,
}: QuickPreviewPanelProps) {
  const [metrics, setMetrics] = useState<QuickPreviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCodeRef = useRef<string>("");

  // Abort quick backtest on unmount or when new one starts
  const createSignal = useAbortController();

  // Auto-run quick backtest when strategy code appears/changes
  const runQuickBacktest = useCallback(async (code: string) => {
    if (!code || code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    setIsLoading(true);
    setError(null);

    // Abort any previous quick backtest before starting a new one
    const signal = createSignal();

    try {
      // Run a quick 1-year backtest on CSI 300 ETF (510300)
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyCode: code,
          config: {
            symbol: "510300",
            initialCapital: 100000,
            commission: 0.0003,
            slippage: 0.001,
            startDate: getOneYearAgo(),
            endDate: getToday(),
            timeframe: "1d",
            enableT1: true,
            enableCircuitBreaker: true,
            stampDuty: 0.0005,
            wfSplitRatio: 0,
          },
        }),
        signal,
      });

      const data = await response.json();

      if (data.success && data.data) {
        const result = data.data;
        const grade = getScoreGrade(
          result.sharpeRatio ?? 0,
          result.annualizedReturn ?? 0,
          result.maxDrawdown ?? 0,
          result.winRate ?? 0
        );

        setMetrics({
          score: grade.label,
          scoreLabel: `${grade.score}分`,
          annualReturn: result.annualizedReturn ?? 0,
          maxDrawdown: result.maxDrawdown ?? 0,
          winRate: result.winRate ?? 0,
          totalTrades: result.totalTrades ?? 0,
          sharpeRatio: result.sharpeRatio ?? 0,
        });
      } else {
        setError("快速预览暂不可用");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("快速预览暂不可用");
    } finally {
      setIsLoading(false);
    }
  }, [createSignal]);

  // Trigger quick backtest when code changes (debounced)
  useEffect(() => {
    if (!strategyCode || isGenerating) return;

    const timer = setTimeout(() => {
      void runQuickBacktest(strategyCode);
    }, 500);

    return () => clearTimeout(timer);
  }, [strategyCode, isGenerating, runQuickBacktest]);

  // Don't render if no code
  if (!strategyCode && !isGenerating) return null;

  const grade = metrics
    ? getScoreGrade(metrics.sharpeRatio, metrics.annualReturn, metrics.maxDrawdown, metrics.winRate)
    : null;

  return (
    <div className={cn("glass-panel rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-neutral-300">
            快速预览
          </span>
          <span className="text-[10px] text-neutral-600">
            沪深300ETF · 近1年
          </span>
        </div>
        {metrics && (
          <Link
            href="/dashboard/strategy-validation"
            className="text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            查看完整报告 &rarr;
          </Link>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {isLoading || isGenerating ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-surface animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-xs text-neutral-500">{error}</p>
          </div>
        ) : metrics && grade ? (
          <div className="grid grid-cols-2 gap-2">
            {/* Score Badge */}
            <div className={cn(
              "rounded-lg p-3 border flex flex-col items-center justify-center",
              grade.bg, grade.border
            )}>
              <span className={cn("text-2xl font-bold font-mono", grade.color)}>
                {metrics.score}
              </span>
              <span className="text-[10px] text-neutral-500 mt-0.5">
                综合评分 {metrics.scoreLabel}
              </span>
            </div>

            {/* Annual Return */}
            <div className="rounded-lg p-3 bg-surface border border-white/5 flex flex-col items-center justify-center">
              <span className={cn(
                "text-lg font-bold font-mono tabular-nums",
                metrics.annualReturn >= 0 ? "text-profit" : "text-loss"
              )}>
                {metrics.annualReturn >= 0 ? "+" : ""}
                {metrics.annualReturn.toFixed(1)}%
              </span>
              <SmartTooltip term="annualReturn" className="text-[10px] text-neutral-500 mt-0.5">
                年化收益
              </SmartTooltip>
            </div>

            {/* Max Drawdown */}
            <div className="rounded-lg p-3 bg-surface border border-white/5 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono tabular-nums text-loss">
                -{Math.abs(metrics.maxDrawdown).toFixed(1)}%
              </span>
              <SmartTooltip term="maxDrawdown" className="text-[10px] text-neutral-500 mt-0.5">
                最大回撤
              </SmartTooltip>
            </div>

            {/* Win Rate */}
            <div className="rounded-lg p-3 bg-surface border border-white/5 flex flex-col items-center justify-center">
              <span className={cn(
                "text-lg font-bold font-mono tabular-nums",
                metrics.winRate >= 50 ? "text-profit" : "text-loss"
              )}>
                {metrics.winRate.toFixed(1)}%
              </span>
              <SmartTooltip term="winRate" className="text-[10px] text-neutral-500 mt-0.5">
                胜率 ({metrics.totalTrades}笔)
              </SmartTooltip>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-neutral-500">
              策略生成后自动运行快速预览
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getOneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0] ?? "";
}

function getToday(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}
