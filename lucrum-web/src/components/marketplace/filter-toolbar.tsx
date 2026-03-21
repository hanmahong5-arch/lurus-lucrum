"use client";

/**
 * FilterToolbar - Marketplace filtering and sorting controls.
 *
 * Includes:
 * - Quick sort tabs: Recommended / Newest / Popular / Free / My Subscriptions
 * - Search input
 * - Advanced filter dropdown (Grade, Price range, Category, Min win rate, Min Sharpe)
 */

import { useState, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  TrendingUp,
  Clock,
  Flame,
  Gift,
  Bookmark,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type SortOption = "recommended" | "newest" | "popular" | "free" | "subscribed";

export interface FilterState {
  grades: string[];
  minPrice: number | null;
  maxPrice: number | null;
  category: string;
  minWinRate: number | null;
  minSharpe: number | null;
}

const EMPTY_FILTER: FilterState = {
  grades: [],
  minPrice: null,
  maxPrice: null,
  category: "",
  minWinRate: null,
  minSharpe: null,
};

interface FilterToolbarProps {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

// =============================================================================
// SORT TABS CONFIG
// =============================================================================

const SORT_TABS: { value: SortOption; label: string; icon: typeof TrendingUp }[] = [
  { value: "recommended", label: "推荐", icon: TrendingUp },
  { value: "newest", label: "最新", icon: Clock },
  { value: "popular", label: "热门", icon: Flame },
  { value: "free", label: "免费", icon: Gift },
  { value: "subscribed", label: "我的订阅", icon: Bookmark },
];

const ALL_GRADES = ["S", "A", "B", "C", "D"];

// =============================================================================
// COMPONENT
// =============================================================================

export function FilterToolbar({
  sort,
  onSortChange,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
}: FilterToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    filter.grades.length > 0 ||
    filter.minPrice != null ||
    filter.maxPrice != null ||
    filter.category !== "" ||
    filter.minWinRate != null ||
    filter.minSharpe != null;

  const clearFilters = useCallback(() => {
    onFilterChange(EMPTY_FILTER);
  }, [onFilterChange]);

  const toggleGrade = useCallback(
    (grade: string) => {
      const next = filter.grades.includes(grade)
        ? filter.grades.filter((g) => g !== grade)
        : [...filter.grades, grade];
      onFilterChange({ ...filter, grades: next });
    },
    [filter, onFilterChange],
  );

  return (
    <div className="space-y-3">
      {/* Top row: Sort tabs + Search + Filter toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Sort tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
          {SORT_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onSortChange(value)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition whitespace-nowrap",
                sort === value
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-white/50 hover:text-white",
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="搜索策略..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition shrink-0",
            showFilters || hasActiveFilters
              ? "bg-accent/10 text-accent border-accent/20"
              : "text-white/50 hover:text-white border-white/10 hover:border-white/20",
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          筛选器
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Filter panel (expandable) */}
      {showFilters && (
        <div className="bg-surface/80 rounded-lg border border-border p-4 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-white/60">高级筛选</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white transition"
              >
                <X className="w-3 h-3" />
                清除筛选
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Grade filter */}
            <div>
              <label className="text-[11px] text-white/40 block mb-1.5">
                评级
              </label>
              <div className="flex items-center gap-1.5">
                {ALL_GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGrade(g)}
                    className={cn(
                      "w-7 h-7 rounded text-xs font-bold border transition",
                      filter.grades.includes(g)
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "text-white/40 border-white/10 hover:border-white/30",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Min win rate */}
            <div>
              <label className="text-[11px] text-white/40 block mb-1.5">
                最低胜率
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="例: 50"
                value={filter.minWinRate ?? ""}
                onChange={(e) =>
                  onFilterChange({
                    ...filter,
                    minWinRate: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
              />
            </div>

            {/* Min Sharpe */}
            <div>
              <label className="text-[11px] text-white/40 block mb-1.5">
                最低 Sharpe
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                placeholder="例: 1.0"
                value={filter.minSharpe ?? ""}
                onChange={(e) =>
                  onFilterChange({
                    ...filter,
                    minSharpe: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
              />
            </div>

            {/* Price range */}
            <div>
              <label className="text-[11px] text-white/40 block mb-1.5">
                价格范围 (LB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="最低"
                  value={filter.minPrice ?? ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      minPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
                />
                <span className="text-white/30 text-xs">-</span>
                <input
                  type="number"
                  min={0}
                  placeholder="最高"
                  value={filter.maxPrice ?? ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      maxPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] text-white/40 block mb-1.5">
                分类
              </label>
              <select
                value={filter.category}
                onChange={(e) =>
                  onFilterChange({ ...filter, category: e.target.value })
                }
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-accent/50 transition"
              >
                <option value="">全部分类</option>
                <option value="trend">趋势跟踪</option>
                <option value="mean_reversion">均值回归</option>
                <option value="momentum">动量策略</option>
                <option value="multi_factor">多因子</option>
                <option value="arbitrage">套利策略</option>
                <option value="ml">机器学习</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTER };
export type { FilterState as MarketplaceFilterState };
