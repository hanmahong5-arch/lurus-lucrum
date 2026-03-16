"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import Link from "next/link";
import { Search, TrendingUp, Clock, Tag, Star } from "lucide-react";
import {
  LikeButton,
  ShareButton,
  CommentSection,
} from "@/components/marketplace/strategy-social";

// =============================================================================
// TYPES
// =============================================================================

interface MarketplaceStrategy {
  id: number;
  title: string;
  description: string | null;
  priceType: string;
  pricePerRun: number | null;
  priceMonthly: number | null;
  gradeScore: string | null;
  totalRuns: number | null;
  totalSubscribers: number | null;
  publishedAt: string | null;
  authorName: string | null;
}

type SortOption = "popular" | "newest" | "cheapest";
type PriceFilter = "all" | "free" | "subscription" | "per_run";

// =============================================================================
// GRADE BADGE
// =============================================================================

const GRADE_COLORS: Record<string, string> = {
  A: "bg-profit/20 text-profit border-profit/30",
  B: "bg-accent/20 text-accent border-accent/30",
  C: "bg-amber-400/20 text-amber-400 border-amber-400/30",
  D: "bg-loss/20 text-loss border-loss/30",
};

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  const letter = grade.charAt(0).toUpperCase();
  const colorClass = GRADE_COLORS[letter] ?? "bg-white/10 text-white/50 border-white/20";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded border ${colorClass}`}>
      {letter}
    </span>
  );
}

// =============================================================================
// STRATEGY CARD
// =============================================================================

function StrategyCard({
  strategy,
  onSubscribe,
}: {
  strategy: MarketplaceStrategy;
  onSubscribe: (id: number) => void;
}) {
  const priceLabel =
    strategy.priceType === "free"
      ? "免费"
      : strategy.priceType === "subscription"
      ? `${strategy.priceMonthly ?? 0} LB/月`
      : `${strategy.pricePerRun ?? 0} LB/次`;

  return (
    <div className="p-4 bg-surface rounded-xl border border-border hover:border-accent/30 transition group">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GradeBadge grade={strategy.gradeScore} />
          <h3 className="text-sm font-semibold text-white group-hover:text-accent transition line-clamp-1">
            {strategy.title}
          </h3>
        </div>
        <span className="text-xs font-mono tabular-nums text-amber-400 whitespace-nowrap ml-2">
          {priceLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/50 line-clamp-2 mb-3 min-h-[2rem]">
        {strategy.description ?? "暂无描述"}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-white/40 mb-3">
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {strategy.totalRuns ?? 0} 次运行
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3" />
          {strategy.totalSubscribers ?? 0} 订阅
        </span>
        {strategy.authorName && (
          <span className="ml-auto text-white/30">
            by {strategy.authorName}
          </span>
        )}
      </div>

      {/* Social row */}
      <div className="flex items-center gap-4 mb-3">
        <LikeButton strategyId={strategy.id} />
        <CommentSection strategyId={strategy.id} />
        <ShareButton strategyId={strategy.id} title={strategy.title} />
      </div>

      {/* Action */}
      <button
        onClick={() => onSubscribe(strategy.id)}
        className={`w-full py-1.5 text-xs rounded-lg font-medium transition ${
          strategy.priceType === "free"
            ? "bg-profit/10 text-profit hover:bg-profit/20 border border-profit/20"
            : "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
        }`}
      >
        {strategy.priceType === "free" ? "免费使用" : "订阅策略"}
      </button>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Search className="w-7 h-7 text-white/20" />
      </div>
      <h3 className="text-base font-medium text-white/60 mb-2">
        暂无策略
      </h3>
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

  const [strategies, setStrategies] = useState<MarketplaceStrategy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("popular");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        limit: "20",
        offset: "0",
      });
      if (priceFilter !== "all") {
        params.set("price_type", priceFilter);
      }
      const res = await fetch(`/api/lurus/marketplace/list?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        strategies: MarketplaceStrategy[];
        total: number;
      };
      setStrategies(data.strategies ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("[marketplace] fetch error:", err);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, [sort, priceFilter]);

  useEffect(() => {
    void fetchStrategies();
  }, [fetchStrategies]);

  const handleSubscribe = useCallback(
    (strategyId: number) => {
      // Free users can only browse — gate the subscribe action
      if (!upgradeGate.gate("marketplace_subscribe")) return;

      // For now, show a placeholder — real subscribe flow via POST /api/lurus/marketplace/subscribe
      const strategy = strategies.find((s) => s.id === strategyId);
      alert(`订阅 "${strategy?.title}" 功能即将推出`);
    },
    [upgradeGate, strategies],
  );

  // Client-side search filter
  const filtered = searchQuery
    ? strategies.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : strategies;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
              策略市场
            </h1>
            <p className="text-xs sm:text-sm text-white/50">
              浏览社区策略，一键订阅使用 · 作者分润 70%
            </p>
          </div>
          <Link
            href="/dashboard/marketplace/publish"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent/10 text-accent hover:bg-accent/20 transition rounded-lg text-sm font-medium border border-accent/20 shrink-0 w-full sm:w-auto"
          >
            🏪 发布策略
          </Link>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="搜索策略..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg overflow-x-auto scrollbar-hide">
            {[
              { value: "popular" as const, label: "热门", icon: TrendingUp },
              { value: "newest" as const, label: "最新", icon: Clock },
              { value: "cheapest" as const, label: "低价", icon: Tag },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition ${
                  sort === value
                    ? "bg-accent text-primary-600 font-medium"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Price filter */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg overflow-x-auto scrollbar-hide">
            {[
              { value: "all" as const, label: "全部" },
              { value: "free" as const, label: "免费" },
              { value: "subscription" as const, label: "订阅" },
              { value: "per_run" as const, label: "按次" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPriceFilter(value)}
                className={`px-2.5 py-1.5 text-xs rounded-md transition ${
                  priceFilter === value
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-white/30 mb-4">
          共 {total} 个策略
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />
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
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
        )}
      </main>

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
