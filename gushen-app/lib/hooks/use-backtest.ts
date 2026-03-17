/**
 * Backtest Hooks
 *
 * Trigger backtests, fetch history, track streaming progress.
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import EventSource, { type MessageEvent, type ErrorEvent, type TimeoutEvent, type ExceptionEvent } from "react-native-sse";
import { gushenApi } from "@/lib/api/client";
import { tokenStore } from "@/lib/auth/token-store";
import { API_CONFIG } from "@/constants/api";
import type {
  BacktestHistoryResponse,
  UnifiedBacktestRequest,
  BacktestMetrics,
  EquityPoint,
  BacktestTrade,
} from "@shared/types";

// ============================================================
// Backtest History (paginated)
// ============================================================

interface HistoryOptions {
  symbol?: string;
  sortBy?: "createdAt" | "totalReturn" | "sharpeRatio";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

export function useBacktestHistory(options: HistoryOptions = {}) {
  const { symbol, sortBy = "createdAt", sortOrder = "desc", limit = 20 } = options;

  return useInfiniteQuery({
    queryKey: ["backtest", "history", symbol, sortBy, sortOrder, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(pageParam),
        sortBy,
        sortOrder,
      });
      if (symbol) params.set("symbol", symbol);

      const { data } = await gushenApi.get<{
        success: boolean;
        data: BacktestHistoryResponse;
      }>(`/history/backtests?${params}`);

      if (!data.success) throw new Error("Failed to fetch backtest history");
      return data.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const offset = allPages.reduce((sum, p) => sum + p.backtests.length, 0);
      return lastPage.pagination.hasMore ? offset : undefined;
    },
    staleTime: 30_000,
  });
}

// ============================================================
// Backtest Detail (single result by ID)
// ============================================================

export interface BacktestDetailResult {
  id: number;
  symbol: string;
  stockName: string;
  startDate: string;
  endDate: string;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  strategy?: { id: number; name: string; type: string };
  executionTime: number;
  dataSource: string;
}

export function useBacktestDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["backtest", "detail", id],
    queryFn: async () => {
      const { data } = await gushenApi.get<{
        success: boolean;
        data: BacktestDetailResult;
      }>(`/history/backtests/${id}`);
      if (!data.success) throw new Error("Failed to fetch backtest detail");
      return data.data;
    },
    enabled: !!id,
    staleTime: 300_000, // 5min — historical data doesn't change
  });
}

// ============================================================
// Run Backtest (Unified)
// ============================================================

interface BacktestResult {
  jobId: string;
  returnMetrics: {
    totalReturn: number;
    annualizedReturn: number;
  };
  riskMetrics: {
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
  };
  tradingMetrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgHoldingDays: number;
  };
  equityCurve: EquityPoint[];
  executionTime: number;
}

export function useRunBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UnifiedBacktestRequest) => {
      const { data } = await gushenApi.post<{
        success: boolean;
        data: BacktestResult;
        error?: string;
      }>("/backtest/unified", request);

      if (!data.success) throw new Error(data.error ?? "Backtest failed");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest", "history"] });
    },
  });
}

// ============================================================
// Simple Backtest (with strategy code)
// ============================================================

interface SimpleBacktestRequest {
  strategyCode: string;
  config: {
    symbol: string;
    initialCapital: number;
    commission: number;
    slippage: number;
    startDate: string;
    endDate: string;
    timeframe: string;
  };
}

export function useSimpleBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SimpleBacktestRequest) => {
      const { data } = await gushenApi.post<{
        success: boolean;
        data: {
          equityCurve: EquityPoint[];
          totalReturn: number;
          sharpeRatio: number;
          maxDrawdown: number;
          winRate: number;
          totalTrades: number;
        };
        error?: string;
      }>("/backtest", request);

      if (!data.success) throw new Error(data.error ?? "Backtest failed");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest", "history"] });
    },
  });
}

// ============================================================
// Streaming Backtest Progress (multi-stock SSE)
// ============================================================

interface StreamingProgress {
  completed: number;
  total: number;
  failed: number;
  currentItem: string;
  elapsedMs: number;
}

export function useStreamingBacktest() {
  const [progress, setProgress] = useState<StreamingProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(async (request: {
    symbols: string[];
    strategy: string;
    startDate: string;
    endDate: string;
    holdingDays?: number;
  }) => {
    if (esRef.current) {
      esRef.current.close();
    }

    setIsRunning(true);
    setError(null);
    setProgress(null);
    setResult(null);

    const token = await tokenStore.getAccessToken();
    const url = `${API_CONFIG.GUSHEN_API_URL}/backtest/multi-stocks/stream`;

    const es = new EventSource(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });
    esRef.current = es;

    es.addEventListener("message", (event: MessageEvent) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "progress") {
          setProgress({
            completed: parsed.completed,
            total: parsed.total,
            failed: parsed.failed,
            currentItem: parsed.currentItem,
            elapsedMs: parsed.elapsedMs,
          });
        } else if (parsed.type === "complete") {
          setResult(parsed.result);
          setIsRunning(false);
          es.close();
          esRef.current = null;
        } else if (parsed.type === "error") {
          setError(parsed.message);
          setIsRunning(false);
          es.close();
          esRef.current = null;
        }
      } catch {
        // Ignore malformed events
      }
    });

    es.addEventListener("error", (event: ErrorEvent | TimeoutEvent | ExceptionEvent) => {
      es.close();
      esRef.current = null;
      setError("message" in event ? event.message : "Connection failed");
      setIsRunning(false);
    });
  }, []);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
  }, []);

  return { progress, isRunning, error, result, start, stop };
}
