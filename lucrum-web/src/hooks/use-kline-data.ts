/**
 * K-Line Data Hook (Rewritten)
 * K线数据获取 Hook（重写版）
 *
 * Provides real-time and historical K-line data for charts.
 * Key improvements:
 * - Proper dependency tracking for symbol/timeframe changes
 * - Request cancellation to prevent race conditions
 * - Uses new intelligent kline-fetcher with fallback
 * - Loading state shows during timeframe switches
 *
 * @module hooks/use-kline-data
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { isMarketOpen, getChinaTime } from "@/lib/trading/time-utils";
import {
  fetchKLineWithFallback,
  getDefaultCount,
  isIntradayTimeframe,
  type KLineFetchResult,
} from "@/lib/trading/kline-fetcher";
import {
  shouldCreateNewBar as shouldCreateNewBarTimeParser,
  alignToBarStart,
} from "@/lib/trading/time-parser";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Time frame options for K-line data
 */
export type TimeFrame =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "1d"
  | "1w"
  | "1M";

/**
 * Single K-line data point
 */
export interface KLineData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Real-time tick data
 */
export interface TickData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}

/**
 * Hook options
 */
export interface UseKLineDataOptions {
  symbol: string;
  timeframe: TimeFrame;
  count?: number; // Number of bars to fetch
  autoRefresh?: boolean; // Auto refresh when market is open
  refreshInterval?: number; // Refresh interval in ms
}

/**
 * Hook return value
 */
