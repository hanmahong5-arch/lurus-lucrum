/**
 * React Hook for Data Freshness Status
 *
 * Provides real-time data freshness information for a stock symbol.
 * Queries the backend API to determine if market data is up-to-date
 * and exposes update-in-progress status for UI indicators.
 *
 * @module hooks/use-data-freshness
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data freshness status returned by the hook
 */
export interface DataFreshnessStatus {
  /** Whether the data is considered fresh */
  isFresh: boolean;
  /** Number of trading days the data is behind */
  staleDays: number;
  /** Last update timestamp (ms since epoch) */
  lastUpdate: number | null;
  /** Whether an update is currently in progress */
  isUpdating: boolean;
  /** Loading state for initial check */
  loading: boolean;
  /** Error message if check failed */
  error: string | null;
}

/**
 * Options for the data freshness hook
 */
interface UseDataFreshnessOptions {
  /** Auto-check interval in ms (default: 60000 = 1 minute) */
  checkInterval?: number;
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default check interval: 60 seconds
 */
const DEFAULT_CHECK_INTERVAL_MS = 60000;

/**
 * API endpoint for data freshness
 */
const FRESHNESS_API_ENDPOINT = "/api/data/freshness";

/**
 * API endpoint for data update status
 */
const UPDATE_STATUS_ENDPOINT = "/api/data/update";

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for monitoring data freshness of a stock symbol.
 *
 * @param symbol - Stock symbol to check (null to disable)
 * @param options - Configuration options
 * @returns Data freshness status
 *
 * @example
 * ```tsx
 * const freshness = useDataFreshness("600519");
 * if (!freshness.isFresh) {
 *   showWarning(`Data is ${freshness.staleDays} trading days behind`);
 * }
 * ```
 */
export function useDataFreshness(
  symbol: string | null,
  options: UseDataFreshnessOptions = {},
): DataFreshnessStatus {
  const {
    checkInterval = DEFAULT_CHECK_INTERVAL_MS,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<DataFreshnessStatus>({
    isFresh: true,
    staleDays: 0,
    lastUpdate: null,
    isUpdating: false,
    loading: true,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkFreshness = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      // Check freshness
      const freshnessResponse = await fetch(
        `${FRESHNESS_API_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`,
      );

      if (!freshnessResponse.ok) {
        throw new Error(`Freshness check failed: HTTP ${freshnessResponse.status}`);
      }

      const freshnessData = await freshnessResponse.json();

      // Check update status
      const updateResponse = await fetch(UPDATE_STATUS_ENDPOINT);
      const updateData = updateResponse.ok
        ? await updateResponse.json()
        : { isUpdating: false };

      setStatus({
        isFresh: freshnessData.data?.isFresh ?? true,
        staleDays: freshnessData.data?.staleDays ?? 0,
        lastUpdate: Date.now(),
        isUpdating: updateData.isUpdating ?? false,
        loading: false,
        error: null,
      });
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Freshness check failed",
      }));
    }
  }, [symbol, enabled]);

  useEffect(() => {
    if (!symbol || !enabled) {
      setStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    // Initial check
    checkFreshness();

    // Set up periodic check
    if (checkInterval > 0) {
      intervalRef.current = setInterval(checkFreshness, checkInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkFreshness, checkInterval, symbol, enabled]);

  return status;
}
