/**
 * WorkflowSummaryReport Component
 * 工作流完成报告组件
 *
 * Displays a summary report when all 4 workflow steps are completed.
 * Includes step-by-step outcome summaries, a completion animation,
 * and action buttons (Save, Export PDF, Fork, Start New).
 *
 * Features:
 * - Completion checkmark animation (500ms, respects prefers-reduced-motion)
 * - Per-step summary cards showing key outputs
 * - ForkDialog for creating workflow copies
 * - Graceful handling of missing/failed step data
 *
 * @module components/strategy-editor/workflow-summary-report
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowSession, StepData } from "@/lib/workflow";

// =============================================================================
// Constants
// =============================================================================

const STEP_LABELS = [
  { name: "策略描述", nameEn: "Strategy Input", icon: "1" },
  { name: "代码生成", nameEn: "Code Generation", icon: "2" },
  { name: "回测验证", nameEn: "Backtest Run", icon: "3" },
  { name: "结果分析", nameEn: "Result Analysis", icon: "4" },
] as const;

// =============================================================================
// Types
// =============================================================================

export interface WorkflowSummaryReportProps {
  /** Completed workflow session */
  session: WorkflowSession;
  /** Callback when Save is clicked */
  onSave: () => void;
  /** Callback when Export PDF is clicked */
  onExportPdf: () => void;
  /** Callback when Fork is clicked, receives the new workflow name */
  onFork: (name: string) => void;
  /** Callback when Start New is clicked */
  onStartNew: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Extract a human-readable summary from step output data
 */
function getStepSummary(step: StepData | undefined): string {
  if (!step) return "无数据";

  if (step.status === "failed") {
    return step.errorMessage ?? "步骤执行失败";
  }

  if (step.status === "skipped") {
    return "已跳过";
  }

  const output = step.outputData;
  if (!output) return "已完成";

  switch (step.stepType) {
    case "strategy_input": {
      const desc = output.strategyDescription as string | undefined;
      if (desc) {
        return desc.length > 60 ? `${desc.slice(0, 60)}...` : desc;
      }
      return "策略描述已完成";
    }

    case "strategy_generate": {
      const confidence = output.confidence as number | undefined;
      if (typeof confidence === "number") {
        return `代码生成完成 (置信度: ${(confidence * 100).toFixed(0)}%)`;
      }
      return "代码生成完成";
    }

    case "backtest_run": {
      const result = output.backtestResult as Record<string, unknown> | undefined;
      if (result) {
        const totalReturn = result.totalReturn as number | undefined;
        const sharpe = result.sharpeRatio as number | undefined;
        const parts: string[] = [];
        if (typeof totalReturn === "number") {
          parts.push(`收益: ${(totalReturn * 100).toFixed(1)}%`);
        }
        if (typeof sharpe === "number") {
          parts.push(`Sharpe: ${sharpe.toFixed(2)}`);
        }
        if (parts.length > 0) return parts.join(" | ");
      }
      const grade = output.scoreGrade as string | undefined;
      if (grade) return `评级: ${grade}`;
      return "回测完成";
    }

    case "result_analysis": {
      const analysis = output.analysis as Record<string, unknown> | undefined;
      if (analysis) {
        const topStocks = analysis.topStocks as string[] | undefined;
        if (topStocks && topStocks.length > 0) {
          return `Top 3: ${topStocks.slice(0, 3).join(", ")}`;
        }
        const summary = analysis.summary as string | undefined;
        if (summary) {
          return summary.length > 60 ? `${summary.slice(0, 60)}...` : summary;
        }
      }
      return "分析完成";
    }

    default:
      return "已完成";
  }
}

/**
 * Get status badge color class for a step
 */
function getStepStatusColor(step: StepData | undefined): string {
  if (!step) return "bg-white/10 text-white/40";
  switch (step.status) {
    case "completed":
      return "bg-step-done/10 text-step-done";
    case "failed":
      return "bg-red-500/10 text-red-400";
    case "skipped":
      return "bg-white/5 text-white/30";
    default:
      return "bg-white/10 text-white/40";
  }
}

/**
 * Get status label for a step
 */
