/**
 * Strategy Version Store
 *
 * Manages strategy version history in localStorage via Zustand.
 * Each strategy maintains up to MAX_VERSIONS_PER_STRATEGY versions,
 * sorted by createdAt descending (most recent first).
 *
 * Storage: Zustand + persist middleware (localStorage)
 * Eviction: Oldest version removed when exceeding max per strategy
 *
 * @module lib/stores/strategy-version-store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of versions retained per strategy */
const MAX_VERSIONS_PER_STRATEGY = 20;

/** localStorage key for persistence */
const STORAGE_KEY = "gushen-strategy-versions";

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single strategy version entry stored in the version history.
 */
export interface StrategyVersionEntry {
  /** Unique version identifier */
  versionId: string;
  /** Reference to the parent strategy */
  strategyId: string;
  /** Strategy code at this version */
  code: string;
  /** Strategy parameters at this version */
  params: Record<string, unknown>;
  /** Human-readable description of changes */
  description: string;
  /** Unix timestamp in milliseconds */
  createdAt: number;
  /** Optional backtest score */
  score?: { grade: string; score: number };
}

interface VersionStoreState {
  /** All versions, keyed by strategyId for efficient lookup */
  versionsByStrategy: Record<string, StrategyVersionEntry[]>;
}

interface VersionStoreActions {
  /** Add a new version entry */
  addVersion: (version: StrategyVersionEntry) => void;
  /** Get all versions for a specific strategy (sorted desc by createdAt) */
  getVersionsForStrategy: (strategyId: string) => StrategyVersionEntry[];
  /** Get a single version by its ID */
  getVersionById: (versionId: string) => StrategyVersionEntry | undefined;
  /** Get the most recent version for a strategy */
  getLatestVersion: (strategyId: string) => StrategyVersionEntry | undefined;
  /** Get version count for a strategy */
  getVersionCount: (strategyId: string) => number;
  /** Clear all versions for a specific strategy */
  clearStrategyVersions: (strategyId: string) => void;
  /** Clear all versions across all strategies */
  clearAll: () => void;
}

type VersionStore = VersionStoreState & VersionStoreActions;

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useStrategyVersionStore = create<VersionStore>()(
  persist(
    (set, get) => ({
      versionsByStrategy: {},

      addVersion: (version: StrategyVersionEntry) => {
        set((state) => {
          const strategyId = version.strategyId;
          const existing = state.versionsByStrategy[strategyId] ?? [];

          // Insert new version and sort descending by createdAt
          const updated = [...existing, version].sort(
            (a, b) => b.createdAt - a.createdAt
          );

          // Evict oldest if exceeding max
          const trimmed = updated.slice(0, MAX_VERSIONS_PER_STRATEGY);

          return {
            versionsByStrategy: {
              ...state.versionsByStrategy,
              [strategyId]: trimmed,
            },
          };
        });
      },

      getVersionsForStrategy: (strategyId: string) => {
        return get().versionsByStrategy[strategyId] ?? [];
      },

      getVersionById: (versionId: string) => {
        const allStrategies = get().versionsByStrategy;
        for (const versions of Object.values(allStrategies)) {
          const found = versions.find((v) => v.versionId === versionId);
          if (found) return found;
        }
        return undefined;
      },

      getLatestVersion: (strategyId: string) => {
        const versions = get().versionsByStrategy[strategyId];
        if (!versions || versions.length === 0) return undefined;
        return versions[0]; // Already sorted desc by createdAt
      },

      getVersionCount: (strategyId: string) => {
        return (get().versionsByStrategy[strategyId] ?? []).length;
      },

      clearStrategyVersions: (strategyId: string) => {
        set((state) => {
          const { [strategyId]: _, ...rest } = state.versionsByStrategy;
          return { versionsByStrategy: rest };
        });
      },

      clearAll: () => {
        set({ versionsByStrategy: {} });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        versionsByStrategy: state.versionsByStrategy,
      }),
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectVersionsByStrategy =
  (strategyId: string) => (state: VersionStore) =>
    state.versionsByStrategy[strategyId] ?? [];

export const selectVersionCount =
  (strategyId: string) => (state: VersionStore) =>
    (state.versionsByStrategy[strategyId] ?? []).length;

export const selectLatestVersion =
  (strategyId: string) => (state: VersionStore) => {
    const versions = state.versionsByStrategy[strategyId];
    return versions?.[0];
  };
