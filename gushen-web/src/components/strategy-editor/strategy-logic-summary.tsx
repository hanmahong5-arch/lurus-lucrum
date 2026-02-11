/**
 * StrategyLogicSummary Component
 * Displays a human-readable summary of AI-generated strategy logic
 *
 * Shows buy/sell conditions, position control, parameters, and collapsible code view.
 * Supports default, loading, and error states with full accessibility.
 *
 * @module components/strategy-editor/strategy-logic-summary
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodePreview } from "./code-preview";

// =============================================================================
// TYPES
// =============================================================================

export interface StrategyLogicSummaryProps {
  /** Buy/sell/position conditions in plain language */
  conditions: {
    buy: string;
    sell: string;
    position: string;
  };
  /** AI confidence level for the parsed logic */
  confidence: "high" | "medium" | "low";
  /** Key parameter name=value pairs */
  params: Record<string, string>;
  /** Python strategy code */
  code: string;
  /** Component state */
  state?: "default" | "loading" | "error";
  /** Error message (when state='error') */
  errorMessage?: string;
  /** Additional className */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CONFIDENCE_CONFIG = {
  high: {
    label: "高",
    variant: "success" as const,
    ariaLabel: "置信度: 高",
  },
  medium: {
    label: "中",
    variant: "warning" as const,
    ariaLabel: "置信度: 中",
  },
  low: {
    label: "低",
    variant: "danger" as const,
    ariaLabel: "置信度: 低",
  },
} as const;

const CONDITION_ITEMS = [
  {
    key: "buy" as const,
    label: "买入条件",
    colorClass: "text-profit",
  },
  {
    key: "sell" as const,
    label: "卖出条件",
    colorClass: "text-loss",
  },
  {
    key: "position" as const,
    label: "仓位控制",
    colorClass: "text-muted-foreground",
  },
] as const;

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingSkeleton() {
  return (
    <div
      className="space-y-3 animate-ai-pulse"
      aria-label="AI 正在解析策略逻辑"
      data-testid="strategy-logic-summary-loading"
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-32 rounded bg-ai/10" />
        <div className="h-5 w-12 rounded-full bg-ai/10" />
      </div>
      <div className="h-px bg-border" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="h-4 w-16 rounded bg-ai/10" />
          <div className="h-4 flex-1 rounded bg-ai/10" />
        </div>
      ))}
      <div className="h-px bg-border" />
      <div className="h-4 w-48 rounded bg-ai/10" />
    </div>
  );
}

// =============================================================================
// ERROR STATE
// =============================================================================

function ErrorFallback({
  message,
  code,
}: {
  message: string;
  code: string;
}) {
  return (
    <div role="alert" data-testid="strategy-logic-summary-error">
      <div className="flex items-center gap-2 mb-3 text-loss">
        <span aria-hidden="true">⚠</span>
        <span className="text-sm">{message}</span>
      </div>
      <CodePreview
        code={code}
        collapsible={false}
        showMinimap={false}
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StrategyLogicSummary({
  conditions,
  confidence,
  params,
  code,
  state = "default",
  errorMessage,
  className,
}: StrategyLogicSummaryProps) {
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const confidenceConfig = CONFIDENCE_CONFIG[confidence];

  // Loading state
  if (state === "loading") {
    return (
      <div className={cn("rounded-lg border border-ai/20 bg-surface p-4", className)}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className={cn("rounded-lg border border-loss/30 bg-surface p-4", className)}>
        <ErrorFallback
          message={errorMessage ?? "策略解析失败"}
          code={code}
        />
      </div>
    );
  }

  // Default state
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface p-4 space-y-3", className)}
      data-testid="strategy-logic-summary"
    >
      {/* Title + Confidence Badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          策略逻辑摘要
        </h3>
        <Badge
          variant={confidenceConfig.variant}
          aria-label={confidenceConfig.ariaLabel}
        >
          {confidenceConfig.label}
        </Badge>
      </div>

      <div className="h-px bg-border" />

      {/* Condition List */}
      <div role="list" aria-label="策略条件列表">
        {CONDITION_ITEMS.map((item) => (
          <div
            key={item.key}
            role="listitem"
            className="flex items-start gap-2 py-1.5"
          >
            <span className={cn("text-xs font-medium shrink-0 w-16", item.colorClass)}>
              {item.label}:
            </span>
            <span className="text-sm text-foreground/80">
              {conditions[item.key]}
            </span>
          </div>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Parameters Summary */}
      {Object.keys(params).length > 0 && (
        <div className="font-mono text-xs text-muted-foreground">
          <span>参数: </span>
          {Object.entries(params).map(([key, value], index) => (
            <span key={key}>
              {index > 0 && " \u00B7 "}
              {key}=<span className="font-semibold">{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Collapsible Code Section */}
      <Collapsible open={isCodeOpen} onOpenChange={setIsCodeOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            "hover:text-foreground transition-colors cursor-pointer"
          )}
        >
          <svg
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isCodeOpen && "rotate-90"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          {isCodeOpen ? "收起生成代码" : "查看生成代码"}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <CodePreview
            code={code}
            collapsible={false}
            showMinimap={false}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