function getStepStatusLabel(step: StepData | undefined): string {
  if (!step) return "未执行";
  switch (step.status) {
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "skipped":
      return "已跳过";
    case "processing":
      return "处理中";
    default:
      return "待执行";
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * ForkDialog - dialog for naming a forked workflow
 */
function ForkDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div
      data-testid="fork-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-label="另存为新工作流"
      aria-modal="true"
    >
      <div className="w-full max-w-md p-6 bg-surface border border-border rounded-lg shadow-xl">
        <h3 className="text-sm font-semibold text-white mb-1">
          另存为新工作流
        </h3>
        <p className="text-xs text-white/50 mb-4">
          Fork as New Workflow
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入工作流名称"
          className={cn(
            "w-full px-3 py-2 rounded-md text-sm",
            "bg-white/5 border border-white/10 text-white",
            "placeholder:text-white/30",
            "focus:outline-none focus:border-accent/50",
          )}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onConfirm(name.trim());
            }
            if (e.key === "Escape") {
              onCancel();
            }
          }}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            aria-label="取消"
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium",
              "bg-white/5 text-white/60 hover:bg-white/10 transition-colors",
            )}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onConfirm(name.trim());
              }
            }}
            disabled={!name.trim()}
            aria-label="确认"
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium",
              "bg-accent text-white hover:bg-accent/80 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function WorkflowSummaryReport({
  session,
  onSave,
  onExportPdf,
  onFork,
  onStartNew,
  className,
}: WorkflowSummaryReportProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [forkDialogOpen, setForkDialogOpen] = useState(false);

  const isCompleted = session?.status === "completed";
  const reducedMotion = prefersReducedMotion();
  const stepData = session?.stepData ?? {};

  // Trigger completion animation on mount
  useEffect(() => {
    if (!isCompleted) return;

    if (reducedMotion) {
      setShowAnimation(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowAnimation(true);
    }, 50); // Small delay for mount animation

    return () => clearTimeout(timer);
  }, [isCompleted, reducedMotion]);

  // Guard: only render for completed sessions
  if (!session || !isCompleted) {
    return null;
  }

  const handleForkConfirm = (name: string) => {
    setForkDialogOpen(false);
    onFork(name);
  };

  return (
    <div
      data-testid="workflow-summary"
      className={cn(
        "p-5 bg-surface border border-border rounded-lg",
        !reducedMotion && "transition-all duration-500",
        !reducedMotion && showAnimation && "opacity-100 translate-y-0",
        !reducedMotion && !showAnimation && "opacity-0 translate-y-2",
        className,
      )}
    >
      {/* Header with checkmark animation */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            "bg-step-done/20 text-step-done",
            !reducedMotion && "transition-transform duration-500",
            !reducedMotion && showAnimation && "scale-100",
            !reducedMotion && !showAnimation && "scale-0",
          )}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white" role="heading" aria-level={3}>
            工作流完成
          </h3>
          <p className="text-xs text-white/40">
            Workflow Complete
            {session.title ? ` - ${session.title}` : ""}
          </p>
        </div>
      </div>

      {/* Step Summaries */}
      <div className="space-y-2 mb-5">
        {STEP_LABELS.map((label, index) => {
          const step = stepData[index];
          const summary = getStepSummary(step);
          const statusColor = getStepStatusColor(step);
          const statusLabel = getStepStatusLabel(step);

          return (
            <div
              key={index}
              data-testid={`step-summary-${index}`}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md",
                "bg-white/[0.02] border border-white/5",
              )}
            >
              {/* Step number */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                  step?.status === "completed"
                    ? "bg-step-done text-white"
                    : step?.status === "failed"
                      ? "bg-red-500 text-white"
                      : "bg-white/10 text-white/50",
                )}
              >
                {step?.status === "completed" ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  label.icon
                )}
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white">
                    {label.name}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      statusColor,
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs text-white/50 truncate">
                  {summary}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
        <button
          type="button"
          onClick={onSave}
          aria-label="保存到数据库"
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-accent text-white hover:bg-accent/80",
            "btn-tactile transition-colors",
          )}
        >
          保存
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          aria-label="导出 PDF"
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-white/5 text-white/70 hover:bg-white/10",
            "transition-colors",
          )}
        >
          导出 PDF
        </button>

        <button
          type="button"
          onClick={() => setForkDialogOpen(true)}
          aria-label="另存为新工作流"
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-white/5 text-white/70 hover:bg-white/10",
            "transition-colors",
          )}
        >
          另存为副本
        </button>

        <button
          type="button"
          onClick={onStartNew}
          aria-label="开始新工作流"
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-white/5 text-white/70 hover:bg-white/10",
            "transition-colors",
          )}
        >
          开始新工作流
        </button>
      </div>

      {/* Fork Dialog */}
      <ForkDialog
        open={forkDialogOpen}
        onConfirm={handleForkConfirm}
        onCancel={() => setForkDialogOpen(false)}
      />
    </div>
  );
}
