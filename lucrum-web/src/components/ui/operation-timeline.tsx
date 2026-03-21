"use client";

/**
 * OperationTimeline Component
 *
 * Displays a step-by-step timeline for multi-step operations such as
 * sector backtest, AI generation, or batch validation.
 *
 * Shows completed, active, and pending steps with progress details,
 * estimated remaining time, and a cancel button.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export type TimelineStepStatus =
  | "completed"
  | "running"
  | "active"
  | "pending"
  | "failed"
  | "error"
  | "skipped";

export interface TimelineStep {
  /** Unique step identifier */
  id: string;
  /** Display label for the step */
  label: string;
  /** Current status */
  status: TimelineStepStatus;
  /** Detail text (e.g. "42只", "28/38 (73%)") */
  detail?: string;
  /** Sub-label shown below the main label when active (e.g. current stock name) */
  activeSubLabel?: string;
}

export interface OperationTimelineProps {
  /** Operation title */
  title?: string;
  /** Timeline steps */
  steps: TimelineStep[];
  /** Overall progress percentage (0-100) */
  overallProgress?: number;
  /** Estimated remaining time display string, e.g. "~45秒" */
  estimatedRemaining?: string;
  /** Shorthand alias for estimatedRemaining (e.g. "约45秒") */
  eta?: string;
  /** Cancel callback; if provided, a cancel button is shown */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Status icons and colors
// =============================================================================

const STATUS_CONFIG: Record<
  TimelineStepStatus,
  {
    icon: string;
    lineColor: string;
    dotColor: string;
    textColor: string;
  }
> = {
  completed: {
    icon: "\u2713", // checkmark
    lineColor: "bg-step-done",
    dotColor: "bg-step-done text-void",
    textColor: "text-step-done",
  },
  running: {
    icon: "",
    lineColor: "bg-step-active",
    dotColor: "bg-step-active text-void",
    textColor: "text-step-active",
  },
  active: {
    icon: "",
    lineColor: "bg-step-active",
    dotColor: "bg-step-active text-void",
    textColor: "text-step-active",
  },
  pending: {
    icon: "",
    lineColor: "bg-white/10",
    dotColor: "bg-white/10 text-white/30",
    textColor: "text-white/30",
  },
  failed: {
    icon: "\u2717", // X mark
    lineColor: "bg-status-block",
    dotColor: "bg-status-block text-void",
    textColor: "text-status-block",
  },
  error: {
    icon: "\u2717", // X mark
    lineColor: "bg-status-block",
    dotColor: "bg-status-block text-void",
    textColor: "text-status-block",
  },
  skipped: {
    icon: "\u2014", // em dash
    lineColor: "bg-white/5",
    dotColor: "bg-white/5 text-white/20",
    textColor: "text-white/20",
  },
};

// =============================================================================
// Component
// =============================================================================

export function OperationTimeline({
  title,
  steps,
  overallProgress,
  estimatedRemaining,
  eta,
  onCancel,
  className,
}: OperationTimelineProps) {
  // eta is shorthand alias for estimatedRemaining
  const remaining = estimatedRemaining ?? eta;
  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-void/30 p-4",
        className,
      )}
      role="group"
      aria-label={title ?? "操作进度"}
    >
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-neutral-300">{title}</span>
          {overallProgress !== undefined && (
            <span className="text-xs font-mono tabular-nums text-accent">
              {Math.round(overallProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Overall progress bar */}
      {overallProgress !== undefined && (
        <div className="h-1 w-full bg-white/5 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
          />
        </div>
      )}

      {/* Step timeline */}
      <div className="space-y-0" aria-live="polite" aria-atomic="false">
        {steps.map((step, idx) => {
          const config = STATUS_CONFIG[step.status];
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Timeline column: dot + line */}
              <div className="flex flex-col items-center w-5 shrink-0">
                {/* Dot */}
                <div
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                    config.dotColor,
                    (step.status === "active" || step.status === "running") && "animate-pulse",
                  )}
                >
                  {step.status === "completed" && config.icon}
                  {(step.status === "error" || step.status === "failed") && config.icon}
                  {step.status === "skipped" && config.icon}
                  {(step.status === "active" || step.status === "running") && (
                    <span className="w-2 h-2 rounded-full bg-void" />
                  )}
                  {step.status === "pending" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  )}
                </div>
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[16px]",
                      config.lineColor,
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className={cn("pb-3 min-w-0 flex-1", isLast && "pb-0")}>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn("text-xs font-medium", config.textColor)}
                  >
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="text-[10px] text-white/40 font-mono tabular-nums">
                      {step.detail}
                    </span>
                  )}
                </div>
                {(step.status === "active" || step.status === "running") &&
                  step.activeSubLabel && (
                    <div className="text-[10px] text-white/30 mt-0.5 truncate">
                      {step.activeSubLabel}
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: estimated time + cancel */}
      {(remaining || onCancel) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          {remaining && (
            <span className="text-[10px] text-white/30">
              预计剩余时间: {remaining}
            </span>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-[10px] text-white/40 hover:text-loss transition px-2 py-1 rounded hover:bg-loss/10"
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
}
