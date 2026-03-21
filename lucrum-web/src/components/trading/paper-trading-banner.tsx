"use client";

/**
 * Paper Trading Mode Banner
 *
 * Prominent banner displayed when in paper (simulated) trading mode.
 * Uses yellow accent border to distinguish from live trading.
 */

import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface PaperTradingBannerProps {
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PaperTradingBanner({ className }: PaperTradingBannerProps) {
  return (
    <div
      className={cn(
        "bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-2.5 flex items-center gap-3",
        className,
      )}
    >
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/15 flex items-center justify-center">
        <svg
          className="w-3.5 h-3.5 text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-yellow-300/90 font-medium">
          模拟交易模式
        </span>
        <span className="text-xs text-yellow-400/50 ml-2">
          使用虚拟资金，不涉及真实交易
        </span>
      </div>
      <div className="flex-shrink-0 px-2 py-0.5 rounded bg-yellow-500/10 text-xs text-yellow-400/70 font-mono">
        PAPER
      </div>
    </div>
  );
}
