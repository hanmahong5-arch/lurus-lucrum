/**
 * User Saved Strategies Hook
 * 用户保存策略钩子
 *
 * Provides functionality to save, load, update, and delete user strategies.
 * Uses localStorage for persistence (Phase 7).
 *
 * @module hooks/use-saved-strategies
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Backtest result summary for storage
 * 回测结果摘要（用于存储）
 */
export interface BacktestSummary {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  timestamp: number;
}

/**
 * User saved strategy structure
 * 用户保存的策略结构
 */
export interface SavedStrategy {
  id: string;
  name: string;
  description?: string;

  // Source information
  sourceType: "ai-generated" | "template" | "custom";
  sourceTemplateId?: string;
  sourceTemplateName?: string;

  // Strategy content
  prompt: string;
  generatedCode: string;

  // Parameters
  parameters?: Record<string, unknown>;

  // Backtest history (last 5 runs)
  backtestHistory: BacktestSummary[];

  // Metadata
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  tags: string[];
}

/**
 * Hook return type
 */
export interface UseSavedStrategiesReturn {
  strategies: SavedStrategy[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  saveStrategy: (
    strategy: Omit<
      SavedStrategy,
      "id" | "createdAt" | "updatedAt" | "backtestHistory"
    >,
  ) => SavedStrategy;
  updateStrategy: (id: string, updates: Partial<SavedStrategy>) => boolean;
  deleteStrategy: (id: string) => boolean;
  getStrategy: (id: string) => SavedStrategy | undefined;

  // Backtest history
  addBacktestResult: (strategyId: string, result: BacktestSummary) => boolean;

  // Favorites
  toggleFavorite: (id: string) => boolean;
  getFavorites: () => SavedStrategy[];

  // Search and filter
  searchStrategies: (query: string) => SavedStrategy[];
  getStrategiesByTag: (tag: string) => SavedStrategy[];

  // Export/Import
  exportStrategies: () => string;
  importStrategies: (jsonData: string) => { success: number; failed: number };

  // Utility
  clearAll: () => void;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const STORAGE_KEY = "lucrum_saved_strategies";
const MAX_BACKTEST_HISTORY = 5;

// =============================================================================
// HOOK IMPLEMENTATION / 钩子实现
// =============================================================================

export function useSavedStrategies(): UseSavedStrategiesReturn {
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load strategies from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setStrategies(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load saved strategies:", err);
      setError("加载保存的策略失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Persist to localStorage whenever strategies change
  const persistStrategies = useCallback((newStrategies: SavedStrategy[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newStrategies));
      setStrategies(newStrategies);
      setError(null);
    } catch (err) {
      console.error("Failed to save strategies:", err);
      setError("保存策略失败，可能是存储空间不足");
    }
  }, []);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `strategy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Save a new strategy
  const saveStrategy = useCallback(
    (
      strategy: Omit<
        SavedStrategy,
        "id" | "createdAt" | "updatedAt" | "backtestHistory"
      >,
    ): SavedStrategy => {
      const now = Date.now();
      const newStrategy: SavedStrategy = {
        ...strategy,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        backtestHistory: [],
      };

      persistStrategies([...strategies, newStrategy]);
      return newStrategy;
    },
    [strategies, generateId, persistStrategies],
  );

  // Update an existing strategy
  const updateStrategy = useCallback(
    (id: string, updates: Partial<SavedStrategy>): boolean => {
      const index = strategies.findIndex((s) => s.id === id);
      if (index === -1) return false;

      const existing = strategies[index];
      if (!existing) return false;

      const updated = [...strategies];
      updated[index] = {
        id: existing.id,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        sourceType: updates.sourceType ?? existing.sourceType,
        sourceTemplateId: updates.sourceTemplateId ?? existing.sourceTemplateId,
        sourceTemplateName:
          updates.sourceTemplateName ?? existing.sourceTemplateName,
        prompt: updates.prompt ?? existing.prompt,
        generatedCode: updates.generatedCode ?? existing.generatedCode,
        parameters: updates.parameters ?? existing.parameters,
        backtestHistory: updates.backtestHistory ?? existing.backtestHistory,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        isFavorite: updates.isFavorite ?? existing.isFavorite,
        tags: updates.tags ?? existing.tags,
      };

      persistStrategies(updated);
      return true;
    },
    [strategies, persistStrategies],
  );

  // Delete a strategy
  const deleteStrategy = useCallback(
    (id: string): boolean => {
      const filtered = strategies.filter((s) => s.id !== id);
      if (filtered.length === strategies.length) return false;

      persistStrategies(filtered);
      return true;
    },
    [strategies, persistStrategies],
  );

  // Get a single strategy by ID
  const getStrategy = useCallback(
    (id: string): SavedStrategy | undefined => {
      return strategies.find((s) => s.id === id);
    },
    [strategies],
  );

  // Add backtest result to a strategy
  const addBacktestResult = useCallback(
    (strategyId: string, result: BacktestSummary): boolean => {
      const index = strategies.findIndex((s) => s.id === strategyId);
      if (index === -1) return false;

      const existing = strategies[index];
      if (!existing) return false;

      const updated = [...strategies];
      const history = [...existing.backtestHistory, result];

      // Keep only the last N results
      if (history.length > MAX_BACKTEST_HISTORY) {
        history.splice(0, history.length - MAX_BACKTEST_HISTORY);
      }

      updated[index] = {
        ...existing,
        backtestHistory: history,
        updatedAt: Date.now(),
      };

      persistStrategies(updated);
      return true;
    },
    [strategies, persistStrategies],
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    (id: string): boolean => {
      const index = strategies.findIndex((s) => s.id === id);
      if (index === -1) return false;

      const existing = strategies[index];
      if (!existing) return false;

      const updated = [...strategies];
      updated[index] = {
        ...existing,
        isFavorite: !existing.isFavorite,
        updatedAt: Date.now(),
      };

      persistStrategies(updated);
      return true;
    },
    [strategies, persistStrategies],
  );

  // Get all favorites
  const getFavorites = useCallback((): SavedStrategy[] => {
    return strategies.filter((s) => s.isFavorite);
  }, [strategies]);

  // Search strategies by query
  const searchStrategies = useCallback(
    (query: string): SavedStrategy[] => {
      const lowerQuery = query.toLowerCase();
      return strategies.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.description?.toLowerCase().includes(lowerQuery) ||
          s.prompt.toLowerCase().includes(lowerQuery) ||
          s.tags.some((t) => t.toLowerCase().includes(lowerQuery)),
      );
    },
    [strategies],
  );

  // Get strategies by tag
  const getStrategiesByTag = useCallback(
    (tag: string): SavedStrategy[] => {
      const lowerTag = tag.toLowerCase();
      return strategies.filter((s) =>
        s.tags.some((t) => t.toLowerCase() === lowerTag),
      );
    },
    [strategies],
  );

  // Export all strategies as JSON
  const exportStrategies = useCallback((): string => {
    return JSON.stringify(strategies, null, 2);
  }, [strategies]);

  // Import strategies from JSON
  const importStrategies = useCallback(
    (jsonData: string): { success: number; failed: number } => {
      let success = 0;
      let failed = 0;

      try {
        const imported = JSON.parse(jsonData);
        if (!Array.isArray(imported)) {
          return { success: 0, failed: 1 };
        }

        const newStrategies: SavedStrategy[] = [];
        const existingIds = new Set(strategies.map((s) => s.id));

        for (const item of imported) {
          try {
            // Validate required fields
            if (!item.name || !item.prompt || !item.generatedCode) {
              failed++;
              continue;
            }

            // Generate new ID if exists
            const id = existingIds.has(item.id) ? generateId() : item.id;
            existingIds.add(id);

            newStrategies.push({
              ...item,
              id,
              createdAt: item.createdAt || Date.now(),
              updatedAt: Date.now(),
              backtestHistory: item.backtestHistory || [],
              isFavorite: item.isFavorite || false,
              tags: item.tags || [],
            });
            success++;
          } catch {
            failed++;
          }
        }

        if (newStrategies.length > 0) {
          persistStrategies([...strategies, ...newStrategies]);
        }
      } catch {
        failed++;
      }

      return { success, failed };
    },
    [strategies, generateId, persistStrategies],
  );

  // Clear all strategies
  const clearAll = useCallback(() => {
    persistStrategies([]);
  }, [persistStrategies]);

  return {
    strategies,
    loading,
    error,
    saveStrategy,
    updateStrategy,
    deleteStrategy,
    getStrategy,
    addBacktestResult,
    toggleFavorite,
    getFavorites,
    searchStrategies,
    getStrategiesByTag,
    exportStrategies,
    importStrategies,
    clearAll,
  };
}

export default useSavedStrategies;
