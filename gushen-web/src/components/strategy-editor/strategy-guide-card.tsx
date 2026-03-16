/**
 * Strategy Guide Sidecar
 *
 * Compact floating workflow stepper that tracks user progress.
 * Renders as a small pill in the bottom-right corner of the dashboard.
 * Click to expand a popover with step details and tips.
 *
 * Replaces the previous large inline card.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export type WorkflowStep = "strategy" | "parameters" | "backtest" | "validation";

interface StrategyGuideCardProps {
  currentStep?: WorkflowStep;
  className?: string;
}

// =============================================================================
// Step Data
// =============================================================================

const STEPS = [
  {
    id: "strategy" as WorkflowStep,
    label: "构思策略",
    icon: "🎯",
    tip: "用自然语言描述你想要的策略类型和核心逻辑",
  },
  {
    id: "parameters" as WorkflowStep,
    label: "调整参数",
    icon: "⚙️",
    tip: "每次只调 1-2 个参数，观察对收益和回撤的影响",
  },
  {
    id: "backtest" as WorkflowStep,
    label: "回测验证",
    icon: "📊",
    tip: "关注夏普比率 > 1、最大回撤 < 20%、胜率 > 45%",
  },
  {
    id: "validation" as WorkflowStep,
    label: "多股验证",
    icon: "✅",
    tip: "用 10-50 只不同行业股票测试策略普适性",
  },
];

// =============================================================================
// Component
// =============================================================================

export function StrategyGuideCard({ currentStep, className }: StrategyGuideCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);
  const activeStep = currentIdx >= 0 ? STEPS[currentIdx] : STEPS[0];
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / STEPS.length) * 100 : 25;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div className={cn("fixed bottom-20 right-4 z-40 md:bottom-12 md:right-6", className)} ref={panelRef}>
      {/* Expanded panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-72 bg-surface/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border/50">
            <p className="text-xs font-medium text-white/80">策略制作流程</p>
          </div>

          {/* Steps */}
          <div className="p-2 space-y-0.5">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isPast = currentIdx > idx;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                    isActive && "bg-accent/10",
                  )}
                >
                  {/* Step indicator */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        isActive
                          ? "bg-accent text-black"
                          : isPast
                            ? "bg-profit/80 text-white"
                            : "bg-white/10 text-white/40"
                      )}
                    >
                      {isPast ? "✓" : idx + 1}
                    </div>
                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <div className={cn("w-px h-3", isPast ? "bg-profit/40" : "bg-white/10")} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{step.icon}</span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isActive ? "text-accent" : isPast ? "text-white/60" : "text-white/40"
                        )}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="px-1 py-px bg-accent/20 text-accent text-[9px] rounded leading-tight">
                          当前
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{step.tip}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating pill trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 pl-3 pr-3 py-2 rounded-full",
          "bg-surface/90 backdrop-blur-xl border border-border/60",
          "shadow-lg shadow-black/30 hover:bg-surface hover:border-border transition-all",
          "text-xs",
          isOpen && "border-accent/40"
        )}
      >
        {/* Mini progress ring */}
        <svg className="w-5 h-5 shrink-0 -rotate-90" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
          <circle
            cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-accent"
            strokeDasharray={`${(progress / 100) * 50.3} 50.3`}
            strokeLinecap="round"
          />
        </svg>

        {/* Current step label */}
        <span className="text-white/70 whitespace-nowrap">
          <span className="text-white/40 mr-1">{activeStep?.icon}</span>
          {activeStep?.label}
        </span>

        {/* Step count */}
        <span className="text-white/30 font-mono tabular-nums">
          {Math.max(1, currentIdx + 1)}/4
        </span>
      </button>
    </div>
  );
}
