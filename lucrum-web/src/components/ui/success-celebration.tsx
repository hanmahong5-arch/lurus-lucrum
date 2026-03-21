/**
 * SuccessCelebration — Brief result highlight after backtest completion.
 *
 * Shows headline metrics (annualized return + Sharpe ratio) with CTA buttons
 * and an auto-dismiss countdown bar.
 * Only displays when result has positive return.
 *
 * @module components/ui/success-celebration
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SuccessCelebrationProps {
  /** Annualized return value (e.g. 18.5) */
  annualizedReturn: number;
  /** Sharpe ratio value */
  sharpeRatio: number;
  /** Total return value (e.g. 66.7) */
  totalReturn: number;
  /** Win rate value (e.g. 62) */
  winRate: number;
  /** "View full results" click handler */
  onViewResults?: () => void;
  /** "Go to validation" click handler */
  onGoToValidation?: () => void;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Auto-dismiss duration in ms (default: 5000, set 0 to disable) */
  autoDismissMs?: number;
  /** Additional CSS classes */
  className?: string;
}

export function SuccessCelebration({
  annualizedReturn,
  sharpeRatio,
  totalReturn,
  winRate,
  onViewResults,
  onGoToValidation,
  onDismiss,
  autoDismissMs = 5000,
  className,
}: SuccessCelebrationProps) {
  const [visible, setVisible] = useState(true);
  const [remainingMs, setRemainingMs] = useState(autoDismissMs);
  const startRef = useRef(Date.now());

  // Countdown and auto-dismiss
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);

    const tickInterval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setRemainingMs(Math.max(0, autoDismissMs - elapsed));
    }, 100);

    return () => {
      clearTimeout(dismissTimer);
      clearInterval(tickInterval);
    };
  }, [autoDismissMs, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  const isPositive = totalReturn >= 0;
  const countdownProgress = autoDismissMs > 0 ? remainingMs / autoDismissMs : 0;
  const countdownSec = Math.ceil(remainingMs / 1000);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-6",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        isPositive
          ? "bg-profit/5 border-profit/20"
          : "bg-loss/5 border-loss/20",
        className,
      )}
    >
      {/* Background glow */}
      <div
        className={cn(
          "absolute inset-0 opacity-10 blur-3xl",
          isPositive ? "bg-profit" : "bg-loss",
        )}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Title */}
        <p className="text-center text-sm text-neutral-300 mb-4">
          回测完成
        </p>

        {/* Dual metrics */}
        <div className="flex items-center justify-center gap-8 mb-4">
          <div className="text-center">
            <p className="text-xs text-neutral-500 mb-0.5">年化收益</p>
            <p
              className={cn(
                "text-2xl font-bold font-mono tabular-nums",
                annualizedReturn >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {annualizedReturn >= 0 ? "+" : ""}{annualizedReturn.toFixed(1)}%
            </p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-neutral-500 mb-0.5">夏普比率</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {sharpeRatio.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mb-3">
          {onViewResults && (
            <button
              onClick={() => { handleDismiss(); onViewResults(); }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-surface border border-white/10 text-neutral-200 hover:bg-surface-hover transition-all btn-tactile"
            >
              查看完整结果
            </button>
          )}
          {onGoToValidation && (
            <button
              onClick={() => { handleDismiss(); onGoToValidation(); }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-all btn-tactile"
            >
              去组合验证
              <svg
                className="inline-block w-3.5 h-3.5 ml-1.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Countdown bar */}
        {autoDismissMs > 0 && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-32 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-500 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${countdownProgress * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-600 font-mono tabular-nums">
              {countdownSec}s 后关闭
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
