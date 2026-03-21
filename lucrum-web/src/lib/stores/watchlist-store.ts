'use client';

/**
 * Watchlist Store
 *
 * Organized stock groups that users create and maintain.
 * Feeds into: portfolio backtest (quick import), trading (quick switch),
 * analysis (scan targets).
 *
 * Features:
 * - Multiple named lists: "科技龙头", "低价分仓", "关注中" etc.
 * - Default list: "默认自选"
 * - Max 10 lists, max 100 stocks per list
 * - Persisted to localStorage with user scope
 * - Import/export capability
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:watchlist`
 *
 * @module lib/stores/watchlist-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export interface WatchlistStock {
  /** Stock symbol code (e.g., "600519") */
  symbol: string;
  /** Stock display name */
  name: string;
  /** Sector / industry */
  sector?: string;
  /** When this stock was added (ms) */
  addedAt: number;
  /** User's private note about why they added this stock */
  notes?: string;
}

export interface WatchlistGroup {
  /** Unique group identifier */
  id: string;
  /** User-visible group name */
  name: string;
  /** Stocks in this group */
  stocks: WatchlistStock[];
  /** Creation timestamp (ms) */
  createdAt: number;
  /** Last update timestamp (ms) */
  updatedAt: number;
}

export interface WatchlistState {
  /** All watchlist groups */
  groups: WatchlistGroup[];
  /** Currently active group ID in the panel */
  activeGroupId: string;
  /** Whether the watchlist panel is open */
  isPanelOpen: boolean;
}

interface WatchlistActions {
  // Group management
  createGroup: (name: string) => string | null;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;

  // Stock management
  addStock: (groupId: string, stock: Omit<WatchlistStock, 'addedAt'>) => void;
  removeStock: (groupId: string, symbol: string) => void;
  moveStock: (fromGroupId: string, toGroupId: string, symbol: string) => void;
  reorderStocks: (groupId: string, symbolOrder: string[]) => void;
  updateStockNote: (groupId: string, symbol: string, notes: string) => void;

  // Queries
  isInWatchlist: (symbol: string, groupId?: string) => boolean;
  getGroupById: (id: string) => WatchlistGroup | undefined;
  getStockGroups: (symbol: string) => WatchlistGroup[];

  // Import/Export
  exportGroup: (groupId: string) => string | null;
  importGroup: (json: string) => boolean;
  importStocksToGroup: (
    groupId: string,
    stocks: Array<{ symbol: string; name: string; sector?: string }>
  ) => number;

  // Panel
  setActiveGroupId: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  // Reset
  reset: () => void;
}

export type WatchlistStore = WatchlistState & WatchlistActions & HydrationState;

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of watchlist groups per user */
const MAX_GROUPS = 10;

/** Maximum number of stocks per group */
const MAX_STOCKS_PER_GROUP = 100;

/** Default group ID */
const DEFAULT_GROUP_ID = 'default';

/** Default group name */
const DEFAULT_GROUP_NAME = '默认自选';

// =============================================================================
// Helpers
// =============================================================================

