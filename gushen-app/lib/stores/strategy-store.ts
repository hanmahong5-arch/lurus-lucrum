/**
 * Strategy Store (Zustand + MMKV)
 *
 * Manages saved strategies with persistence.
 * Adapted from gushen-web use-saved-strategies.ts.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "@/lib/storage/mmkv";

export interface SavedStrategy {
  id: string;
  name: string;
  description: string;
  prompt: string;
  generatedCode: string;
  parameters: Record<string, number>;
  isFavorite: boolean;
  tags: string[];
  score?: string;
  lastBacktest?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface StrategyState {
  strategies: SavedStrategy[];

  saveStrategy: (strategy: Omit<SavedStrategy, "id" | "createdAt" | "updatedAt">) => string;
  updateStrategy: (id: string, updates: Partial<SavedStrategy>) => void;
  deleteStrategy: (id: string) => void;
  getStrategy: (id: string) => SavedStrategy | undefined;
  toggleFavorite: (id: string) => void;
  addBacktestResult: (id: string, result: NonNullable<SavedStrategy["lastBacktest"]>) => void;
  searchStrategies: (query: string) => SavedStrategy[];
}

function generateId(): string {
  return `strategy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useStrategyStore = create<StrategyState>()(
  persist(
    (set, get) => ({
      strategies: [],

      saveStrategy: (input) => {
        const id = generateId();
        const now = Date.now();
        const strategy: SavedStrategy = {
          ...input,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          strategies: [strategy, ...state.strategies],
        }));

        return id;
      },

      updateStrategy: (id, updates) => {
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
          ),
        }));
      },

      deleteStrategy: (id) => {
        set((state) => ({
          strategies: state.strategies.filter((s) => s.id !== id),
        }));
      },

      getStrategy: (id) => {
        return get().strategies.find((s) => s.id === id);
      },

      toggleFavorite: (id) => {
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, isFavorite: !s.isFavorite, updatedAt: Date.now() } : s,
          ),
        }));
      },

      addBacktestResult: (id, result) => {
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, lastBacktest: result, updatedAt: Date.now() } : s,
          ),
        }));
      },

      searchStrategies: (query) => {
        const q = query.toLowerCase();
        return get().strategies.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)),
        );
      },
    }),
    {
      name: "gushen-strategies",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        strategies: state.strategies,
      }),
    },
  ),
);
