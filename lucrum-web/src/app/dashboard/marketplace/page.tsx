"use client";

/**
 * Strategy Marketplace Page
 *
 * Features:
 * - Redesigned strategy cards with sparklines and key metrics
 * - Sort/filter toolbar with advanced filters
 * - Strategy comparison mode (multi-select + side-by-side table)
 * - One-click preview via slide-over detail panel
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useAbortController } from "@/hooks/use-abort-controller";
import { useStaleGuard } from "@/hooks/use-stale-guard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ErrorCard } from "@/components/ui/error-card";
import { ErrorCatalog } from "@/lib/errors/error-catalog";
import type { AppError } from "@/lib/errors/error-types";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";
import Link from "next/link";
import { GitCompare, Search } from "lucide-react";
import { ContextualHelp, CONTEXTUAL_HELP_CONTENT } from "@/components/ui/contextual-help";
import type { MarketplaceStrategy } from "@/components/marketplace/strategy-card";
import {
  FilterToolbar,
  EMPTY_FILTER,
  type SortOption,
  type FilterState,
} from "@/components/marketplace/filter-toolbar";
import { CardGridSkeleton, PanelSkeleton } from "@/components/ui/loading-skeleton";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// School filter chips — values match seed `school` codes.
// ---------------------------------------------------------------------------

const SCHOOLS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "value", label: "价值" },
  { value: "growth", label: "成长" },
  { value: "trend", label: "趋势" },
  { value: "momentum", label: "动量" },
  { value: "reversion", label: "反转" },
  { value: "quant", label: "量化" },
  { value: "macro", label: "宏观" },
];

// ---------------------------------------------------------------------------
// Dynamic imports — split heavy marketplace components into separate chunks
// ---------------------------------------------------------------------------

const StrategyCard = dynamic(
  () => import("@/components/marketplace/strategy-card").then((m) => ({ default: m.StrategyCard })),
  { ssr: false },
);

const StrategyComparison = dynamic(
  () => import("@/components/marketplace/strategy-comparison").then((m) => ({ default: m.StrategyComparison })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const StrategyDetailPanel = dynamic(
  () => import("@/components/marketplace/strategy-detail-panel").then((m) => ({ default: m.StrategyDetailPanel })),
  { ssr: false },
);

const UpgradeDialog = dynamic(
  () => import("@/components/paywall/upgrade-dialog").then((m) => ({ default: m.UpgradeDialog })),
  { ssr: false },
);

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Search className="w-7 h-7 text-white/20" />
      </div>
      <h3 className="text-base font-medium text-white/60 mb-2">暂无策略</h3>
      <p className="text-sm text-white/30 max-w-xs">
        策略市场刚刚开放，成为 Pro 用户即可上架你的策略赚取鹿贝收入
      </p>
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function MarketplacePage() {
  const { data: overview } = useAccountOverview();
  const upgradeGate = useUpgradeGate(overview?.subscription?.plan_code);

  // Data
  const [strategies, setStrategies] = useState<MarketplaceStrategy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<AppError | null>(null);

  // Toolbar state
  const [sort, setSort] = useState<SortOption>("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [school, setSchool] = useState<string | null>(null);
  const router = useRouter();

  // Comparison mode
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Subscribe loading
  const [subscribingId, setSubscribingId] = useState<number | null>(null);

  // Detail panel
  const [detailStrategy, setDetailStrategy] = useState<MarketplaceStrategy | null>(null);

  // Safety hooks
  const createSignal = useAbortController();
  const { createVersion, isStale } = useStaleGuard();

  // Debounce search input (300ms trailing edge)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Per-card loading state for detail panel
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  // ─── Data fetch ──────────────────────────────────────────────────────
  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Abort previous fetch and track request version for stale guard
    const signal = createSignal();
    const version = createVersion();

    try {
      // Map our sort options to API params
      const apiSort =
        sort === "recommended" || sort === "popular"
          ? "popular"
          : sort === "newest"
            ? "newest"
            : sort === "free"
              ? "cheapest"
              : "popular";

      const params = new URLSearchParams({
        sort: apiSort,
        limit: "20",
        offset: "0",
      });

      if (sort === "free") {
        params.set("price_type", "free");
      }
      if (school) {
        params.set("school", school);
      }

      const res = await fetch(`/api/lurus/marketplace/list?${params}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        strategies: MarketplaceStrategy[];
        total: number;
      };

      // Only apply results if this is still the latest request
      if (!isStale(version)) {
        setStrategies(data.strategies ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[marketplace] fetch error:", err);
      if (!isStale(version)) {
        setStrategies([]);
        setLoadError(ErrorCatalog.marketplaceLoadFailed());
      }
    } finally {
      if (!isStale(version)) {
        setLoading(false);
      }
    }
  }, [sort, school, createSignal, createVersion, isStale]);

  useEffect(() => {
    void fetchStrategies();
  }, [fetchStrategies]);

  // ─── Client-side filtering ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = strategies;

    // Text search (debounced — uses debouncedSearch, not raw searchQuery)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.authorName ?? "").toLowerCase().includes(q),
      );
    }

    // Grade filter
    if (filter.grades.length > 0) {
      result = result.filter((s) => {
        const g = s.gradeScore?.charAt(0).toUpperCase();
        return g && filter.grades.includes(g);
      });
    }

    // Win rate filter
    if (filter.minWinRate != null) {
      result = result.filter(
        (s) => s.winRate != null && s.winRate >= (filter.minWinRate ?? 0),
      );
    }

    // Sharpe filter
    if (filter.minSharpe != null) {
      result = result.filter(
        (s) => s.sharpeRatio != null && s.sharpeRatio >= (filter.minSharpe ?? 0),
      );
    }

    // Price range filter
    if (filter.minPrice != null) {
      result = result.filter((s) => {
        const price = s.priceMonthly ?? s.pricePerRun ?? 0;
        return price >= (filter.minPrice ?? 0);
      });
    }
    if (filter.maxPrice != null) {
      result = result.filter((s) => {
        const price = s.priceMonthly ?? s.pricePerRun ?? 0;
        return s.priceType === "free" || price <= (filter.maxPrice ?? Infinity);
      });
    }

    return result;
  }, [strategies, debouncedSearch, filter]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleSubscribe = useCallback(
    async (strategyId: number) => {
      if (!upgradeGate.gate("marketplace_subscribe")) return;
      setSubscribingId(strategyId);

      try {
        const res = await fetch("/api/lurus/marketplace/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy_id: strategyId }),
        });

        if (res.ok) {
          const strategy = strategies.find((s) => s.id === strategyId);
          toast.success(`已订阅「${strategy?.title ?? "策略"}」`);
          void fetchStrategies();
        } else if (res.status === 402) {
          upgradeGate.showBalance();
        } else if (res.status === 409) {
          toast.info("你已订阅该策略");
        } else {
          toast.error("订阅失败，请稍后重试");
        }
      } catch {
        toast.error("网络异常，请检查连接");
      } finally {
        setSubscribingId(null);
      }
    },
    [upgradeGate, strategies, fetchStrategies],
  );

  const handleViewDetail = useCallback((strategy: MarketplaceStrategy) => {
    // Only the LAST clicked strategy card opens — rapid clicks won't stack
    setLoadingDetailId(strategy.id);
    setDetailStrategy(strategy);
    // Clear loading after a tick so UI updates
    setTimeout(() => setLoadingDetailId(null), 100);
  }, []);

  const handleTryStrategy = useCallback(
    async (strategy: MarketplaceStrategy) => {
      // Fork the strategy into the user's workspace and navigate there.
      try {
        const res = await fetch("/api/lurus/marketplace/fork", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketplaceId: strategy.id }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            toast.error("请先登录");
          } else {
            toast.error("Fork 失败，请稍后重试");
          }
          return;
        }
        toast.success(`已 Fork「${strategy.title}」到工作台`);
        setDetailStrategy(null);
        router.push("/dashboard");
      } catch {
        toast.error("网络异常");
      }
    },
    [router],
  );

  const handleRate = useCallback(
    async (strategyId: number, stars: number, review?: string) => {
      const res = await fetch("/api/lurus/marketplace/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceId: strategyId, stars, review }),
      });
      if (res.ok) {
        toast.success("评分已提交");
        void fetchStrategies();
      } else if (res.status === 401) {
        toast.error("请先登录");
      } else {
        toast.error("评分失败");
      }
    },
    [fetchStrategies],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedStrategies = useMemo(
    () => strategies.filter((s) => selectedIds.has(s.id)),
    [strategies, selectedIds],
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                策略市场
              </h1>
              <ContextualHelp
                sections={CONTEXTUAL_HELP_CONTENT.marketplace ?? []}
                title="策略市场帮助"
              />
            </div>
            <p className="text-xs sm:text-sm text-white/50">
              浏览社区策略，一键订阅使用 | 作者分润 70%
            </p>
          </div>
          <Link
            href="/dashboard/marketplace/publish"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent/10 text-accent hover:bg-accent/20 transition rounded-lg text-sm font-medium border border-accent/20 shrink-0 w-full sm:w-auto btn-tactile"
          >
            发布策略
          </Link>
        </div>

        {/* School chips — one row above the filter toolbar */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto">
          <span className="text-xs text-white/40 shrink-0">流派：</span>
          <button
            onClick={() => setSchool(null)}
            className={
              "px-3 py-1 text-xs rounded-full border transition-colors shrink-0 " +
              (school === null
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-surface text-white/60 border-white/10 hover:text-white")
            }
          >
            全部
          </button>
          {SCHOOLS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSchool((prev) => (prev === s.value ? null : s.value))}
              className={
                "px-3 py-1 text-xs rounded-full border transition-colors shrink-0 " +
                (school === s.value
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-surface text-white/60 border-white/10 hover:text-white")
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Filter Toolbar */}
        <div className="mb-4">
          <FilterToolbar
            sort={sort}
            onSortChange={setSort}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-white/30 mb-4">
          <span>
            共 {total} 个策略
            {filtered.length !== strategies.length &&
              ` (筛选后 ${filtered.length} 个)`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-white/40 hover:text-white transition"
            >
              清除选择 ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Load error */}
        {loadError && !loading && (
          <div className="max-w-md mx-auto mb-6">
            <ErrorCard
              error={loadError}
              onAction={(action) => {
                if (action.type === 'retry') {
                  setLoadError(null);
                  void fetchStrategies();
                }
              }}
            />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-72 bg-white/5 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                selected={selectedIds.has(strategy.id)}
                onToggleSelect={toggleSelect}
                onSubscribe={handleSubscribe}
                onViewDetail={handleViewDetail}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating comparison button */}
      {selectedIds.size >= 2 && !showComparison && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <button
            onClick={() => setShowComparison(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-void font-medium text-sm rounded-lg shadow-glow-accent btn-tactile transition"
          >
            <GitCompare className="w-4 h-4" />
            对比 ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Comparison overlay */}
      {showComparison && selectedStrategies.length >= 2 && (
        <StrategyComparison
          strategies={selectedStrategies}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Detail slide-over panel */}
      <StrategyDetailPanel
        strategy={detailStrategy}
        onClose={() => setDetailStrategy(null)}
        onTryStrategy={handleTryStrategy}
      />

      {/* Upgrade dialog */}
      <UpgradeDialog
        open={upgradeGate.dialogState.open}
        onOpenChange={upgradeGate.setDialogOpen}
        variant={upgradeGate.dialogState.variant}
        featureName={upgradeGate.dialogState.featureName}
        templateName={upgradeGate.dialogState.templateName}
        sharpeRatio={upgradeGate.dialogState.sharpeRatio}
        used={upgradeGate.dialogState.used}
        limit={upgradeGate.dialogState.limit}
        resetAt={upgradeGate.dialogState.resetAt}
      />
    </div>
  );
}
