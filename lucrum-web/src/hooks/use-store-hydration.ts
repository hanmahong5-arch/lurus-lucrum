/**
 * Store Hydration Hook
 *
 * Ensures all persisted Zustand stores are hydrated from localStorage
 * before rendering. Use in the dashboard layout to prevent flash of
 * empty/default state when navigating between pages.
 *
 * Returns `{ isHydrated: boolean }` — components should show a loading
 * skeleton until `isHydrated` becomes true.
 *
 * @module hooks/use-store-hydration
 */

'use client';

import { useState, useEffect } from 'react';
import { useValidationStore } from '@/lib/stores/validation-store';
import { useAnalysisStore } from '@/lib/stores/analysis-store';
import { useAdvisorStore } from '@/lib/stores/advisor-store';
import { useMarketDataStore } from '@/lib/stores/market-data-store';
import { useUserPreferencesStore } from '@/lib/stores/user-preferences-store';
import { useBacktestHistoryStore } from '@/lib/stores/backtest-history-store';
import { useTradingStore } from '@/lib/stores/trading-store';
import { useWorkflowStore } from '@/lib/stores/workflow-store';
import { useTaskRegistryStore } from '@/lib/stores/task-registry-store';

/**
 * Check whether a Zustand persist store has finished rehydration.
 *
 * For stores created with `createPersistedStore`, we read `_hasHydrated`.
 * For legacy stores that use `persist` directly, we fall back to the
 * Zustand persist API `hasHydrated()` on the store's persist object.
 */
function isStoreHydrated(store: { getState: () => Record<string, unknown>; persist?: { hasHydrated: () => boolean } }): boolean {
  // Stores built with createPersistedStore have _hasHydrated
  const state = store.getState();
  if (typeof state._hasHydrated === 'boolean') {
    return state._hasHydrated;
  }

  // Legacy stores: use the persist API
  if (store.persist?.hasHydrated) {
    return store.persist.hasHydrated();
  }

  // Store has no persistence — consider it hydrated
  return true;
}

/**
 * Hook that monitors hydration state of all persisted stores.
 *
 * On mount, it checks whether each store has already hydrated.
 * If not, it polls briefly (persist hydration is synchronous for
 * localStorage, so it completes within a single tick in most cases).
 *
 * @returns `{ isHydrated: boolean }` — true when ALL stores are ready
 *
 * @example
 * ```tsx
 * function DashboardLayout({ children }) {
 *   const { isHydrated } = useStoreHydration();
 *
 *   if (!isHydrated) {
 *     return <LoadingSkeleton />;
 *   }
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useStoreHydration(): { isHydrated: boolean } {
  const [isHydrated, setIsHydrated] = useState(false);

  // Read hydration flags from each store created via createPersistedStore
  const validationHydrated = useValidationStore((s) => s._hasHydrated);
  const analysisHydrated = useAnalysisStore((s) => s._hasHydrated);
  const advisorHydrated = useAdvisorStore((s) => s._hasHydrated);
  const marketDataHydrated = useMarketDataStore((s) => s._hasHydrated);
  const preferencesHydrated = useUserPreferencesStore((s) => s._hasHydrated);

  useEffect(() => {
    // New stores (createPersistedStore) track hydration via _hasHydrated
    const newStoresReady =
      validationHydrated &&
      analysisHydrated &&
      advisorHydrated &&
      marketDataHydrated &&
      preferencesHydrated;

    // Legacy stores use the persist API
    const legacyStoresReady =
      isStoreHydrated(useBacktestHistoryStore as unknown as Parameters<typeof isStoreHydrated>[0]) &&
      isStoreHydrated(useTradingStore as unknown as Parameters<typeof isStoreHydrated>[0]) &&
      isStoreHydrated(useWorkflowStore as unknown as Parameters<typeof isStoreHydrated>[0]) &&
      isStoreHydrated(useTaskRegistryStore as unknown as Parameters<typeof isStoreHydrated>[0]);

    if (newStoresReady && legacyStoresReady) {
      setIsHydrated(true);
    }
  }, [
    validationHydrated,
    analysisHydrated,
    advisorHydrated,
    marketDataHydrated,
    preferencesHydrated,
  ]);

  return { isHydrated };
}
