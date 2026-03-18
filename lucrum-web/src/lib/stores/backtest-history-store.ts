/**
 * Backtest History Store
 *
 * Manages the most recent 20 backtest results in localStorage.
 * Provides CRUD operations, overflow eviction, and selection tracking.
 *
 * Storage: Zustand + persist middleware (localStorage)
 * Eviction: Oldest entry removed when exceeding MAX_ENTRIES
 *
 * @module lib/stores/backtest-history-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScoreGrade } from "@/lib/backtest/score";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of backtest history entries to retain */
const MAX_ENTRIES = 20;

/** localStorage key for persistence */
const STORAGE_KEY = "lucrum-backtest-history";

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single backtest history entry.
 * Financial values stored as Decimal-compatible strings.
 */
export interface BacktestHistoryEntry {
  /** Unique identifier */
  id: string;
  /** Unix timestamp in milliseconds when backtest was executed */
  timestamp: number;
  /** Strategy display name */
  strategyName: string;
  /** Stock symbol code (e.g., "600519") */
  symbol: string;
  /** Stock display name (e.g., "Gui Zhou Mao Tai") */
  symbolName: string;
  /** Total return as Decimal string (e.g., "0.235" = 23.5%) */
  totalReturn: string;
  /** Annualized return as Decimal string */
  annualizedReturn: string;
  /** Maximum drawdown as Decimal string */
  maxDrawdown: string;
  /** Sharpe ratio as Decimal string */
  sharpeRatio: string;
  /** Strategy grade S/A/B/C/D */
  grade: ScoreGrade;
  /** Numeric score 0-100 */
  score: number;
  /** Total number of trades */
  tradeCount: number;
}

/**
 * Store state shape
 */
interface BacktestHistoryState {
  /** List of history entries, sorted by timestamp descending */
  entries: BacktestHistoryEntry[];
  /** Currently selected entry ID (for restore view) */
  selectedId: string | null;

  // Actions
  /** Add a new entry; evicts oldest if exceeding MAX_ENTRIES */
  addEntry: (entry: BacktestHistoryEntry) => void;
  /** Remove a specific entry by ID */
  removeEntry: (id: string) => void;
  /** Clear all entries and reset selection */
  clearHistory: () => void;
  /** Set the selected entry ID (pass null to deselect) */
  selectEntry: (id: string | null) => void;
  /** Get the currently selected entry object, or null */
  getSelectedEntry: () => BacktestHistoryEntry | null;
}

// =============================================================================
// STORE
// =============================================================================

export const useBacktestHistoryStore = create<BacktestHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      selectedId: null,

      addEntry: (entry: BacktestHistoryEntry) => {
        set((state) => {
          // Remove existing entry with the same ID (update scenario)
          const filtered = state.entries.filter((e) => e.id !== entry.id);

          // Insert the new entry
          const updated = [entry, ...filtered];

          // Sort by timestamp descending (newest first)
          updated.sort((a, b) => b.timestamp - a.timestamp);

          // Evict oldest entries beyond MAX_ENTRIES
          const trimmed = updated.slice(0, MAX_ENTRIES);

          return { entries: trimmed };
        });
      },

      removeEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
          // Clear selection if the removed entry was selected
          selectedId: state.selectedId === id ? null : state.selectedId,
        }));
      },

      clearHistory: () => {
        set({ entries: [], selectedId: null });
      },

      selectEntry: (id: string | null) => {
        set({ selectedId: id });
      },

      getSelectedEntry: () => {
        const { entries, selectedId } = get();
        if (!selectedId) return null;
        return entries.find((e) => e.id === selectedId) ?? null;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // Guard against SSR where localStorage is not available
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      // Only persist entries and selectedId, not functions
      partialize: (state) => ({
        entries: state.entries,
        selectedId: state.selectedId,
      }),
    }
  )
);
