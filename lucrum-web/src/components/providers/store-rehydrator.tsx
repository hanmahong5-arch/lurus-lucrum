'use client';

import { useEffect } from 'react';
import { useValidationStore } from '@/lib/stores/validation-store';
import { useAnalysisStore } from '@/lib/stores/analysis-store';
import { useAdvisorStore } from '@/lib/stores/advisor-store';
import { useMarketDataStore } from '@/lib/stores/market-data-store';
import { useUserPreferencesStore } from '@/lib/stores/user-preferences-store';
import { useBacktestHistoryStore } from '@/lib/stores/backtest-history-store';
import { useTradingStore } from '@/lib/stores/trading-store';
import { useWorkflowStore } from '@/lib/stores/workflow-store';
import { useTaskRegistryStore } from '@/lib/stores/task-registry-store';
import { useStrategyVersionStore } from '@/lib/stores/strategy-version-store';
import { useStrategyWorkspaceStore } from '@/lib/stores/strategy-workspace-store';
import { useWatchlistStore } from '@/lib/stores/watchlist-store';

/**
 * Triggers rehydration of all persisted stores AFTER Next.js hydration.
 * Must be rendered inside the app layout as a client component.
 *
 * Stores created with `createPersistedStore` use `skipHydration: true`
 * so they do not read localStorage during SSR/initial render.
 * Legacy stores that use `persist()` directly also get rehydrated here
 * for consistency.
 */
export function StoreRehydrator() {
  useEffect(() => {
    const stores = [
      // Stores built with createPersistedStore (skipHydration: true)
      { name: 'validation', rehydrate: useValidationStore.persist.rehydrate },
      { name: 'analysis', rehydrate: useAnalysisStore.persist.rehydrate },
      { name: 'advisor', rehydrate: useAdvisorStore.persist.rehydrate },
      { name: 'market-data', rehydrate: useMarketDataStore.persist.rehydrate },
      { name: 'user-preferences', rehydrate: useUserPreferencesStore.persist.rehydrate },
      { name: 'watchlist', rehydrate: useWatchlistStore.persist.rehydrate },
      // Legacy stores using persist() directly
      { name: 'backtest-history', rehydrate: useBacktestHistoryStore.persist.rehydrate },
      { name: 'trading', rehydrate: useTradingStore.persist.rehydrate },
      { name: 'workflow', rehydrate: useWorkflowStore.persist.rehydrate },
      { name: 'task-registry', rehydrate: useTaskRegistryStore.persist.rehydrate },
      { name: 'strategy-version', rehydrate: useStrategyVersionStore.persist.rehydrate },
      { name: 'strategy-workspace', rehydrate: useStrategyWorkspaceStore.persist.rehydrate },
    ];

    for (const store of stores) {
      try {
        store.rehydrate();
      } catch (err) {
        console.error(`[StoreRehydrator] Failed to rehydrate ${store.name}:`, err);
        // Clear corrupted data so next load starts fresh
        try {
          localStorage.removeItem(`lucrum:${store.name}`);
        } catch {
          // localStorage might be unavailable
        }
      }
    }
  }, []);

  return null;
}
