/**
 * Stale Data Banner Component
 *
 * Displays a warning banner when cached data is being shown,
 * indicating how old the data is and providing a refresh button.
 *
 * Story 3.2: Discovery Page & Filter
 *
 * @module components/discovery/stale-data-banner
 */

"use client";

import React, { useMemo } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format relative time in Chinese
 */
function formatRelativeTime(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return days + " 天前";
  if (hours > 0) return hours + " 小时前";
  if (minutes > 0) return minutes + " 分钟前";
  return "刚刚";
}

// =============================================================================
// COMPONENT
// =============================================================================

interface StaleDataBannerProps {
  timestamp: string;
  onRefresh: () => void;
  className?: string;
}

export function StaleDataBanner({
  timestamp,
  onRefresh,
  className,
}: StaleDataBannerProps) {
  const relativeTime = useMemo(() => formatRelativeTime(timestamp), [timestamp]);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-2 rounded-md",
        "bg-accent/10 border border-accent/20 text-accent",
        className
      )}
      data-testid="stale-data-banner"
      role="status"
      aria-label={"显示的是 " + relativeTime + " 的数据"}
    >
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>显示的是 {relativeTime} 的数据</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 text-xs font-medium hover:text-accent/80 transition-colors btn-tactile"
        data-testid="stale-refresh-button"
        aria-label="刷新数据"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        刷新
      </button>
    </div>
  );
}