function generateId(): string {
  return `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultGroup(): WatchlistGroup {
  const now = Date.now();
  return {
    id: DEFAULT_GROUP_ID,
    name: DEFAULT_GROUP_NAME,
    stocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Initial State
// =============================================================================

const INITIAL_STATE: WatchlistState = {
  groups: [createDefaultGroup()],
  activeGroupId: DEFAULT_GROUP_ID,
  isPanelOpen: false,
};

// =============================================================================
// Store
// =============================================================================

export const useWatchlistStore = createPersistedStore<WatchlistStore>(
  'watchlist',
  (set, get) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    // -------------------------------------------------------------------------
    // Group Management
    // -------------------------------------------------------------------------

    createGroup: (name) => {
      const state = get();
      if (state.groups.length >= MAX_GROUPS) return null;

      const trimmed = name.trim();
      if (!trimmed) return null;

      // Prevent duplicate names
      if (state.groups.some((g) => g.name === trimmed)) return null;

      const id = generateId();
      const now = Date.now();

      set((draft) => {
        draft.groups.push({
          id,
          name: trimmed,
          stocks: [],
          createdAt: now,
          updatedAt: now,
        });
      });

      return id;
    },

    deleteGroup: (id) => {
      // Cannot delete the default group
      if (id === DEFAULT_GROUP_ID) return;

      set((draft) => {
        draft.groups = draft.groups.filter((g) => g.id !== id);
        // If active group was deleted, switch to default
        if (draft.activeGroupId === id) {
          draft.activeGroupId = DEFAULT_GROUP_ID;
        }
      });
    },

    renameGroup: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      set((draft) => {
        const group = draft.groups.find((g) => g.id === id);
        if (!group) return;

        // Prevent duplicate names
        if (draft.groups.some((g) => g.id !== id && g.name === trimmed)) return;

        group.name = trimmed;
        group.updatedAt = Date.now();
      });
    },

    // -------------------------------------------------------------------------
    // Stock Management
    // -------------------------------------------------------------------------

    addStock: (groupId, stock) =>
      set((draft) => {
        const group = draft.groups.find((g) => g.id === groupId);
        if (!group) return;
        if (group.stocks.length >= MAX_STOCKS_PER_GROUP) return;

        // Prevent duplicates within the same group
        if (group.stocks.some((s) => s.symbol === stock.symbol)) return;

        group.stocks.push({
          ...stock,
          addedAt: Date.now(),
        });
        group.updatedAt = Date.now();
      }),

    removeStock: (groupId, symbol) =>
      set((draft) => {
        const group = draft.groups.find((g) => g.id === groupId);
        if (!group) return;

        group.stocks = group.stocks.filter((s) => s.symbol !== symbol);
        group.updatedAt = Date.now();
      }),

    moveStock: (fromGroupId, toGroupId, symbol) => {
      if (fromGroupId === toGroupId) return;

      set((draft) => {
        const fromGroup = draft.groups.find((g) => g.id === fromGroupId);
        const toGroup = draft.groups.find((g) => g.id === toGroupId);
        if (!fromGroup || !toGroup) return;
        if (toGroup.stocks.length >= MAX_STOCKS_PER_GROUP) return;

        const stockIdx = fromGroup.stocks.findIndex((s) => s.symbol === symbol);
        if (stockIdx === -1) return;

        // Prevent duplicates in target group
        if (toGroup.stocks.some((s) => s.symbol === symbol)) return;

        const [stock] = fromGroup.stocks.splice(stockIdx, 1);
        if (stock) {
          toGroup.stocks.push(stock);
          fromGroup.updatedAt = Date.now();
          toGroup.updatedAt = Date.now();
        }
      });
    },

    reorderStocks: (groupId, symbolOrder) =>
      set((draft) => {
        const group = draft.groups.find((g) => g.id === groupId);
        if (!group) return;

        const stockMap = new Map(group.stocks.map((s) => [s.symbol, s]));
        const reordered: WatchlistStock[] = [];

        for (const sym of symbolOrder) {
          const stock = stockMap.get(sym);
          if (stock) {
            reordered.push(stock);
            stockMap.delete(sym);
          }
        }

        // Append any stocks not in the order list (safety net)
        stockMap.forEach((stock) => {
          reordered.push(stock);
        });

        group.stocks = reordered;
        group.updatedAt = Date.now();
      }),

    updateStockNote: (groupId, symbol, notes) =>
      set((draft) => {
        const group = draft.groups.find((g) => g.id === groupId);
        if (!group) return;

        const stock = group.stocks.find((s) => s.symbol === symbol);
        if (!stock) return;

        stock.notes = notes;
        group.updatedAt = Date.now();
      }),

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    isInWatchlist: (symbol, groupId) => {
      const { groups } = get();
      if (groupId) {
        const group = groups.find((g) => g.id === groupId);
        return group?.stocks.some((s) => s.symbol === symbol) ?? false;
      }
      return groups.some((g) => g.stocks.some((s) => s.symbol === symbol));
    },

    getGroupById: (id) => {
      return get().groups.find((g) => g.id === id);
    },

    getStockGroups: (symbol) => {
      return get().groups.filter((g) => g.stocks.some((s) => s.symbol === symbol));
    },

    // -------------------------------------------------------------------------
    // Import / Export
    // -------------------------------------------------------------------------

    exportGroup: (groupId) => {
      const group = get().groups.find((g) => g.id === groupId);
      if (!group) return null;

      const exportData = {
        version: 1,
        name: group.name,
        exportedAt: Date.now(),
        stocks: group.stocks.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          notes: s.notes,
        })),
      };

      return JSON.stringify(exportData, null, 2);
    },

    importGroup: (json) => {
      try {
        const data: unknown = JSON.parse(json);
        if (
          typeof data !== 'object' ||
          data === null ||
          !('stocks' in data) ||
          !Array.isArray((data as { stocks: unknown }).stocks) ||
          !('name' in data) ||
          typeof (data as { name: unknown }).name !== 'string'
        ) {
          return false;
        }

        const parsed = data as {
          name: string;
          stocks: Array<{ symbol: string; name: string; sector?: string; notes?: string }>;
        };

        const state = get();
        if (state.groups.length >= MAX_GROUPS) return false;

        // Ensure unique name
        let importName = parsed.name;
        let counter = 1;
        while (state.groups.some((g) => g.name === importName)) {
          importName = `${parsed.name} (${counter})`;
          counter++;
        }

        const now = Date.now();
        const id = generateId();

        set((draft) => {
          draft.groups.push({
            id,
            name: importName,
            stocks: parsed.stocks.slice(0, MAX_STOCKS_PER_GROUP).map((s) => ({
              symbol: s.symbol,
              name: s.name,
              sector: s.sector,
              notes: s.notes,
              addedAt: now,
            })),
            createdAt: now,
            updatedAt: now,
          });
        });

        return true;
      } catch {
        return false;
      }
    },

    importStocksToGroup: (groupId, stocks) => {
      const group = get().groups.find((g) => g.id === groupId);
      if (!group) return 0;

      const existingSymbols = new Set(group.stocks.map((s) => s.symbol));
      const capacity = MAX_STOCKS_PER_GROUP - group.stocks.length;
      const newStocks = stocks
        .filter((s) => !existingSymbols.has(s.symbol))
        .slice(0, capacity);

      if (newStocks.length === 0) return 0;

      const now = Date.now();
      set((draft) => {
        const g = draft.groups.find((g) => g.id === groupId);
        if (!g) return;

        for (const s of newStocks) {
          g.stocks.push({
            symbol: s.symbol,
            name: s.name,
            sector: s.sector,
            addedAt: now,
          });
        }
        g.updatedAt = now;
      });

      return newStocks.length;
    },

    // -------------------------------------------------------------------------
    // Panel
    // -------------------------------------------------------------------------

    setActiveGroupId: (id) =>
      set((draft) => {
        draft.activeGroupId = id;
      }),

    setPanelOpen: (open) =>
      set((draft) => {
        draft.isPanelOpen = open;
      }),

    togglePanel: () =>
      set((draft) => {
        draft.isPanelOpen = !draft.isPanelOpen;
      }),

    // -------------------------------------------------------------------------
    // Reset
    // -------------------------------------------------------------------------

    reset: () =>
      set((draft) => {
        Object.assign(draft, INITIAL_STATE);
        // Re-create default group with fresh timestamp
        draft.groups = [createDefaultGroup()];
      }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      groups: state.groups,
      activeGroupId: state.activeGroupId,
      // isPanelOpen is transient — always starts closed
    }) as typeof state,
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectGroups = (state: WatchlistStore) => state.groups;
export const selectActiveGroupId = (state: WatchlistStore) => state.activeGroupId;
export const selectIsPanelOpen = (state: WatchlistStore) => state.isPanelOpen;
export const selectActiveGroup = (state: WatchlistStore) =>
  state.groups.find((g) => g.id === state.activeGroupId);
export const selectTotalStockCount = (state: WatchlistStore) =>
  state.groups.reduce((sum, g) => sum + g.stocks.length, 0);
export const selectGroupCount = (state: WatchlistStore) => state.groups.length;
