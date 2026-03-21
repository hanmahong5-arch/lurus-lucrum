/**
 * Welcome Flow Overlay
 *
 * Full-page onboarding overlay shown on first visit.
 * Guides new users through key platform features in 4 steps:
 *   1. Welcome introduction
 *   2. Strategy workbench highlight
 *   3. Portfolio validation highlight
 *   4. First backtest call-to-action
 *
 * Uses lucide-react icons and Tailwind dark-mode classes from the
 * project design system.
 *
 * @module components/onboarding/welcome-flow
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PenLine,
  BarChart3,
  Rocket,
  ChevronRight,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useOnboardingImport } from "@/hooks/use-onboarding-import";
import { cn } from "@/lib/utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const TOTAL_STEPS = 4;

interface StepConfig {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  bullets: string[];
  primaryLabel: string;
  showSkip: boolean;
}

const STEP_CONFIGS: readonly StepConfig[] = [
  {
    icon: Sparkles,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10",
    title: "\u6B22\u8FCE\u6765\u5230 Lucrum \u91CF\u5316\u4EA4\u6613\u5E73\u53F0",
    bullets: [
      "\u7528\u81EA\u7136\u8BED\u8A00\u521B\u5EFA\u4EA4\u6613\u7B56\u7565",
      "\u5728\u591A\u53EA\u80A1\u7968\u4E0A\u9A8C\u8BC1\u7B56\u7565\u6548\u679C",
      "\u7BA1\u7406\u4F60\u7684\u6295\u8D44\u7EC4\u5408",
    ],
    primaryLabel: "\u5F00\u59CB\u4F53\u9A8C",
    showSkip: false,
  },
  {
    icon: PenLine,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    title: "\u7B56\u7565\u5DE5\u4F5C\u53F0",
    bullets: [
      "\u8F93\u5165\u4F60\u7684\u7B56\u7565\u60F3\u6CD5\uFF0CAI \u5E2E\u4F60\u751F\u6210\u4EE3\u7801",
      "\u4F8B\u5982\uFF1A\u201C\u5F53MACD\u91D1\u53C9\u4E14RSI<30\u65F6\u4E70\u5165\u201D",
      "\u652F\u6301\u53C2\u6570\u8C03\u6574\u3001\u5B9E\u65F6\u9884\u89C8\u548C\u81EA\u52A8\u4FDD\u5B58",
    ],
    primaryLabel: "\u8BD5\u8BD5\u770B",
    showSkip: true,
  },
  {
    icon: BarChart3,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    title: "\u7EC4\u5408\u5206\u4ED3",
    bullets: [
      "\u4E00\u4E2A\u7B56\u7565\u5E94\u7528\u5230 20\u201350 \u53EA\u80A1\u7968",
      "\u81EA\u52A8\u5206\u914D\u8D44\u91D1\uFF0C\u770B\u6574\u4F53\u6536\u76CA",
      "\u652F\u6301\u884C\u4E1A\u5FEB\u901F\u5BFC\u5165\u4E0E\u4FE1\u53F7\u4F18\u5148\u7EA7\u6392\u5E8F",
    ],
    primaryLabel: "\u4E86\u89E3\u66F4\u591A",
    showSkip: true,
  },
  {
    icon: Rocket,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-400/10",
    title: "\u5F00\u59CB\u4F60\u7684\u7B2C\u4E00\u6B21\u56DE\u6D4B",
    bullets: [
      "\u6211\u4EEC\u4E3A\u4F60\u51C6\u5907\u4E86\u4E00\u4E2A\u6A21\u677F\u7B56\u7565",
      "\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u7ACB\u5373\u4F53\u9A8C",
      "\u53CC\u5747\u7EBF\u4EA4\u53C9\u7B56\u7565 + \u8D35\u5DDE\u8305\u53F0\u56DE\u6D4B",
    ],
    primaryLabel: "\u52A0\u8F7D\u793A\u4F8B\u7B56\u7565\u5E76\u5F00\u59CB",
    showSkip: false,
  },
] as const;

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current
              ? "w-8 bg-primary"
              : i < current
                ? "w-4 bg-primary/40"
                : "w-4 bg-neutral-700",
          )}
        />
      ))}
      <span className="ml-2 text-xs text-neutral-500 tabular-nums">
        {current + 1} / {total}
      </span>
    </div>
  );
}

function StepContent({
  config,
  stepIndex,
  onPrimary,
  onSkip,
  isLastStep,
  isLoading,
}: {
  config: StepConfig;
  stepIndex: number;
  onPrimary: () => void;
  onSkip: () => void;
  isLastStep: boolean;
  isLoading: boolean;
}) {
  const Icon = config.icon;

  return (
    <div
      className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
      key={stepIndex}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-2xl",
          config.iconBg,
        )}
      >
        <Icon className={cn("w-8 h-8", config.iconColor)} aria-hidden="true" />
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold text-neutral-100">
        {config.title}
      </h2>

      {/* Bullet points */}
      <ul className="space-y-3 text-sm text-neutral-400 max-w-md">
        {config.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-xs font-medium">
              {i + 1}
            </span>
            <span className="text-left">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {config.showSkip && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-neutral-500 hover:text-neutral-300"
            disabled={isLoading}
          >
            <SkipForward className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {"\u8DF3\u8FC7"}
          </Button>
        )}
        <Button
          onClick={onPrimary}
          className={cn(
            "btn-tactile px-6",
            isLastStep && "glow-active",
          )}
          disabled={isLoading}
          data-testid={`onboarding-step-${stepIndex}-primary`}
        >
          {isLoading ? (
            <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          {config.primaryLabel}
          {!isLastStep && <ChevronRight className="w-4 h-4 ml-1.5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function WelcomeFlow() {
  const [step, setStep] = useState(0);
  const { complete } = useOnboarding();
  const router = useRouter();
  const {
    fillAndRunSimple,
    isAutoRunning,
  } = useOnboardingImport();

  // Close overlay on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        complete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [complete]);

  const handlePrimary = useCallback(async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    // Last step: load example strategy and run backtest, then close
    try {
      await fillAndRunSimple();
    } finally {
      complete();
    }
  }, [step, complete, fillAndRunSimple]);

  const handleSkip = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((prev) => prev + 1);
    } else {
      complete();
    }
  }, [step, complete]);

  const handleDismiss = useCallback(() => {
    complete();
  }, [complete]);

  const config = STEP_CONFIGS[step];
  if (!config) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="\u65B0\u624B\u5F15\u5BFC"
      data-testid="welcome-flow-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-md" />

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 z-10 p-2 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
        aria-label="\u5173\u95ED\u5F15\u5BFC"
        data-testid="welcome-flow-close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content card */}
      <div className="relative z-10 w-full max-w-lg mx-4 p-8 sm:p-10 rounded-2xl bg-surface border border-neutral-800 shadow-2xl">
        {/* Step indicator */}
        <div className="flex justify-center mb-8">
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>

        {/* Step content */}
        <StepContent
          config={config}
          stepIndex={step}
          onPrimary={handlePrimary}
          onSkip={handleSkip}
          isLastStep={step === TOTAL_STEPS - 1}
          isLoading={isAutoRunning}
        />
      </div>
    </div>
  );
}
