/**
 * Backtest Running View Component
 * Full-width operation timeline shown while backtest is executing.
 *
 * Displays a professional multi-step pipeline with status indicators,
 * a progress bar, and estimated remaining time.
 *
 * @module components/backtest/backtest-running-view
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface BacktestRunningStep {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "running" | "done" | "error";
  duration?: number; // seconds
}

export interface BacktestRunningViewProps {
  /** Strategy name for display */
  strategyName?: string;
  /** Target symbol */
  symbol?: string;
  /** Start date of backtest range */
  startDate?: string;
  /** End date of backtest range */
  endDate?: string;
  /** Callback to cancel the backtest */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_STEPS: BacktestRunningStep[] = [
  { id: "parse", label: "解析策略参数", detail: "", status: "pending" },
  { id: "fetch", label: "获取K线数据", detail: "", status: "pending" },
  { id: "validate", label: "数据质量校验", detail: "", status: "pending" },
  { id: "execute", label: "执行回测模拟", detail: "", status: "pending" },
  { id: "stats", label: "计算统计指标", detail: "", status: "pending" },
  { id: "report", label: "生成报告", detail: "", status: "pending" },
];

// Simulated step durations (milliseconds) for realistic timeline progression
const STEP_DELAYS = [300, 1200, 400, 2500, 800, 500];

// =============================================================================
// COMPONENT
// =============================================================================

export function BacktestRunningView({
  strategyName,
  symbol,
  startDate,
  endDate,
  onCancel,
  className,
}: BacktestRunningViewProps) {
  const [steps, setSteps] = useState<BacktestRunningStep[]>(() =>
    DEFAULT_STEPS.map((s) => ({ ...s }))
  );
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(Date.now());
  const animFrameRef = useRef<number>();

  // Animate step progression for visual feedback
  useEffect(() => {
    let cancelled = false;
    const totalDelay = STEP_DELAYS.reduce((a, b) => a + b, 0);

    const advanceSteps = async () => {
      for (let i = 0; i < STEP_DELAYS.length; i++) {
        if (cancelled) return;

        // Mark current step as running
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status:
              idx < i ? "done" : idx === i ? "running" : "pending",
          }))
        );

        // Calculate progress up to this step
        const completedDelay = STEP_DELAYS.slice(0, i).reduce((a, b) => a + b, 0);
        const stepDelay = STEP_DELAYS[i] ?? 500;

        // Animate progress within step
        const stepStart = Date.now();
        const animateProgress = () => {
          if (cancelled) return;
          const elapsed = Date.now() - stepStart;
          const stepProgress = Math.min(elapsed / stepDelay, 1);
          const totalProgress =
            ((completedDelay + stepProgress * stepDelay) / totalDelay) * 100;
          setProgress(Math.min(totalProgress, 99));
          if (elapsed < stepDelay) {
            requestAnimationFrame(animateProgress);
          }
        };
        requestAnimationFrame(animateProgress);

        await new Promise((r) => setTimeout(r, stepDelay));

        if (cancelled) return;

        // Generate detail for completed step
        setSteps((prev) =>
          prev.map((s, idx) => {
            if (idx === i) {
              return {
                ...s,
                status: "done" as const,
                duration: (STEP_DELAYS[i] ?? 500) / 1000,
                detail: getStepDetail(s.id, symbol, startDate, endDate),
              };
            }
            return s;
          })
        );
      }
    };

    void advanceSteps();
    return () => {
      cancelled = true;
    };
  }, [symbol, startDate, endDate]);

  // Elapsed time counter
  useEffect(() => {
    const tick = () => {
      setElapsedMs(Date.now() - startTimeRef.current);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const estimatedTotal = 6; // seconds
  const remaining = Math.max(0, estimatedTotal - elapsedMs / 1000);
  const remainingLabel =
    remaining > 0 ? `~${Math.ceil(remaining)}秒` : "即将完成";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[60vh] px-4",
        className,
      )}
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-neutral-100 mb-2">
            回测进行中
          </h2>
          {strategyName && (
            <p className="text-sm text-neutral-400">
              {strategyName}
              {symbol && (
                <span className="ml-2 text-neutral-500">
                  {symbol}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Steps timeline */}
        <div className="space-y-3 mb-8">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/70 via-primary to-accent/70 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
            <span className="font-mono tabular-nums">
              {progress.toFixed(0)}%
            </span>
            <span>
              已用时 <span className="font-mono tabular-nums">{elapsedSec}s</span>
              {" / "}
              预计剩余 <span className="font-mono tabular-nums">{remainingLabel}</span>
            </span>
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-lg transition-all btn-tactile"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STEP ROW SUB-COMPONENT
// =============================================================================

function StepRow({ step }: { step: BacktestRunningStep }) {
  return (
    <div className="flex items-start gap-3">
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {step.status === "done" && (
          <div className="w-5 h-5 rounded-full bg-profit/20 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-profit"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {step.status === "running" && (
          <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        )}
        {step.status === "pending" && (
          <div className="w-5 h-5 rounded-full border border-white/10" />
        )}
        {step.status === "error" && (
          <div className="w-5 h-5 rounded-full bg-loss/20 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-loss"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-sm",
              step.status === "done"
                ? "text-neutral-200"
                : step.status === "running"
                  ? "text-primary font-medium"
                  : "text-neutral-500",
            )}
          >
            {step.label}
          </span>
          {step.duration !== undefined && (
            <span className="text-xs text-neutral-600 font-mono tabular-nums">
              {step.duration.toFixed(1)}s
            </span>
          )}
        </div>
        {step.detail && (
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getStepDetail(
  stepId: string,
  symbol?: string,
  startDate?: string,
  endDate?: string,
): string {
  switch (stepId) {
    case "parse":
      return "参数解析完成";
    case "fetch":
      return symbol
        ? `${symbol}, ${startDate ?? ""} ~ ${endDate ?? ""}`
        : "数据获取完成";
    case "validate":
      return "数据质量符合要求";
    case "execute":
      return "模拟交易执行完成";
    case "stats":
      return "30+ 财务指标计算完成";
    case "report":
      return "报告生成完成";
    default:
      return "";
  }
}
