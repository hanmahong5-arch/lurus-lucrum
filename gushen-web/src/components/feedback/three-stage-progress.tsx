"use client";

/**
 * ThreeStageProgress - Three-stage backtest progress indicator
 * 三阶段回测进度组件
 *
 * Displays staged progress for backtest execution:
 * 1. Data Loading (fetching_data)
 * 2. Signal Calculation (running_backtest)
 * 3. Metrics Calculation (calculating_stats)
 *
 * Each stage transitions through: waiting -> in-progress -> completed | error
 * Uses Radix UI Progress primitives with Gushen design tokens.
 *
 * Story 2.6: 三阶段回测进度
 */

import { useEffect, useRef, useCallback } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type StageStatus = "waiting" | "in-progress" | "completed" | "error";

export interface StageInfo {
  /** Unique identifier for the stage */
  id: string;
  /** Display label for the stage */
  label: string;
  /** Current status of the stage */
  status: StageStatus;
  /** Progress percentage (0-100), only meaningful when status is "in-progress" */
  progress: number;
  /** Error message to display when status is "error" */
  errorMessage?: string;
}

export interface ThreeStageProgressProps {
  /** Array of stage information (expects exactly 3 stages) */
  stages: StageInfo[];
  /** Callback when all stages complete successfully (fires after 500ms delay) */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Delay in ms before firing onComplete after all stages finish */
const COMPLETION_DELAY_MS = 500;

/** Stage number prefix for display */
const STAGE_NUMBERS = ["\u2460", "\u2461", "\u2462"] as const; // circled digits

/** Status configuration: icon, color classes, aria descriptions */
const STATUS_CONFIG: Record<
  StageStatus,
  {
    barClass: string;
    labelClass: string;
    ariaDescription: string;
  }
> = {
  waiting: {
    barClass: "bg-step-pending/30",
    labelClass: "text-step-pending",
    ariaDescription: "waiting",
  },
  "in-progress": {
    barClass: "bg-step-active",
    labelClass: "text-step-active",
    ariaDescription: "in progress",
  },
  completed: {
    barClass: "bg-step-done",
    labelClass: "text-step-done",
    ariaDescription: "completed",
  },
  error: {
    barClass: "bg-status-block",
    labelClass: "text-status-block",
    ariaDescription: "failed",
  },
};

// =============================================================================
// HELPER: useBacktestStages
// =============================================================================

/**
 * Default stage definitions for backtest progress.
 * Maps BacktestProgress.phase values to three UI stages.
 */
export const DEFAULT_BACKTEST_STAGES: Pick<StageInfo, "id" | "label">[] = [
  { id: "data-loading", label: "\u6570\u636E\u52A0\u8F7D" },
  { id: "signal-calc", label: "\u4FE1\u53F7\u8BA1\u7B97" },
  { id: "metrics-calc", label: "\u6307\u6807\u7EDF\u8BA1" },
];

/**
 * Build stage info array from BacktestProgress phase and progress.
 * Utility function for consumers to convert BacktestProgress to StageInfo[].
 */
export function buildStagesFromProgress(
  phase: string,
  progress: number,
  error?: string,
): StageInfo[] {
  // Phase to stage index mapping
  const phaseToStageIndex: Record<string, number> = {
    init: 0,
    fetching_data: 0,
    running_backtest: 1,
    calculating_stats: 2,
    generating_report: 2,
  };

  const activeStageIndex = phaseToStageIndex[phase] ?? 0;

  return DEFAULT_BACKTEST_STAGES.map((def, index) => {
    let status: StageStatus;
    let stageProgress: number;
    let errorMessage: string | undefined;

    if (error && index === activeStageIndex) {
      // Current stage failed
      status = "error";
      stageProgress = 0;
      errorMessage = error;
    } else if (index < activeStageIndex) {
      // Previous stages are completed
      status = "completed";
      stageProgress = 100;
    } else if (index === activeStageIndex) {
      // Current active stage
      status = "in-progress";
      stageProgress = Math.max(0, Math.min(100, progress));
    } else {
      // Future stages are waiting
      status = "waiting";
      stageProgress = 0;
    }

    return {
      ...def,
      status,
      progress: stageProgress,
      errorMessage,
    };
  });
}

// =============================================================================
// SUB-COMPONENT: StageRow
// =============================================================================

interface StageRowProps {
  stage: StageInfo;
  index: number;
}

function StageRow({ stage, index }: StageRowProps) {
  const config = STATUS_CONFIG[stage.status];
  const stageNumber =
    index < STAGE_NUMBERS.length ? STAGE_NUMBERS[index] : `${index + 1}`;

  // Determine the effective progress value for the bar
  const barValue =
    stage.status === "completed"
      ? 100
      : stage.status === "in-progress"
        ? stage.progress
        : 0;

  return (
    <div
      className="flex items-center gap-3"
      data-stage-id={stage.id}
      data-stage-status={stage.status}
    >
      {/* Stage number + label */}
      <div className={cn("flex items-center gap-1.5 min-w-[100px] shrink-0")}>
        <span
          className={cn(
            "text-xs font-medium",
            config.labelClass,
          )}
        >
          {stageNumber}
        </span>
        <span
          className={cn(
            "text-xs",
            config.labelClass,
          )}
        >
          {stage.label}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressPrimitive.Root
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated"
        value={barValue}
        max={100}
        aria-label={`${stage.label} - ${config.ariaDescription}`}
        aria-valuenow={barValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full rounded-full",
            config.barClass,
            // Smooth transition for in-progress; no transition for reduced-motion
            stage.status === "in-progress" &&
              "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out",
            stage.status === "completed" &&
              "motion-safe:transition-[width] motion-safe:duration-200",
          )}
          style={{ width: `${barValue}%` }}
        />
      </ProgressPrimitive.Root>

      {/* Status indicator: percentage / check / X / empty */}
      <div className="w-[52px] shrink-0 text-right">
        {stage.status === "in-progress" && (
          <span className="font-mono text-sm tabular-nums text-step-active">
            {Math.round(stage.progress)}%
          </span>
        )}
        {stage.status === "completed" && (
          <Check
            className="ml-auto h-4 w-4 text-step-done"
            aria-hidden="true"
          />
        )}
        {stage.status === "error" && (
          <X
            className="ml-auto h-4 w-4 text-status-block"
            aria-hidden="true"
          />
        )}
        {stage.status === "waiting" && (
          <span className="text-xs text-step-pending">
            {"\u7B49\u5F85\u4E2D"}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ThreeStageProgress({
  stages,
  onComplete,
  className,
}: ThreeStageProgressProps) {
  const completionFiredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allCompleted =
    stages.length > 0 && stages.every((s) => s.status === "completed");
  const hasError = stages.some((s) => s.status === "error");

  // Fire onComplete callback after delay when all stages complete
  const handleCompletion = useCallback(() => {
    if (onComplete && !completionFiredRef.current) {
      completionFiredRef.current = true;
      timerRef.current = setTimeout(() => {
        onComplete();
      }, COMPLETION_DELAY_MS);
    }
  }, [onComplete]);

  useEffect(() => {
    if (allCompleted) {
      handleCompletion();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [allCompleted, handleCompletion]);

  // Reset completion flag if stages go back to non-complete state
  useEffect(() => {
    if (!allCompleted) {
      completionFiredRef.current = false;
    }
  }, [allCompleted]);

  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-void/30 p-4",
        className,
      )}
      role="group"
      aria-label="Backtest progress"
      data-all-completed={allCompleted}
      data-has-error={hasError}
    >
      {/* Title */}
      <div className="text-xs font-medium text-neutral-300 mb-3">
        {"\u56DE\u6D4B\u8FDB\u5EA6"}
      </div>

      {/* Stage list */}
      <div
        className="space-y-3"
        aria-live="polite"
        aria-atomic="false"
      >
        {stages.map((stage, index) => (
          <StageRow key={stage.id} stage={stage} index={index} />
        ))}
      </div>

      {/* Error detail (below stages) */}
      {hasError && (
        <div className="mt-3 rounded border border-status-block/20 bg-status-block/5 px-3 py-2">
          {stages
            .filter((s) => s.status === "error" && s.errorMessage)
            .map((s) => (
              <p
                key={s.id}
                className="text-xs text-status-block"
                role="alert"
              >
                {s.errorMessage}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
