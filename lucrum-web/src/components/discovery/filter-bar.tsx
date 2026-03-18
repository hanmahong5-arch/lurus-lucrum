/**
 * Filter Bar Component
 *
 * Top toolbar for filtering, sorting, and searching discovery strategies.
 * Includes type filter (Select), sort mode (Select), and search input with debounce.
 *
 * Story 3.2: Discovery Page & Filter
 *
 * @module components/discovery/filter-bar
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoveryFilters } from "@/hooks/use-discovery-strategies";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Search debounce delay in milliseconds */
const SEARCH_DEBOUNCE_MS = 300;

/** Strategy type filter options */
const TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "trend", label: "趋势跟踪" },
  { value: "mean-revert", label: "均值回归" },
  { value: "momentum", label: "动量" },
  { value: "composite", label: "复合" },
] as const;

/** Sort mode options */
const SORT_OPTIONS = [
  { value: "popularity", label: "热度" },
  { value: "latest", label: "最新" },
  { value: "stars", label: "Stars" },
] as const;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface FilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  totalCount: number;
  className?: string;
}

export function FilterBar({
  filters,
  onFiltersChange,
  totalCount,
  className,
}: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
      }, SEARCH_DEBOUNCE_MS);
    },
    [filters, onFiltersChange]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sync external filter changes to local search input
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, type: e.target.value });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, sort: e.target.value });
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-3",
        "py-3 px-1",
        className
      )}
      data-testid="filter-bar"
      role="toolbar"
      aria-label="策略筛选工具栏"
    >
      {/* Type filter */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-neutral-500 hidden sm:block" aria-hidden="true" />
        <select
          value={filters.type}
          onChange={handleTypeChange}
          className="bg-surface border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="filter-type-select"
          aria-label="策略类型筛选"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort selector */}
      <select
        value={filters.sort}
        onChange={handleSortChange}
        className="bg-surface border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="filter-sort-select"
        aria-label="排序方式"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="搜索策略名称或描述..."
          className="w-full bg-surface border border-neutral-700 rounded-md pl-9 pr-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="filter-search-input"
          aria-label="关键词搜索"
        />
      </div>

      {/* Result count */}
      <span
        className="text-xs text-neutral-500 whitespace-nowrap tabular-nums"
        data-testid="filter-total-count"
        aria-live="polite"
      >
        {totalCount} 个策略
      </span>
    </div>
  );
}