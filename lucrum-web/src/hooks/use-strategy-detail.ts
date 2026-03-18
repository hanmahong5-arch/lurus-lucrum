/**
 * Strategy Detail Hook
 *
 * Fetches detailed strategy data for the detail panel.
 * Supports both API-sourced strategies and builtin templates.
 *
 * Story 3.3: Strategy Detail Panel & Quick Preview
 *
 * @module hooks/use-strategy-detail
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";
import type { DiscoveryStrategy } from "@/hooks/use-discovery-strategies";

// =============================================================================
// TYPES
// =============================================================================

/** Extended strategy detail with code and full metadata */
export interface StrategyDetail extends DiscoveryStrategy {
  /** Original source code from crawler */
  originalCode: string | null;
  /** Converted vnpy CtaTemplate code */
  veighnaCode: string | null;
  /** Conversion status: pending, success, failed */
  conversionStatus: string | null;
  /** Annual return rate (decimal string) */
  annualReturn: string | null;
  /** Maximum drawdown (decimal string) */
  maxDrawdown: string | null;
  /** Sharpe ratio (decimal string) */
  sharpeRatio: string | null;
  /** Classification tags */
  tags: string[] | null;
  /** Target markets */
  markets: string[] | null;
  /** Default parameters (from builtin templates) */
  defaultParams: Record<string, number | string> | null;
  /** Trading conditions in plain language */
  conditions: {
    buy: string[];
    sell: string[];
    position?: string;
  } | null;
}

/** Hook return value */
export interface UseStrategyDetailReturn {
  detail: StrategyDetail | null;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Negative IDs indicate builtin templates */
const BUILTIN_ID_THRESHOLD = 0;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a builtin template to StrategyDetail format.
 * Builtin templates use negative IDs (assigned in use-discovery-strategies).
 */
function builtinToDetail(
  template: BuiltinTemplate,
  discoveryId: number
): StrategyDetail {
  return {
    id: discoveryId,
    source: "builtin",
    name: template.name,
    description: template.description,
    author: null,
    strategyType: template.category,
    indicators: null,
    views: 0,
    likes: 0,
    popularityScore: null,
    isFeatured: false,
    originalUrl: null,
    updatedAt: new Date().toISOString(),
    originalCode: null,
    veighnaCode: template.code,
    conversionStatus: "success",
    annualReturn: null,
    maxDrawdown: null,
    sharpeRatio: null,
    tags: null,
    markets: null,
    defaultParams: template.defaultParams,
    conditions: template.conditions,
  };
}

/**
 * Convert API response to StrategyDetail.
 * Merges DiscoveryStrategy base data with fetched detail fields.
 */
function apiResponseToDetail(
  base: DiscoveryStrategy,
  apiData: Record<string, unknown>
): StrategyDetail {
  return {
    ...base,
    originalCode: (apiData.originalCode as string) ?? null,
    veighnaCode: (apiData.veighnaCode as string) ?? null,
    conversionStatus: (apiData.conversionStatus as string) ?? null,
    annualReturn: (apiData.annualReturn as string) ?? null,
    maxDrawdown: (apiData.maxDrawdown as string) ?? null,
    sharpeRatio: (apiData.sharpeRatio as string) ?? null,
    tags: (apiData.tags as string[]) ?? null,
    markets: (apiData.markets as string[]) ?? null,
    defaultParams: null,
    conditions: null,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useStrategyDetail(
  strategy: DiscoveryStrategy | null
): UseStrategyDetailReturn {
  const [detail, setDetail] = useState<StrategyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDetail = useCallback(async (s: DiscoveryStrategy) => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();

    setIsLoading(true);
    setError(null);

    // Handle builtin templates (negative IDs)
    if (s.id <= BUILTIN_ID_THRESHOLD) {
      const templateIndex = Math.abs(s.id) - 1;
      const template = BUILTIN_TEMPLATES[templateIndex];
      if (template) {
        setDetail(builtinToDetail(template, s.id));
      } else {
        setError("Builtin template not found");
        setDetail(null);
      }
      setIsLoading(false);
      return;
    }

    // Fetch from API for non-builtin strategies
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({ limit: "1", search: s.name });
      const response = await fetch(
        "/api/strategies/popular?" + params.toString(),
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch strategy detail: HTTP " + response.status);
      }

      const data = await response.json();
      const strategies = data.strategies ?? [];
      const match = strategies.find(
        (item: Record<string, unknown>) => item.id === s.id
      );

      if (match) {
        setDetail(apiResponseToDetail(s, match));
      } else {
        // Fallback: use base discovery data with null code fields
        setDetail({
          ...s,
          originalCode: null,
          veighnaCode: null,
          conversionStatus: null,
          annualReturn: null,
          maxDrawdown: null,
          sharpeRatio: null,
          tags: null,
          markets: null,
          defaultParams: null,
          conditions: null,
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      // Still set a partial detail so the panel can render basic info
      setDetail({
        ...s,
        originalCode: null,
        veighnaCode: null,
        conversionStatus: null,
        annualReturn: null,
        maxDrawdown: null,
        sharpeRatio: null,
        tags: null,
        markets: null,
        defaultParams: null,
        conditions: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (strategy) {
      fetchDetail(strategy);
    } else {
      setDetail(null);
      setError(null);
      setIsLoading(false);
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [strategy, fetchDetail]);

  return { detail, isLoading, error };
}
