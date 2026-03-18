/**
 * Discovery Strategies Hook
 *
 * Custom hook for fetching popular/trending strategies from the API
 * with graceful degradation: API data -> cached data -> builtin templates.
 *
 * Story 3.2: Discovery Page & Filter
 *
 * @module hooks/use-discovery-strategies
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";

// =============================================================================
// TYPES
// =============================================================================

/** Strategy data from popular/trending API */
export interface DiscoveryStrategy {
  id: number;
  source: string;
  name: string;
  description: string | null;
  author: string | null;
  strategyType: string | null;
  indicators: string[] | null;
  views: number;
  likes: number;
  popularityScore: string | null;
  isFeatured: boolean;
  originalUrl: string | null;
  updatedAt: string;
}

/** Filter state */
export interface DiscoveryFilters {
  type: string;
  sort: string;
  search: string;
}

/** Data source indicator */
export type DiscoveryDataSource = "api" | "cache" | "builtin" | "none";

/** Default filters */
export const DEFAULT_FILTERS: DiscoveryFilters = {
  type: "all",
  sort: "popularity",
  search: "",
};

/** Hook return value */
export interface UseDiscoveryStrategiesReturn {
  strategies: DiscoveryStrategy[];
  isLoading: boolean;
  error: string | null;
  dataSource: DiscoveryDataSource;
  totalCount: number;
  dataTimestamp: string | null;
  isStale: boolean;
  refetch: () => void;
  showCached: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = "lucrum:discovery:strategies";
const CACHE_TS_KEY = "lucrum:discovery:timestamp";

// =============================================================================
// HELPERS
// =============================================================================

function builtinToDiscovery(templates: readonly BuiltinTemplate[]): DiscoveryStrategy[] {
  return templates.map((t, idx) => ({
    id: -(idx + 1),
    source: "builtin",
    name: t.name,
    description: t.description,
    author: null,
    strategyType: t.category,
    indicators: null,
    views: 0,
    likes: 0,
    popularityScore: null,
    isFeatured: false,
    originalUrl: null,
    updatedAt: new Date().toISOString(),
  }));
}

function readCache(): { strategies: DiscoveryStrategy[]; timestamp: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (raw && ts) {
      return { strategies: JSON.parse(raw), timestamp: ts };
    }
  } catch {
    // Silently fail
  }
  return null;
}

function writeCache(strategies: DiscoveryStrategy[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(strategies));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch {
    // Silently fail
  }
}

function buildApiUrl(filters: DiscoveryFilters): string {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  params.set("limit", "50");
  return "/api/strategies/popular?" + params.toString();
}

// =============================================================================
// HOOK
// =============================================================================

export function useDiscoveryStrategies(
  filters: DiscoveryFilters
): UseDiscoveryStrategiesReturn {
  const [allStrategies, setAllStrategies] = useState<DiscoveryStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DiscoveryDataSource>("none");
  const [totalCount, setTotalCount] = useState(0);
  const [dataTimestamp, setDataTimestamp] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isStale = useMemo(() => {
    if (!dataTimestamp) return false;
    const age = Date.now() - new Date(dataTimestamp).getTime();
    return age > STALE_THRESHOLD_MS;
  }, [dataTimestamp]);

  // Stabilize filter reference to prevent unnecessary refetches
  const filtersKey = JSON.stringify(filters);

  const fetchStrategies = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const currentFilters: DiscoveryFilters = JSON.parse(filtersKey);
      const url = buildApiUrl(currentFilters);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("API returned " + response.status);
      const data = await response.json();
      const strategies: DiscoveryStrategy[] = data.strategies || [];
      const total: number = data.pagination?.total ?? strategies.length;
      setAllStrategies(strategies);
      setTotalCount(total);
      setDataSource("api");
      setDataTimestamp(new Date().toISOString());
      writeCache(strategies);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      const cached = readCache();
      if (cached && cached.strategies.length > 0) {
        setAllStrategies(cached.strategies);
        setTotalCount(cached.strategies.length);
        setDataSource("cache");
        setDataTimestamp(cached.timestamp);
      } else {
        const fallback = builtinToDiscovery(BUILTIN_TEMPLATES);
        setAllStrategies(fallback);
        setTotalCount(fallback.length);
        setDataSource("builtin");
        setDataTimestamp(null);
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const showCached = useCallback(() => {
    const cached = readCache();
    if (cached && cached.strategies.length > 0) {
      setAllStrategies(cached.strategies);
      setTotalCount(cached.strategies.length);
      setDataSource("cache");
      setDataTimestamp(cached.timestamp);
      setError(null);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    fetchStrategies();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStrategies]);

  const strategies = useMemo(() => {
    const result = [...allStrategies];
    if (filters.sort === "stars") {
      result.sort((a, b) => b.likes - a.likes);
    }
    return result;
  }, [allStrategies, filters.sort]);

  return {
    strategies, isLoading, error, dataSource, totalCount,
    dataTimestamp, isStale, refetch, showCached,
  };
}