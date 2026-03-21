/**
 * CacheBadge Component
 * 缓存标识组件
 *
 * Displays a visual indicator when workflow step results come from cache.
 * Shows relative time since caching and provides a refresh button to
 * re-execute the step with fresh data.
 *
 * Features:
 * - "来自缓存" badge with relative time (e.g. "2 小时前")
 * - Refresh button to re-execute step (skipCache=true)
 * - Loading spinner during refresh
 * - Graceful handling of invalid/missing timestamps
 * - ARIA role="status" for accessibility
 *
 * @module components/strategy-editor/cache-badge
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Constants
// =============================================================================

const UNKNOWN_TIME_LABEL = "缓存时间未知";

const RELATIVE_TIME_UNITS: Array<{
  threshold: number;
  unit: Intl.RelativeTimeFormatUnit;
  divisor: number;
}> = [
  { threshold: 60, unit: "second", divisor: 1 },
  { threshold: 3600, unit: "minute", divisor: 60 },
  { threshold: 86400, unit: "hour", divisor: 3600 },
  { threshold: 2592000, unit: "day", divisor: 86400 },
  { threshold: Infinity, unit: "month", divisor: 2592000 },
];

// =============================================================================
// Types
// =============================================================================

export interface CacheBadgeProps {
  /** Whether the result is from cache */
  cached: boolean;
  /** Timestamp when the result was cached (Date, ISO string, or epoch ms) */
  cachedAt: Date | string | number | null;
  /** Callback to refresh (re-execute the step with skipCache=true) */
  onRefresh: () => void;
  /** Whether the refresh is currently in progress */
  refreshing?: boolean;
  /** Number of tokens saved by using the cache */
  savedTokens?: number;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse a flexible timestamp input into epoch milliseconds.
 * Returns NaN for invalid values.
 */
function parseTimestamp(value: Date | string | number | null | undefined): number {
  if (value == null) return NaN;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return parsed;
  }

  return NaN;
}

/**
 * Format a relative time string in Chinese.
 * Uses Intl.RelativeTimeFormat for locale-aware formatting.
 */
function formatRelativeTime(epochMs: number): string {
  if (Number.isNaN(epochMs)) return UNKNOWN_TIME_LABEL;

  const now = Date.now();
  const diffSeconds = Math.round((now - epochMs) / 1000);

  // Future timestamps or very recent => "刚刚"
  if (diffSeconds < 10) {
    return "刚刚";
  }

  try {
    const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

    for (const { threshold, unit, divisor } of RELATIVE_TIME_UNITS) {
      if (diffSeconds < threshold) {
        const value = -Math.round(diffSeconds / divisor);
        return formatter.format(value, unit);
      }
    }

    // Fallback for very old timestamps
    const months = -Math.round(diffSeconds / 2592000);
    return formatter.format(months, "month");
  } catch {
    // Fallback if Intl is not available
    return UNKNOWN_TIME_LABEL;
  }
}

// =============================================================================
// Component
// =============================================================================

export function CacheBadge({
  cached,
  cachedAt,
  onRefresh,
  refreshing = false,
  savedTokens,
  className,
}: CacheBadgeProps) {
  const epochMs = parseTimestamp(cachedAt);
  const isTimeKnown = !Number.isNaN(epochMs);

  const relativeTimeText = useMemo(() => {
    return formatRelativeTime(epochMs);
  }, [epochMs]);

  // Don't render if not cached
  if (!cached) {
    return null;
  }

  const ariaLabel = isTimeKnown
    ? `结果来自缓存，${relativeTimeText}`
    : "结果来自缓存，缓存时间未知";

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-md",
        "bg-white/5 border border-white/10",
        "text-xs text-white/60",
        className,
      )}
    >
      {/* Cache icon */}
      <svg
        className="w-3.5 h-3.5 text-white/40 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
        />
      </svg>

      {/* Badge label */}
      <span className="font-medium text-white/70">缓存策略</span>

      {/* Saved tokens indicator */}
      {savedTokens != null && savedTokens > 0 && (
        <span className="text-profit font-mono tabular-nums" title="通过缓存节省的 Token 数">
          · 节省 ~{savedTokens} Tokens
        </span>
      )}

      {/* Relative time */}
      {isTimeKnown ? (
        <span data-testid="cache-badge-time" className="text-white/40">
          {relativeTimeText}
        </span>
      ) : (
        <span className="text-white/30">{UNKNOWN_TIME_LABEL}</span>
      )}

      {/* Refresh button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="刷新 - 重新执行此步骤"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
          "text-xs font-medium",
          "bg-white/5 hover:bg-white/10 transition-colors",
          "text-accent hover:text-accent/80",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {refreshing ? (
          <svg
            data-testid="cache-badge-spinner"
            className="w-3 h-3 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
        <span>刷新</span>
      </button>
    </div>
  );
}
