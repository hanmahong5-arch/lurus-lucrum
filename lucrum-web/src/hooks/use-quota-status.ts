/**
 * useQuotaStatus Hook
 * 配额状态 Hook
 *
 * Fetches the current user's remaining AI token quota from lurus-api
 * through the existing proxy route.
 */

'use client';

import { useState, useEffect } from 'react';

interface QuotaStatus {
  remaining: number;
  total: number;
  plan: string;
  loading: boolean;
}

/** Cache quota data for 60 seconds to avoid hammering the billing API */
const QUOTA_CACHE_TTL_MS = 60_000;
const quotaCache = new Map<string, { data: Omit<QuotaStatus, 'loading'>; expiresAt: number }>();

export function useQuotaStatus(userId: string): QuotaStatus {
  const [status, setStatus] = useState<QuotaStatus>({
    remaining: 0,
    total: 0,
    plan: 'free',
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStatus({ remaining: 0, total: 0, plan: 'free', loading: false });
      return;
    }

    // Return cached value if still fresh
    const cached = quotaCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      setStatus({ ...cached.data, loading: false });
      return;
    }

    let cancelled = false;

    async function fetchQuota() {
      try {
        const res = await fetch('/api/lurus/billing/quota', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          remaining?: number;
          total?: number;
          plan?: string;
        };
        const result = {
          remaining: data.remaining ?? 0,
          total: data.total ?? 0,
          plan: data.plan ?? 'free',
        };
        quotaCache.set(userId, { data: result, expiresAt: Date.now() + QUOTA_CACHE_TTL_MS });
        if (!cancelled) setStatus({ ...result, loading: false });
      } catch {
        // Fail silently — quota display is non-critical
        if (!cancelled) setStatus((prev) => ({ ...prev, loading: false }));
      }
    }

    void fetchQuota();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return status;
}
