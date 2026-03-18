"use client";

/**
 * Token Budget Indicator Component
 *
 * Displays a progress bar showing token usage relative to the conversation budget.
 * Colors transition: green (<70%) -> yellow (70-90%) -> red (>90%).
 *
 * @module components/advisor/token-budget-indicator
 */

import { cn } from "@/lib/utils";
import {
  getUsageLevel,
  formatTokenCount,
  type UsageLevel,
} from "@/lib/advisor/token-tracker";

// =============================================================================
// CONSTANTS
// =============================================================================

const LEVEL_COLORS: Record<UsageLevel, string> = {
  low: "bg-emerald-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

const LEVEL_TEXT_COLORS: Record<UsageLevel, string> = {
  low: "text-emerald-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

// =============================================================================
// PROPS
// =============================================================================

interface TokenBudgetIndicatorProps {
  /** Number of tokens used */
  used: number;
  /** Total token budget */
  total: number;
  /** Compact mode for tighter layouts */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Visual progress bar indicator for token budget usage.
 *
 * Accessibility: Uses role="progressbar" with aria-valuenow/min/max.
 * Colors: green -> yellow -> red based on usage thresholds.
 */
export function TokenBudgetIndicator({
  used,
  total,
  compact = false,
  className,
}: TokenBudgetIndicatorProps) {
  const percentage = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const level = getUsageLevel(percentage);
  const fillColor = LEVEL_COLORS[level];
  const textColor = LEVEL_TEXT_COLORS[level];

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "text-xs" : "text-sm",
        className
      )}
    >
      {/* Label */}
      <span className="text-gray-500 whitespace-nowrap">Token</span>

      {/* Progress bar container */}
      <div
        className="flex-1 h-1.5 bg-[#1a1f36] rounded-full overflow-hidden min-w-[60px]"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Token usage: ${percentage}%`}
      >
        {/* Fill */}
        <div
          data-testid="token-budget-fill"
          className={cn(
            "h-full rounded-full transition-all duration-300",
            fillColor
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Numeric display */}
      <span className={cn("tabular-nums whitespace-nowrap font-mono", textColor)}>
        {formatTokenCount(used)} / {formatTokenCount(total)}
      </span>
    </div>
  );
}

export default TokenBudgetIndicator;
