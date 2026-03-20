/**
 * Market Data Store
 *
 * Persists market-related user preferences and cached data:
 * - Stock favorites / watchlist
 * - Recent search history
 * - Sector cache with timestamps
 * - Last fetched timestamps for staleness checks
 *
 * Uses shorter TTL since market data changes frequently.
 * Data older than STALE_THRESHOLD_MS is considered stale.
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:market-data`
 *
 * @module lib/stores/market-data-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export interface FavoriteStock {
  /** Stock symbol code (e.g., "600519") */
  symbol: string;
  /** Stock display name */
  name: string;
  /** Sector / industry */
  sector?: string;
  /** When this stock was added to favorites (ms) */
  addedAt: number;
}

export interface RecentSearch {
  /** Search query or symbol */
  query: string;
  /** Resolved symbol (if search matched a stock) */
  symbol?: string;
  /** Resolved stock name */
  name?: string;
  /** Timestamp of the search (ms) */
  searchedAt: number;
}

export interface SectorCacheEntry {
  /** Sector name */
  name: string;
  /** Stock symbols in this sector */
  symbols: string[];
  /** When this data was fetched (ms) */
  fetchedAt: number;
}

export interface MarketDataState {
  /** User's favorite/watchlist stocks */
  favorites: FavoriteStock[];
  /** Recent search history */
  recentSearches: RecentSearch[];
  /** Cached sector data */
  sectorCache: Record<string, SectorCacheEntry>;
  /** Last fetch timestamps by data category */
  lastFetchedAt: Record<string, number>;

  // Transient state (not persisted)
  /** Whether market data is being fetched */
  isFetching: boolean;
  /** Fetch error */
  error: string | null;
}

interface MarketDataActions {
  // Favorites
  addFavorite: (stock: Omit<FavoriteStock, 'addedAt'>) => void;
  removeFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
  reorderFavorites: (favorites: FavoriteStock[]) => void;

  // Recent searches
  addRecentSearch: (search: Omit<RecentSearch, 'searchedAt'>) => void;
  clearRecentSearches: () => void;

  // Sector cache
  setSectorCache: (sectorName: string, symbols: string[]) => void;
  getSectorCache: (sectorName: string) => SectorCacheEntry | null;
  isSectorStale: (sectorName: string) => boolean;
  clearSectorCache: () => void;

  // Fetch tracking
  markFetched: (category: string) => void;
  isDataStale: (category: string) => boolean;

  // Transient
  setFetching: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type MarketDataStore = MarketDataState & MarketDataActions & HydrationState;

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of recent searches to retain */
const MAX_RECENT_SEARCHES = 20;

/** Maximum number of favorites */
const MAX_FAVORITES = 100;

/** Data considered stale after 5 minutes */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Sector cache stale after 1 hour */
const SECTOR_STALE_THRESHOLD_MS = 60 * 60 * 1000;

// =============================================================================
// Initial State
// =============================================================================

const INITIAL_STATE: MarketDataState = {
  favorites: [],
  recentSearches: [],
  sectorCache: {},
  lastFetchedAt: {},
  isFetching: false,
  error: null,
};

// =============================================================================
// Store
// =============================================================================

export const useMarketDataStore = createPersistedStore<MarketDataStore>(
  'market-data',
  (set, get) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    // -------------------------------------------------------------------------
    // Favorites
    // -------------------------------------------------------------------------

    addFavorite: (stock) =>
      set((state) => {
        // Prevent duplicates
        if (state.favorites.some((f) => f.symbol === stock.symbol)) return;

        state.favorites.push({
          ...stock,
          addedAt: Date.now(),
        });

        // Cap favorites list
        if (state.favorites.length > MAX_FAVORITES) {
          state.favorites = state.favorites.slice(0, MAX_FAVORITES);
        }
      }),

    removeFavorite: (symbol) =>
      set((state) => {
        state.favorites = state.favorites.filter((f) => f.symbol !== symbol);
      }),

    isFavorite: (symbol) => {
      return get().favorites.some((f) => f.symbol === symbol);
    },

    reorderFavorites: (favorites) =>
      set((state) => {
        state.favorites = favorites;
      }),

    // -------------------------------------------------------------------------
    // Recent Searches
    // -------------------------------------------------------------------------

    addRecentSearch: (search) =>
      set((state) => {
        // Remove existing entry with same query to move it to top
        state.recentSearches = state.recentSearches.filter(
          (s) => s.query !== search.query
        );

        state.recentSearches.unshift({
          ...search,
          searchedAt: Date.now(),
        });

        // Cap search history
        if (state.recentSearches.length > MAX_RECENT_SEARCHES) {
          state.recentSearches = state.recentSearches.slice(0, MAX_RECENT_SEARCHES);
        }
      }),

    clearRecentSearches: () =>
      set((state) => {
        state.recentSearches = [];
      }),

    // -------------------------------------------------------------------------
    // Sector Cache
    // -------------------------------------------------------------------------

    setSectorCache: (sectorName, symbols) =>
      set((state) => {
        state.sectorCache[sectorName] = {
          name: sectorName,
          symbols,
          fetchedAt: Date.now(),
        };
      }),

    getSectorCache: (sectorName) => {
      const entry = get().sectorCache[sectorName];
      if (!entry) return null;
      return entry;
    },

    isSectorStale: (sectorName) => {
      const entry = get().sectorCache[sectorName];
      if (!entry) return true;
      return Date.now() - entry.fetchedAt > SECTOR_STALE_THRESHOLD_MS;
    },

    clearSectorCache: () =>
      set((state) => {
        state.sectorCache = {};
      }),

    // -------------------------------------------------------------------------
    // Fetch Tracking
    // -------------------------------------------------------------------------

    markFetched: (category) =>
      set((state) => {
        state.lastFetchedAt[category] = Date.now();
      }),

    isDataStale: (category) => {
      const lastFetched = get().lastFetchedAt[category];
      if (!lastFetched) return true;
      return Date.now() - lastFetched > STALE_THRESHOLD_MS;
    },

    // -------------------------------------------------------------------------
    // Transient
    // -------------------------------------------------------------------------

    setFetching: (fetching) =>
      set((state) => {
        state.isFetching = fetching;
        if (fetching) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isFetching = false;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      favorites: state.favorites,
      recentSearches: state.recentSearches,
      sectorCache: state.sectorCache,
      lastFetchedAt: state.lastFetchedAt,
    }) as typeof state,
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectFavorites = (state: MarketDataStore) => state.favorites;
export const selectRecentSearches = (state: MarketDataStore) => state.recentSearches;
export const selectSectorCache = (state: MarketDataStore) => state.sectorCache;
export const selectIsFetching = (state: MarketDataStore) => state.isFetching;
export const selectMarketError = (state: MarketDataStore) => state.error;
export const selectFavoriteCount = (state: MarketDataStore) => state.favorites.length;

export const selectIsFavorite = (symbol: string) => (state: MarketDataStore) =>
  state.favorites.some((f) => f.symbol === symbol);
