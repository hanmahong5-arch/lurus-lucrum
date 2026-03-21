"use client";

/**
 * History Hub Page
 *
 * Tab-based organization:
 * - Backtest History: Timeline view with comparison + re-run
 * - Trade Records: Buy/sell history with P&L
 * - Strategy Versions: Version diff with rollback
 * - AI Conversations: Advisor chat history
 *
 * Each tab fetches its own data from the appropriate API.
 * Empty states with context-specific links.
 */

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useAbortController } from "@/hooks/use-abort-controller";
import { useStaleGuard } from "@/hooks/use-stale-guard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ErrorCard } from "@/components/ui/error-card";
import { ErrorCatalog } from "@/lib/errors/error-catalog";
import type { AppError } from "@/lib/errors/error-types";
import { PageTabs } from "@/components/ui/page-tabs";
import { Search, GitCompare } from "lucide-react";
import type { BacktestTimelineEntry } from "@/components/history/backtest-timeline";
import type { TradeHistoryItem } from "@/components/history/trade-history-list";
import type { StrategyVersion } from "@/components/history/strategy-version-list";
import type { ConversationItem } from "@/components/history/conversation-list";
import { HistoryEmptyState } from "@/components/history/empty-state";
import { TableSkeleton, PanelSkeleton } from "@/components/ui/loading-skeleton";

// ---------------------------------------------------------------------------
// Dynamic imports — split heavy history list components into separate chunks
// ---------------------------------------------------------------------------

const BacktestTimeline = dynamic(
  () => import("@/components/history/backtest-timeline").then((m) => ({ default: m.BacktestTimeline })),
  { ssr: false, loading: () => <TableSkeleton rows={5} /> },
);

const TradeHistoryList = dynamic(
  () => import("@/components/history/trade-history-list").then((m) => ({ default: m.TradeHistoryList })),
  { ssr: false, loading: () => <TableSkeleton rows={5} /> },
);

const StrategyVersionList = dynamic(
  () => import("@/components/history/strategy-version-list").then((m) => ({ default: m.StrategyVersionList })),
  { ssr: false, loading: () => <TableSkeleton rows={3} /> },
);

const ConversationList = dynamic(
  () => import("@/components/history/conversation-list").then((m) => ({ default: m.ConversationList })),
  { ssr: false, loading: () => <TableSkeleton rows={3} /> },
);

