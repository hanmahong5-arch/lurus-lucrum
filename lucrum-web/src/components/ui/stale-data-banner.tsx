"use client";

/**
 * StaleDataBanner — warns when backtest data is more than ~2 trading days
 * behind the user's requested endDate. Mirrors SimulatedDataBanner's
 * dismissable-per-session pattern so users with chronic stale data (e.g.
 * during a klines-update outage) aren't nagged every backtest.
 *
 * @module components/ui/stale-data-banner
 */

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaleDataBannerProps {
  /** YYYY-MM-DD of the last bar the backtest actually saw. */
  dataAsOf: string | null;
  /** Whole days between dataAsOf and now (server-computed, not local). */
  dataStaleDays: number | null;
  /** What the user asked for (YYYY-MM-DD). Used to decide "stale" cutoff. */
  requestedEndDate?: string | null;
  /** Banner suppressed under this stale-day threshold. Default 3 (2 trading days + weekend). */
  threshold?: number;
  /** Disable sticky positioning for use inside modals. */
  disableSticky?: boolean;
  className?: string;
}

const DISMISS_KEY = "lucrum:stale-banner-dismissed";

export function StaleDataBanner({
  dataAsOf,
  dataStaleDays,
  requestedEndDate,
  threshold = 3,
  disableSticky = false,
  className,
}: StaleDataBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // Dismissal key includes the as-of date — if data freshens later we
      // re-show the banner instead of staying hidden forever.
      if (sessionStorage.getItem(`${DISMISS_KEY}:${dataAsOf}`) === "1") {
        setDismissed(true);
      }
    } catch {
      // sessionStorage unavailable (private mode) — no-op
    }
  }, [dataAsOf]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`${DISMISS_KEY}:${dataAsOf}`, "1");
    } catch {
      // ignore
    }
  }, [dataAsOf]);

  if (
    !dataAsOf ||
    dataStaleDays == null ||
    dataStaleDays < threshold ||
    dismissed
  ) {
    return null;
  }

  const requestedSuffix =
    requestedEndDate && requestedEndDate !== dataAsOf
      ? `（你请求的截止日：${requestedEndDate}）`
      : "";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2",
        !disableSticky && "sticky top-0 z-50",
        "bg-banner-warn/15 border-b border-banner-warn/30",
        "text-banner-warn text-sm",
        className,
      )}
      role="status"
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="truncate">
          回测数据截至 <span className="font-mono">{dataAsOf}</span>
          ，距今 {dataStaleDays} 天{requestedSuffix}
        </span>
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