export interface UseKLineDataResult {
  data: KLineData[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  source: string; // Data source name
  isMock: boolean; // Whether data is mock
  refresh: () => Promise<void>;
  updateLastBar: (tick: TickData) => void;
}

// =============================================================================
// TIMEFRAME LABELS / 时间周期标签
// =============================================================================

/**
 * Timeframe display labels
 */
export const TIMEFRAME_LABELS: Record<TimeFrame, { zh: string; en: string }> = {
  "1m": { zh: "1分", en: "1min" },
  "5m": { zh: "5分", en: "5min" },
  "15m": { zh: "15分", en: "15min" },
  "30m": { zh: "30分", en: "30min" },
  "60m": { zh: "1小时", en: "1hour" },
  "1d": { zh: "日线", en: "Daily" },
  "1w": { zh: "周线", en: "Weekly" },
  "1M": { zh: "月线", en: "Monthly" },
};

// =============================================================================
// HOOK IMPLEMENTATION / Hook 实现
// =============================================================================

/**
 * Hook for fetching and managing K-line data
 *
 * Key behaviors:
 * - Fetches new data whenever symbol or timeframe changes
 * - Shows loading state during fetches
 * - Cancels pending requests when parameters change
 * - Falls back to intelligent mock data if APIs fail
 * - Auto-refreshes during market hours (optional)
 */
export function useKLineData(options: UseKLineDataOptions): UseKLineDataResult {
  const {
    symbol,
    timeframe,
    count,
    autoRefresh = true,
    refreshInterval = 10000, // 10 seconds default
  } = options;

  // Calculate effective count based on timeframe
  const effectiveCount = count ?? getDefaultCount(timeframe);

  // State
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [source, setSource] = useState<string>("none");
  const [isMock, setIsMock] = useState(false);

  // Refs for cleanup and request tracking
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchIdRef = useRef(0); // Track fetch requests to handle race conditions

  // Create a unique key for current parameters to track changes
  const fetchKey = useMemo(
    () => `${symbol}-${timeframe}-${effectiveCount}`,
    [symbol, timeframe, effectiveCount],
  );

  /**
   * Core fetch function
   * Fetches K-line data and updates state
   */
  const fetchData = useCallback(
    async (showLoading: boolean = true) => {
      if (!symbol) {
        console.log("[useKLineData] No symbol provided, skipping fetch");
        return;
      }

      // Increment fetch ID to track this specific request
      const currentFetchId = ++fetchIdRef.current;

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      console.log(
        `[useKLineData] Fetching: ${symbol} ${timeframe} x${effectiveCount} (fetchId: ${currentFetchId})`,
      );

      try {
        const result: KLineFetchResult = await fetchKLineWithFallback({
          symbol,
          timeframe,
          count: effectiveCount,
        });

        // Check if this request is still relevant (not superseded by a newer one)
        if (currentFetchId !== fetchIdRef.current) {
          console.log(
            `[useKLineData] Discarding stale response (fetchId: ${currentFetchId}, current: ${fetchIdRef.current})`,
          );
          return;
        }

        // Check if component is still mounted
        if (!isMountedRef.current) {
          return;
        }

        if (result.success && result.data.length > 0) {
          console.log(
            `[useKLineData] Success: ${result.data.length} bars from ${result.source}${result.isMock ? " (mock)" : ""}`,
          );

          setData(result.data);
          setSource(result.source);
          setIsMock(result.isMock);
          setLastUpdate(new Date());
          setError(null);
        } else {
          console.error("[useKLineData] Fetch failed:", result.error);
          setError(result.error || "Failed to fetch data");
          // Keep existing data if we have any
        }
      } catch (err) {
        // Check if this was an abort
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[useKLineData] Request aborted");
          return;
        }

        // Check if still relevant
        if (currentFetchId !== fetchIdRef.current || !isMountedRef.current) {
          return;
        }

        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[useKLineData] Exception:", errorMsg);
        setError(errorMsg);
      } finally {
        // Only update loading if this is still the current fetch
        if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [symbol, timeframe, effectiveCount],
  );

  /**
   * Public refresh function
   * Can be called by consumers to manually refresh
   */
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  /**
   * Update the last bar with real-time tick data
   * Used for live updates during trading hours
   *
   * ✨ Enhanced to create new bars when crossing time boundaries
   * 增强版：在跨越时间边界时创建新K线
   */
  const updateLastBar = useCallback((tick: TickData) => {
    setData((prevData) => {
      if (prevData.length === 0) return prevData;

      const newData = [...prevData];
      const lastBar = newData[newData.length - 1];

      if (!lastBar) return prevData;

      // ✅ FIX: Check if we should create a new bar
      // 检查是否应该创建新K线
      const currentTime = Math.floor(tick.timestamp / 1000);

      if (shouldCreateNewBarTimeParser(lastBar.time, currentTime, timeframe)) {
        // Create new bar
        // 创建新K线
        const newBarTime = alignToBarStart(currentTime, timeframe);
        const newBar: KLineData = {
          time: newBarTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume,
        };
        newData.push(newBar);
      } else {
        // Update existing bar
        // 更新现有K线
        const updatedBar: KLineData = {
          ...lastBar,
          close: tick.price,
          high: Math.max(lastBar.high, tick.price),
          low: Math.min(lastBar.low, tick.price),
          volume: lastBar.volume + tick.volume,
        };
        newData[newData.length - 1] = updatedBar;
      }

      return newData;
    });

    setLastUpdate(new Date());
  }, [timeframe]);

  /**
   * Effect: Fetch data when parameters change
   * This is the KEY fix - properly re-fetches when symbol/timeframe changes
   */
  useEffect(() => {
    console.log(`[useKLineData] Parameters changed: ${fetchKey}`);

    // Reset state for new parameters
    setLoading(true);
    setError(null);

    // Fetch new data
    fetchData(true);

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchKey, fetchData]);

  /**
   * Effect: Setup auto-refresh timer
   * Only refreshes during market hours for intraday timeframes
   */
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    // Clear existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Setup new timer
    refreshTimerRef.current = setInterval(() => {
      const isIntraday = isIntradayTimeframe(timeframe);

      // Only auto-refresh during market hours for intraday
      // Or always refresh for daily+ timeframes (less frequently)
      if (!isIntraday || isMarketOpen()) {
        console.log(
          `[useKLineData] Auto-refresh triggered for ${symbol} ${timeframe}`,
        );
        fetchData(false); // Don't show loading for auto-refresh
      }
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, timeframe, symbol, fetchData]);

  /**
   * Effect: Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    lastUpdate,
    source,
    isMock,
    refresh,
    updateLastBar,
  };
}

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * @deprecated Use shouldCreateNewBar from @/lib/trading/time-parser instead
 * This version doesn't handle lunch breaks and timezone correctly
 *
 * Check if data needs a new bar (for intraday timeframes)
 */
export function shouldCreateNewBar(
  lastBarTime: number,
  currentTime: number,
  timeframe: TimeFrame,
): boolean {
  // Redirect to new implementation
  return shouldCreateNewBarTimeParser(lastBarTime, currentTime, timeframe);
}

/**
 * @deprecated Use alignToBarStart from @/lib/trading/time-parser instead
 * This version doesn't handle timezone correctly
 *
 * Get the start time for a new bar
 */
export function getBarStartTime(
  timestamp: number,
  timeframe: TimeFrame,
): number {
  // Redirect to new implementation
  return alignToBarStart(timestamp, timeframe);
}

/**
 * Legacy mock data generator for backward compatibility
 * Use the intelligent mock in kline-fetcher instead
 */
export function generateMockKLineData(
  days: number = 200,
  startPrice: number = 100,
): KLineData[] {
  const data: KLineData[] = [];
  let price = startPrice;
  const now = getChinaTime();
  now.setHours(15, 0, 0, 0);

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const time = Math.floor(date.getTime() / 1000);
    const volatility = 0.02;
    const trend = Math.sin(i / 30) * 0.001;
    const change = (Math.random() - 0.5) * 2 * volatility + trend;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return data;
}
