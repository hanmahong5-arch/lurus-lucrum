/**
 * Feature Usage Hook
 * Client-side hook to fetch and cache feature usage data.
 *
 * Fail-open: API errors do not block user operations.
 *
 * @module hooks/use-feature-usage
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UsageFeature } from "@/lib/config/plan-limits";

// =============================================================================
// TYPES
// =============================================================================

interface FeatureUsageData {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface UsageState {
  backtest: FeatureUsageData | null;
  ai_call: FeatureUsageData | null;
}

interface UseFeatureUsageReturn {
  usage: UsageState;
  plan: string;
  loading: boolean;
  /** Force refresh usage data */
  refresh: () => Promise<void>;
  /** Check if a feature is blocked (quota exceeded) */
  isBlocked: (feature: UsageFeature) => boolean;
  /** Get remaining count for a feature */
  getRemaining: (feature: UsageFeature) => number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL_MS = 30_000; // 30 seconds client-side cache

// =============================================================================
// HOOK
// =============================================================================

export function useFeatureUsage(): UseFeatureUsageReturn {
  const [usage, setUsage] = useState<UsageState>({ backtest: null, ai_call: null });
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);

  const fetchUsage = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < CACHE_TTL_MS) {
      return; // Use cached data
    }

    setLoading(true);
    try {
      const res = await fetch("/api/usage/status");
      if (!res.ok) return; // Fail-open

      const json = await res.json();
      if (json.success && json.data) {
        setUsage({
          backtest: json.data.backtest ?? null,
          ai_call: json.data.ai_call ?? null,
        });
        if (json.plan) setPlan(json.plan);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // Fail-open: silently ignore errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const refresh = useCallback(async () => {
    await fetchUsage(true);
  }, [fetchUsage]);

  const isBlocked = useCallback(
    (feature: UsageFeature): boolean => {
      const data = usage[feature];
      if (!data) return false; // Fail-open: if no data, don't block
      return !data.allowed;
    },
    [usage],
  );

  const getRemaining = useCallback(
    (feature: UsageFeature): number => {
      const data = usage[feature];
      if (!data) return Infinity; // Fail-open
      return data.remaining;
    },
    [usage],
  );

  return { usage, plan, loading, refresh, isBlocked, getRemaining };
}
