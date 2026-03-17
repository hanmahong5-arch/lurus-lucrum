/**
 * Watchlist Management Hook
 *
 * Manages user's favorite stocks with MMKV persistence.
 * Supports add, remove, reorder, and check operations.
 */

import { useState, useEffect, useCallback } from "react";
import { cache } from "@/lib/storage/mmkv";

const STORAGE_KEY = "gushen_watchlist";
const MAX_WATCHLIST_SIZE = 50;

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: number;
  sortOrder: number;
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from MMKV on mount
  useEffect(() => {
    const stored = cache.getObject<WatchlistItem[]>(STORAGE_KEY);
    if (stored) {
      setItems(stored);
    }
    setLoading(false);
  }, []);

  // Persist to MMKV on change
  const persist = useCallback((newItems: WatchlistItem[]) => {
    setItems(newItems);
    cache.setObject(STORAGE_KEY, newItems);
  }, []);

  const addStock = useCallback(
    (symbol: string, name: string) => {
      setItems((prev) => {
        if (prev.some((item) => item.symbol === symbol)) return prev;
        if (prev.length >= MAX_WATCHLIST_SIZE) return prev;

        const newItems = [
          ...prev,
          {
            symbol,
            name,
            addedAt: Date.now(),
            sortOrder: prev.length,
          },
        ];
        cache.setObject(STORAGE_KEY, newItems);
        return newItems;
      });
    },
    [],
  );

  const removeStock = useCallback(
    (symbol: string) => {
      setItems((prev) => {
        const newItems = prev
          .filter((item) => item.symbol !== symbol)
          .map((item, i) => ({ ...item, sortOrder: i }));
        cache.setObject(STORAGE_KEY, newItems);
        return newItems;
      });
    },
    [],
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setItems((prev) => {
        const newItems = [...prev];
        const [moved] = newItems.splice(fromIndex, 1);
        if (!moved) return prev;
        newItems.splice(toIndex, 0, moved);
        const reordered = newItems.map((item, i) => ({ ...item, sortOrder: i }));
        cache.setObject(STORAGE_KEY, reordered);
        return reordered;
      });
    },
    [],
  );

  const isInWatchlist = useCallback(
    (symbol: string) => items.some((item) => item.symbol === symbol),
    [items],
  );

  const toggleWatchlist = useCallback(
    (symbol: string, name: string) => {
      if (isInWatchlist(symbol)) {
        removeStock(symbol);
      } else {
        addStock(symbol, name);
      }
    },
    [isInWatchlist, addStock, removeStock],
  );

  const symbols = items.map((item) => item.symbol);

  return {
    items,
    symbols,
    loading,
    count: items.length,
    maxSize: MAX_WATCHLIST_SIZE,
    addStock,
    removeStock,
    reorder,
    isInWatchlist,
    toggleWatchlist,
    clear: () => persist([]),
  };
}
