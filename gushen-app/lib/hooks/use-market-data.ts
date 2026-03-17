/**
 * Market Data Hooks (adapted from gushen-web)
 *
 * Uses React Query + axios. Endpoints call gushen-web API routes.
 */

import { useQuery } from "@tanstack/react-query";
import { gushenApi } from "@/lib/api/client";
import type { StockQuote, KLineData, KLineTimeFrame, IndexQuote } from "@shared/types";

// ============================================================
// Types
// ============================================================

interface MarketApiResponse<T> {
  success: boolean;
  data: T;
  source?: string;
  cached?: boolean;
  timestamp: number;
  latency?: number;
  warning?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
  timestamp: string;
}

interface StockListItem {
  symbol: string;
  name: string;
  exchange?: string;
  marketCap?: number;
  isST?: boolean;
}

interface StockSearchResult {
  symbol: string;
  name: string;
  displayName: string;
  exchange: string;
  isST: boolean;
  matchType: "exact" | "name" | "pinyin";
}

interface SearchResponse {
  success: boolean;
  results: StockSearchResult[];
  total: number;
  query: string;
}

// ============================================================
// Stock List
// ============================================================

interface StockListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  excludeST?: boolean;
  sortBy?: "symbol" | "name" | "marketCap";
  sortOrder?: "asc" | "desc";
  enabled?: boolean;
}

export function useStockList(options: StockListOptions = {}) {
  const {
    page = 1,
    pageSize = 100,
    search,
    excludeST = false,
    sortBy = "symbol",
    sortOrder = "asc",
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ["stocks", "list", page, pageSize, search, excludeST, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        excludeST: String(excludeST),
        sortBy,
        sortOrder,
      });
      if (search) params.set("search", search);

      const { data } = await gushenApi.get<PaginatedResponse<StockListItem>>(
        `/stocks/list?${params}`,
      );
      return data;
    },
    staleTime: 60_000, // 1min
    enabled,
  });
}

// ============================================================
// Stock Search
// ============================================================

export function useStockSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: ["stocks", "search", query, limit],
    queryFn: async () => {
      const { data } = await gushenApi.get<SearchResponse>(
        `/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return data.results;
    },
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
}

// ============================================================
// Stock Quote
// ============================================================

export function useStockQuote(symbol: string, refreshInterval = 0) {
  return useQuery({
    queryKey: ["market", "quote", symbol],
    queryFn: async () => {
      const { data } = await gushenApi.get<MarketApiResponse<StockQuote>>(
        `/market/quote?symbol=${symbol}`,
      );
      return data.data;
    },
    enabled: !!symbol,
    staleTime: 5_000,
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });
}

// ============================================================
// Batch Quotes (for watchlist)
// ============================================================

export function useBatchQuotes(symbols: string[], refreshInterval = 0) {
  return useQuery({
    queryKey: ["market", "quote", "batch", symbols.join(",")],
    queryFn: async () => {
      if (symbols.length === 0) return {};
      const { data } = await gushenApi.get<MarketApiResponse<Record<string, StockQuote>>>(
        `/market/quote?symbols=${symbols.join(",")}`,
      );
      return data.data;
    },
    enabled: symbols.length > 0,
    staleTime: 5_000,
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });
}

// ============================================================
// K-Line Data
// ============================================================

export function useKLineData(
  symbol: string,
  timeframe: KLineTimeFrame = "1d",
  limit = 200,
) {
  return useQuery({
    queryKey: ["market", "kline", symbol, timeframe, limit],
    queryFn: async () => {
      const { data } = await gushenApi.get<MarketApiResponse<KLineData[]>>(
        `/market/kline?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`,
      );
      return data.data ?? [];
    },
    enabled: !!symbol,
    staleTime: timeframe === "1d" ? 60_000 : 10_000,
  });
}

// ============================================================
// Major Indices
// ============================================================

const FALLBACK_INDICES: IndexQuote[] = [
  { symbol: "000001.SH", name: "SSE Composite", price: 0, change: 0, changePercent: 0, volume: 0, amount: 0, timestamp: 0 },
  { symbol: "399001.SZ", name: "SZSE Component", price: 0, change: 0, changePercent: 0, volume: 0, amount: 0, timestamp: 0 },
  { symbol: "000300.SH", name: "CSI 300", price: 0, change: 0, changePercent: 0, volume: 0, amount: 0, timestamp: 0 },
];

export function useMajorIndices(refreshInterval = 30_000) {
  return useQuery({
    queryKey: ["market", "indices"],
    queryFn: async () => {
      try {
        const { data } = await gushenApi.get<MarketApiResponse<IndexQuote[]>>(
          "/market/indices",
        );
        return data.data ?? FALLBACK_INDICES;
      } catch {
        return FALLBACK_INDICES;
      }
    },
    staleTime: 10_000,
    refetchInterval: refreshInterval,
  });
}

// ============================================================
// Capital Flow
// ============================================================

export function useCapitalFlow(symbol: string) {
  return useQuery({
    queryKey: ["market", "flow", symbol],
    queryFn: async () => {
      const { data } = await gushenApi.get<MarketApiResponse<Record<string, unknown>>>(
        `/market/flow?symbol=${symbol}`,
      );
      return data.data;
    },
    enabled: !!symbol,
    staleTime: 30_000,
  });
}

// ============================================================
// Stock Date Range (for backtest date picker)
// ============================================================

export function useStockDateRange(symbol: string) {
  return useQuery({
    queryKey: ["stocks", "dateRange", symbol],
    queryFn: async () => {
      const { data } = await gushenApi.get<MarketApiResponse<{
        symbol: string;
        minDate: string;
        maxDate: string;
        dataPoints: number;
      } | null>>(`/stocks/date-range?symbol=${symbol}`);
      return data.data;
    },
    enabled: !!symbol,
    staleTime: 3600_000, // 1 hour
  });
}
