"use client";

/**
 * SimulatedDataBanner Component
 * Yellow sticky banner warning when backtest uses simulated/mock data.
 * Dismissible per session (sessionStorage).
 */

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface SimulatedDataBannerProps {
  /** Whether simulated data is active */
  visible: boolean;
  /** Callback to trigger stock selection for real data */
  onSwitchToReal?: () => void;
  /** Disable sticky positioning (for use inside modals or absolute containers) */
  disableSticky?: boolean;
  /** Optional class overrides */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DISMISS_KEY = "gushen:sim-banner-dismissed";

// =============================================================================
// Component
// =============================================================================

export function SimulatedDataBanner({
  visible,
  onSwitchToReal,
  disableSticky = false,
  className,
}: SimulatedDataBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage errors
    }
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2",
        !disableSticky && "sticky top-0 z-50",
        "bg-banner-warn/15 border-b border-banner-warn/30",
        "text-banner-warn text-sm",
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="truncate">
          当前使用模拟数据，结果仅供参考
        </span>
        {onSwitchToReal && (
          <button
            onClick={onSwitchToReal}
            className="text-banner-warn underline underline-offset-2 hover:text-banner-warn/80 whitespace-nowrap font-medium transition-colors"
          >
            切换真实数据
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-banner-warn/20 transition-colors shrink-0"
        aria-label="关闭提示"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
