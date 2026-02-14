/**
 * Discovery Page Content Component
 *
 * Main client component for the strategy discovery page.
 * Orchestrates FilterBar, card grid, skeleton loading, stale data banner,
 * the graceful degradation chain, and the strategy detail panel.
 *
 * Story 3.2: Discovery Page & Filter
 * Story 3.3: Strategy Detail Panel & Quick Preview
 *
 * @module components/discovery/discovery-page-content
 */

"use client";

import React, { useState, useCallback } from "react";
import { Compass, RefreshCw, Database } from "lucide-react";
import {
  useDiscoveryStrategies,
  DEFAULT_FILTERS,
  type DiscoveryFilters,
  type DiscoveryStrategy,
} from "@/hooks/use-discovery-strategies";
import { useStrategyDetail } from "@/hooks/use-strategy-detail";
import { StrategyDiscoveryCard } from "./strategy-discovery-card";
import { FilterBar } from "./filter-bar";
import { StaleDataBanner } from "./stale-data-banner";
import { DiscoverySkeleton } from "./discovery-skeleton";
import { StrategyDetailPanel } from "./strategy-detail-panel";
import { EmptyState } from "@/components/feedback/empty-state";
import { useOnboardingImport } from "@/hooks/use-onboarding-import";
import { cn } from "@/lib/utils";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface DiscoveryPageContentProps {
  className?: string;
}

export function DiscoveryPageContent({ className }: DiscoveryPageContentProps) {
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [selectedStrategy, setSelectedStrategy] = useState<DiscoveryStrategy | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Strategy import actions (Story 3.4)
  const { importToEditor: doImportToEditor, importToWorkflow: doImportToWorkflow } = useOnboardingImport();

  const {
    strategies,
    isLoading,
    error,
    dataSource,
    totalCount,
    dataTimestamp,
    isStale,
    refetch,
    showCached,
  } = useDiscoveryStrategies(filters);

  // Fetch detail data when a strategy is selected
  const { detail, isLoading: isDetailLoading } = useStrategyDetail(
    isPanelOpen ? selectedStrategy : null
  );

  const handleSelectStrategy = useCallback((strategy: DiscoveryStrategy) => {
    setSelectedStrategy(strategy);
    setIsPanelOpen(true);
  }, []);

  const handlePanelOpenChange = useCallback((open: boolean) => {
    setIsPanelOpen(open);
    if (!open) {
      setSelectedStrategy(null);
    }
  }, []);

  const handleImportToEditor = useCallback((strategy: unknown) => {
    const s = strategy as { veighnaCode?: string | null; originalCode?: string | null; description?: string; name?: string };
    const code = s.veighnaCode ?? s.originalCode ?? "";
    const description = s.description ?? s.name ?? "";
    doImportToEditor(code, description);
  }, [doImportToEditor]);

  const handleImportToWorkflow = useCallback((strategy: unknown) => {
    const s = strategy as { veighnaCode?: string | null; originalCode?: string | null; description?: string; name?: string };
    const code = s.veighnaCode ?? s.originalCode ?? "";
    const description = s.description ?? s.name ?? "";
    doImportToWorkflow(code, description);
  }, [doImportToWorkflow]);

  const handleFiltersChange = useCallback((newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className={cn("space-y-4", className)} data-testid="discovery-page-content">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
            策略发现
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            浏览社区热门策略，发现优质交易思路
          </p>
        </div>
        {dataSource === "builtin" && (
          <span className="text-xs text-neutral-600 flex items-center gap-1">
            <Database className="h-3 w-3" aria-hidden="true" />
            内置模板
          </span>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={totalCount}
      />

      {/* Stale data banner */}
      {isStale && dataTimestamp && (
        <StaleDataBanner timestamp={dataTimestamp} onRefresh={refetch} />
      )}

      {/* Error banner with fallback actions */}
      {error && dataSource !== "api" && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400"
          data-testid="discovery-error-banner"
          role="alert"
        >
          <span className="text-sm">无法加载最新策略: {error}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={showCached}
              className="text-xs font-medium hover:text-red-300 transition-colors btn-tactile"
              data-testid="show-cached-button"
            >
              显示缓存
            </button>
            <button
              type="button"
              onClick={refetch}
              className="inline-flex items-center gap-1 text-xs font-medium hover:text-red-300 transition-colors btn-tactile"
              data-testid="retry-button"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              重试
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <DiscoverySkeleton />}

      {/* Empty state */}
      {!isLoading && strategies.length === 0 && (
        <EmptyState
          icon={Compass}
          title="暂时没有发现策略"
          description="尝试调整筛选条件，或稍后再来查看"
          actions={[
            { label: "刷新", onClick: refetch, variant: "primary" },
          ]}
        />
      )}

      {/* Strategy card grid */}
      {!isLoading && strategies.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="discovery-card-grid"
        >
          {strategies.map((strategy) => (
            <StrategyDiscoveryCard
              key={strategy.id}
              strategy={strategy}
              onSelect={handleSelectStrategy}
            />
          ))}
        </div>
      )}

      {/* Strategy Detail Panel */}
      <StrategyDetailPanel
        strategy={detail}
        open={isPanelOpen}
        onOpenChange={handlePanelOpenChange}
        onImportToEditor={handleImportToEditor}
        onImportToWorkflow={handleImportToWorkflow}
        isLoading={isDetailLoading}
      />
    </div>
  );
}
