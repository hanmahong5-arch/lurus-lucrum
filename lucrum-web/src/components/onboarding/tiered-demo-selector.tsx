/**
 * Tiered Demo Selector Component
 *
 * Displays three onboarding tiers for new users:
 * - Simple: one-click auto-fill + auto-run backtest
 * - Intermediate: fill strategy, user picks stock
 * - Advanced: fill strategy, navigate to multi-stock validation
 *
 * Story 3.4: Tiered Onboarding Import
 *
 * @module components/onboarding/tiered-demo-selector
 */

"use client";

import React from "react";
import { Play, Zap, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DIFFICULTY_CONFIG,
  type DifficultyLevel,
} from "@/lib/strategy-templates/builtin-templates";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface TieredDemoConfig {
  id: "simple" | "intermediate" | "advanced";
  templateId: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: React.ElementType;
  difficulty: DifficultyLevel;
  actionLabel: string;
  actionVariant: "default" | "outline" | "ghost";
}

interface TieredDemoSelectorProps {
  onSimple: () => void;
  onIntermediate: () => void;
  onAdvanced: () => void;
  isAutoRunning?: boolean;
  autoRunError?: string | null;
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIERED_DEMO_OPTIONS: readonly TieredDemoConfig[] = [
  {
    id: "simple",
    templateId: "builtin-dual-ma",
    label: "\u53CC\u5747\u7EBF\u4EA4\u53C9 + \u8D35\u5DDE\u8305\u53F0",
    labelEn: "Dual MA + Moutai",
    description: "\u4E00\u952E\u4F53\u9A8C\uFF1A\u81EA\u52A8\u586B\u5145\u7B56\u7565\u2192\u81EA\u52A8\u56DE\u6D4B\u2192\u67E5\u770B\u8BC4\u5206",
    descriptionEn: "One-click: auto-fill strategy, run backtest, see score",
    icon: Play,
    difficulty: "beginner",
    actionLabel: "\u4E00\u952E\u4F53\u9A8C",
    actionVariant: "default",
  },
  {
    id: "intermediate",
    templateId: "builtin-kdj",
    label: "KDJ\u8D85\u4E70\u8D85\u5356 + \u81EA\u9009\u80A1\u7968",
    labelEn: "KDJ Strategy + Your Stock",
    description: "\u52A0\u8F7D\u7B56\u7565\u4EE3\u7801\uFF0C\u81EA\u5DF1\u9009\u62E9\u80A1\u7968\u5F00\u59CB\u56DE\u6D4B",
    descriptionEn: "Load strategy code, pick your own stock to backtest",
    icon: Zap,
    difficulty: "intermediate",
    actionLabel: "\u52A0\u8F7D\u7B56\u7565",
    actionVariant: "outline",
  },
  {
    id: "advanced",
    templateId: "builtin-multi-factor",
    label: "\u591A\u56E0\u5B50\u7EFC\u5408 + \u884C\u4E1A\u677F\u5757",
    labelEn: "Multi-Factor + Sector",
    description: "\u52A0\u8F7D\u7B56\u7565\u540E\u8FDB\u5165\u591A\u80A1\u9A8C\u8BC1\u6A21\u5F0F",
    descriptionEn: "Load strategy then enter multi-stock validation mode",
    icon: Target,
    difficulty: "advanced",
    actionLabel: "\u8FDB\u5165\u9A8C\u8BC1",
    actionVariant: "outline",
  },
] as const;

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel }) {
  const config = DIFFICULTY_CONFIG[difficulty];
  return (
    <span
      className={cn("text-xs px-2 py-0.5 rounded-full font-medium", config.bgClass)}
      data-testid={`difficulty-badge-${difficulty}`}
    >
      {config.label}
    </span>
  );
}

function TierCard({
  option,
  onClick,
  isLoading,
  disabled,
}: {
  option: TieredDemoConfig;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  const Icon = option.icon;
  const isSimple = option.id === "simple";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 p-5 rounded-xl border transition-all duration-200",
        "bg-surface hover:bg-surface-hover",
        isSimple
          ? "border-primary/30 shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.1)]"
          : "border-neutral-800 hover:border-neutral-700",
      )}
      data-testid={`tier-card-${option.id}`}
    >
      {isSimple && (
        <span className="absolute -top-2.5 left-4 text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
          {"\u63A8\u8350\u65B0\u624B"}
        </span>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            isSimple ? "bg-primary/20 text-primary" : "bg-neutral-800 text-neutral-400",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-100 truncate">
              {option.label}
            </h3>
            <DifficultyBadge difficulty={option.difficulty} />
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed">
        {option.description}
      </p>

      <Button
        onClick={onClick}
        variant={option.actionVariant === "default" ? undefined : "outline"}
        className={cn(
          "w-full btn-tactile mt-auto",
          isSimple && "glow-active",
        )}
        disabled={disabled || isLoading}
        data-testid={`tier-button-${option.id}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            {"\u56DE\u6D4B\u4E2D..."}
          </>
        ) : (
          <>
            <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
            {option.actionLabel}
          </>
        )}
      </Button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TieredDemoSelector({
  onSimple,
  onIntermediate,
  onAdvanced,
  isAutoRunning = false,
  autoRunError = null,
  className,
}: TieredDemoSelectorProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    simple: onSimple,
    intermediate: onIntermediate,
    advanced: onAdvanced,
  };

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="tiered-demo-selector"
    >
      <div className="text-center space-y-1">
        <h2 className="text-base font-semibold text-neutral-100">
          {"\u5FEB\u901F\u5F00\u59CB"}
          <span className="text-sm font-normal text-neutral-500 ml-2">
            / Quick Start
          </span>
        </h2>
        <p className="text-xs text-neutral-600">
          {"\u9009\u62E9\u4E00\u4E2A\u793A\u4F8B\uFF0C30\u79D2\u5185\u4F53\u9A8C\u5B8C\u6574\u56DE\u6D4B\u6D41\u7A0B"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERED_DEMO_OPTIONS.map((option) => (
          <TierCard
            key={option.id}
            option={option}
            onClick={handlers[option.id] ?? (() => {})}
            isLoading={isAutoRunning && option.id === "simple"}
            disabled={isAutoRunning}
          />
        ))}
      </div>

      {autoRunError && (
        <div
          className="text-xs text-loss text-center px-4 py-2 rounded-md bg-loss/10 border border-loss/20"
          data-testid="auto-run-error"
          role="alert"
        >
          {autoRunError}
        </div>
      )}
    </div>
  );
}