const HistoryComparison = dynamic(
  () => import("@/components/history/history-comparison").then((m) => ({ default: m.HistoryComparison })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = [
  { value: "backtest", label: "回测历史" },
  { value: "trades", label: "交易记录" },
  { value: "versions", label: "策略版本" },
  { value: "conversations", label: "AI 对话" },
] as const;

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchBacktestHistory(): Promise<BacktestTimelineEntry[]> {
  const entries: BacktestTimelineEntry[] = [];

  const [strategyRes, backtestRes] = await Promise.allSettled([
    fetch("/api/history?type=strategy&limit=50"),
    fetch("/api/history?type=backtest&limit=50"),
  ]);

  // Parse strategy history
  if (strategyRes.status === "fulfilled" && strategyRes.value.ok) {
    try {
      const data = await strategyRes.value.json();
      if (data.success && Array.isArray(data.data)) {
        for (const s of data.data) {
          entries.push({
            id: `S${s.id}`,
            timestamp: s.createdAt || s.created_at || new Date().toISOString(),
            strategyName: s.strategyName || s.strategy_name || "Unnamed Strategy",
            symbol: s.symbol || "",
            symbolName: s.stockName || "",
            grade: s.grade || s.gradeScore || null,
            annualizedReturn: s.annualizedReturn ?? s.annualized_return ?? null,
            winRate: s.winRate ?? s.win_rate ?? null,
            maxDrawdown: s.maxDrawdown ?? s.max_drawdown ?? null,
            sharpeRatio: s.sharpeRatio ?? s.sharpe_ratio ?? null,
          });
        }
      }
    } catch {
      // Strategy fetch failed silently
    }
  }

  // Parse backtest history
  if (backtestRes.status === "fulfilled" && backtestRes.value.ok) {
    try {
      const data = await backtestRes.value.json();
      if (data.success && Array.isArray(data.data)) {
        for (const b of data.data) {
          entries.push({
            id: `B${b.id}`,
            timestamp: b.createdAt || b.created_at || new Date().toISOString(),
            strategyName: b.strategyName || b.strategy_name || "Backtest",
            symbol: b.symbol || "",
            symbolName: b.stockName || b.stock_name || "",
            grade: b.grade || b.gradeScore || null,
            annualizedReturn: b.annualizedReturn ?? b.annualized_return ?? b.totalReturn ?? b.total_return ?? null,
            winRate: b.winRate ?? b.win_rate ?? null,
            maxDrawdown: b.maxDrawdown ?? b.max_drawdown ?? null,
            sharpeRatio: b.sharpeRatio ?? b.sharpe_ratio ?? null,
            stockCount: b.stockCount ?? b.stock_count,
            averageReturn: b.averageReturn ?? b.average_return ?? null,
          });
        }
      }
    } catch {
      // Backtest fetch failed silently
    }
  }

  // Sort descending
  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return entries;
}

async function fetchTradeHistory(): Promise<TradeHistoryItem[]> {
  try {
    const res = await fetch("/api/history?type=trading&limit=50");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return [];

    return data.data.map((t: Record<string, unknown>) => ({
      id: `T${t.id}`,
      symbol: (t.symbol as string) || "",
      side: t.side === "sell" ? "sell" : "buy",
      price: (t.price as number) ?? 0,
      size: (t.size as number) ?? 0,
      total: (t.amount as number) ?? ((t.price as number) ?? 0) * ((t.size as number) ?? 0),
      pnl: (t.realizedPnl as number) ?? (t.realized_pnl as number) ?? undefined,
      timestamp:
        (t.executedAt as string) ||
        (t.executed_at as string) ||
        (t.createdAt as string) ||
        new Date().toISOString(),
      status: t.status === "cancelled" ? "cancelled" : "completed",
    }));
  } catch {
    return [];
  }
}

async function fetchStrategyVersions(): Promise<StrategyVersion[]> {
  // Placeholder: strategy versions are not yet served by an API
  // Return empty to trigger empty state
  return [];
}

async function fetchConversations(): Promise<ConversationItem[]> {
  // Placeholder: conversation history is not yet served by an API
  // Return empty to trigger empty state
  return [];
}

// =============================================================================
// STATS BAR
// =============================================================================

function StatsBar({
  backtestCount,
  tradeCount,
  versionCount,
  conversationCount,
}: {
  backtestCount: number;
  tradeCount: number;
  versionCount: number;
  conversationCount: number;
}) {
  const stats = [
    { label: "回测记录", value: backtestCount, color: "text-accent" },
    { label: "交易记录", value: tradeCount, color: "text-profit" },
    { label: "策略版本", value: versionCount, color: "text-primary" },
    { label: "对话记录", value: conversationCount, color: "text-chart-purple" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-surface rounded-lg p-3 border border-border"
        >
          <div className="text-[11px] text-white/40 mb-1">{s.label}</div>
          <div className={`text-xl font-bold font-mono tabular-nums ${s.color}`}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// INNER PAGE (Suspense boundary for useSearchParams)
// =============================================================================

function HistoryPageInner() {
  // Data states
  const [backtestEntries, setBacktestEntries] = useState<BacktestTimelineEntry[]>([]);
  const [tradeEntries, setTradeEntries] = useState<TradeHistoryItem[]>([]);
  const [versionEntries, setVersionEntries] = useState<StrategyVersion[]>([]);
  const [conversationEntries, setConversationEntries] = useState<ConversationItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AppError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Comparison state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Safety: abort data loading on unmount
  const createSignal = useAbortController();

  // Debounce search input (300ms trailing)
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

  // Rerun guard: only run the last clicked rerun (debounce rapid clicks)
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  // ─── Data Loading ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [bt, tr, ver, conv] = await Promise.all([
        fetchBacktestHistory(),
        fetchTradeHistory(),
        fetchStrategyVersions(),
        fetchConversations(),
      ]);
      setBacktestEntries(bt);
      setTradeEntries(tr);
      setVersionEntries(ver);
      setConversationEntries(conv);
    } catch (err) {
      const loadErr = ErrorCatalog.dataLoadFailed('历史记录');
      loadErr.raw = err instanceof Error ? err.message : String(err);
      setFetchError(loadErr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── Filtered entries ──────────────────────────────────────────────
  const filteredBacktest = useMemo(() => {
    if (!debouncedSearch) return backtestEntries;
    const q = debouncedSearch.toLowerCase();
    return backtestEntries.filter(
      (e) =>
        e.strategyName.toLowerCase().includes(q) ||
        e.symbol.toLowerCase().includes(q) ||
        e.symbolName.toLowerCase().includes(q),
    );
  }, [backtestEntries, debouncedSearch]);

  const filteredTrades = useMemo(() => {
    if (!debouncedSearch) return tradeEntries;
    const q = debouncedSearch.toLowerCase();
    return tradeEntries.filter((e) => e.symbol.toLowerCase().includes(q));
  }, [tradeEntries, debouncedSearch]);

  // ─── Comparison helpers ────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
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

  const selectedBacktestEntries = useMemo(
    () => backtestEntries.filter((e) => selectedIds.has(e.id)),
    [backtestEntries, selectedIds],
  );

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleRerun = useCallback((entry: BacktestTimelineEntry) => {
    // If already rerunning, do nothing (prevent rapid clicks)
    if (rerunningId !== null) return;
    setRerunningId(entry.id);
    // Simulate rerun (actual implementation would call backtest API)
    alert(`重新运行: ${entry.strategyName} x ${entry.symbolName || entry.symbol}`);
    setRerunningId(null);
  }, [rerunningId]);

  const handleViewBacktestDetail = useCallback((_entry: BacktestTimelineEntry) => {
    // Navigate to backtest detail or show panel
    // For now, no-op
  }, []);

  const handleRollback = useCallback((version: StrategyVersion) => {
    alert(`回滚到版本 v${version.version}: ${version.strategyName}`);
  }, []);

  // ─── Tab content renderer ─────────────────────────────────────────
  const renderTab = useCallback(
    (tab: string) => {
      if (loading) {
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-3" />
            <span className="text-sm text-white/40">正在加载...</span>
          </div>
        );
      }

      if (fetchError) {
        return (
          <div className="flex flex-col items-center justify-center py-16 max-w-md mx-auto">
            <ErrorCard
              error={fetchError}
              onAction={(action) => {
                if (action.type === 'retry') {
                  setFetchError(null);
                  void loadAll();
                }
              }}
            />
          </div>
        );
      }

      switch (tab) {
        case "backtest":
          return filteredBacktest.length === 0 ? (
            <HistoryEmptyState tab="backtest" />
          ) : (
            <BacktestTimeline
              entries={filteredBacktest}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onRerun={handleRerun}
              onViewDetail={handleViewBacktestDetail}
            />
          );

        case "trades":
          return filteredTrades.length === 0 ? (
            <HistoryEmptyState tab="trades" />
          ) : (
            <TradeHistoryList entries={filteredTrades} />
          );

        case "versions":
          return versionEntries.length === 0 ? (
            <HistoryEmptyState tab="versions" />
          ) : (
            <StrategyVersionList
              versions={versionEntries}
              onRollback={handleRollback}
            />
          );

        case "conversations":
          return conversationEntries.length === 0 ? (
            <HistoryEmptyState tab="conversations" />
          ) : (
            <ConversationList entries={conversationEntries} />
          );

        default:
          return null;
      }
    },
    [
      loading,
      fetchError,
      loadAll,
      filteredBacktest,
      filteredTrades,
      versionEntries,
      conversationEntries,
      selectedIds,
      toggleSelect,
      handleRerun,
      handleViewBacktestDetail,
      handleRollback,
    ],
  );

  return (
    <>
      {/* Stats */}
      <StatsBar
        backtestCount={backtestEntries.length}
        tradeCount={tradeEntries.length}
        versionCount={versionEntries.length}
        conversationCount={conversationEntries.length}
      />

      {/* Search */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="搜索历史记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition"
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-white/40 hover:text-white transition"
          >
            清除选择 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Tabs */}
      <PageTabs tabs={[...TABS]}>{renderTab}</PageTabs>

      {/* Floating comparison button */}
      {selectedIds.size >= 2 && !showComparison && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <button
            onClick={() => setShowComparison(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-void font-medium text-sm rounded-lg shadow-glow-accent btn-tactile transition"
          >
            <GitCompare className="w-4 h-4" />
            对比选中 ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Comparison overlay */}
      {showComparison && selectedBacktestEntries.length >= 2 && (
        <HistoryComparison
          entries={selectedBacktestEntries}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            历史中心
          </h1>
          <p className="text-xs sm:text-sm text-white/50">
            查看回测记录、交易历史、策略版本和对话记录
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          }
        >
          <HistoryPageInner />
        </Suspense>
      </main>
    </div>
  );
}
