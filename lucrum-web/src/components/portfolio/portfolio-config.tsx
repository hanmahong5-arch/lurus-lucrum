"use client";

/**
 * Portfolio Configuration Panel
 *
 * Three-step wizard for portfolio backtest:
 *   Step 1: Stock selection (search, favorites import, sector import)
 *   Step 2: Position sizing method + risk controls
 *   Step 3: Backtest parameters (capital, commission, date range)
 *
 * Designed for ordinary users who want to apply one strategy
 * across 20-50 stocks with shared capital and position sizing.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Star,
  Layers,
  Settings2,
  Play,
  ChevronDown,
  AlertTriangle,
  List,
} from "lucide-react";
import { useValidationStore } from "@/lib/stores/validation-store";
import { useMarketDataStore } from "@/lib/stores/market-data-store";
import { useWatchlistStore, selectGroups } from "@/lib/stores/watchlist-store";
import { SectorQuickImport } from "./sector-quick-import";
import type {
  PortfolioStock,
  PositionSizingMethod,
  RebalanceFrequency,
} from "@/lib/stores/validation-store";

// =============================================================================
// Constants
// =============================================================================

const MAX_PORTFOLIO_STOCKS = 50;
const MIN_PORTFOLIO_STOCKS = 2;

const SIZING_METHODS: {
  value: PositionSizingMethod;
  label: string;
  description: string;
}[] = [
  { value: "equal", label: "等权分配", description: "每只股票平均分配资金" },
  { value: "market_cap", label: "市值加权", description: "按市值大小分配资金" },
  { value: "risk_parity", label: "风险平价", description: "波动率低的多分配" },
  { value: "custom", label: "自定义权重", description: "手动设定每只股票权重" },
];

const MAX_POSITION_OPTIONS = [
  { label: "5%", value: 0.05 },
  { label: "10%", value: 0.1 },
  { label: "15%", value: 0.15 },
  { label: "20%", value: 0.2 },
];

const MAX_SECTOR_OPTIONS = [
  { label: "20%", value: 0.2 },
  { label: "30%", value: 0.3 },
  { label: "40%", value: 0.4 },
  { label: "50%", value: 0.5 },
];

const REBALANCE_OPTIONS: { value: RebalanceFrequency; label: string }[] = [
  { value: "none", label: "不再平衡" },
  { value: "monthly", label: "每月" },
  { value: "quarterly", label: "每季度" },
];

const CAPITAL_OPTIONS = [
  { label: "10万", value: 100000 },
  { label: "50万", value: 500000 },
  { label: "100万", value: 1000000 },
  { label: "500万", value: 5000000 },
];

const COMMISSION_OPTIONS = [
  { label: "万二", value: 0.0002 },
  { label: "万三", value: 0.0003 },
  { label: "万五", value: 0.0005 },
];

const PERIOD_PRESETS = [
  { label: "近1年", startOffset: 365 },
  { label: "近2年", startOffset: 730 },
  { label: "2023~2025", start: "2023-01-01", end: "2025-12-31" },
];

// =============================================================================
// Helpers
// =============================================================================

function dateFromOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0] ?? "";
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

interface SearchResult {
  symbol: string;
  name: string;
  displayName: string;
  isST: boolean;
  exchange: string;
}

// =============================================================================
// Component
// =============================================================================

interface PortfolioConfigProps {
  strategies: Array<{ id: string; name: string }>;
  sectors: Array<{ code: string; name: string; type: "industry" | "concept" }>;
  onStartBacktest: () => void;
  isRunning: boolean;
  className?: string;
}

export function PortfolioConfig({
  strategies,
  sectors,
  onStartBacktest,
  isRunning,
  className,
}: PortfolioConfigProps) {
  const vStore = useValidationStore();
  const marketStore = useMarketDataStore();
  const watchlistGroups = useWatchlistStore(selectGroups);

  const stocks = vStore?.portfolioStocks ?? [];
  const sizing = vStore?.positionSizing ?? 'equal';
  const maxPosPct = vStore?.maxPositionPct ?? 0.1;
  const maxSecPct = vStore?.maxSectorPct ?? 0.3;
  const rebalance = vStore?.rebalanceFrequency ?? 'none';
  const config = vStore?.config ?? { capital: 1000000, commission: 0.0003, startDate: '', endDate: '', strategyId: '', holdingDays: 5, excludeST: true, excludeNewStocks: false, minMarketCap: 0, maxStocks: 50, sensitivityAnalysis: false, benchmarkComparison: false };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showSectorImport, setShowSectorImport] = useState(false);
  const [showWatchlistImport, setShowWatchlistImport] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Search debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(
        `/api/stocks/search?q=${encodeURIComponent(searchQuery)}&limit=15`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.results) {
            setSearchResults(data.results as SearchResult[]);
            setShowResults(true);
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close search
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAddStock = useCallback(
    (symbol: string, name: string, sector?: string) => {
      if (stocks.length >= MAX_PORTFOLIO_STOCKS) return;
      vStore.addPortfolioStock({ symbol, name, sector });
      setSearchQuery("");
      setShowResults(false);
      marketStore.addRecentSearch({ query: symbol, symbol, name });
    },
    [stocks.length, vStore, marketStore],
  );

  const handleImportFavorites = useCallback(() => {
    const favs = marketStore.favorites;
    if (favs.length === 0) return;
    const existing = new Set(stocks.map((s) => s.symbol));
    const newStocks: PortfolioStock[] = favs
      .filter((f) => !existing.has(f.symbol))
      .slice(0, MAX_PORTFOLIO_STOCKS - stocks.length)
      .map((f) => ({ symbol: f.symbol, name: f.name, sector: f.sector }));
    if (newStocks.length > 0) {
      vStore.setPortfolioStocks([...stocks, ...newStocks]);
    }
  }, [marketStore.favorites, stocks, vStore]);

  const handleImportWatchlistGroup = useCallback(
    (groupId: string) => {
      const group = watchlistGroups.find((g) => g.id === groupId);
      if (!group || group.stocks.length === 0) return;

      const existing = new Set(stocks.map((s) => s.symbol));
      const newStocks: PortfolioStock[] = group.stocks
        .filter((s) => !existing.has(s.symbol))
        .slice(0, MAX_PORTFOLIO_STOCKS - stocks.length)
        .map((s) => ({ symbol: s.symbol, name: s.name, sector: s.sector }));
      if (newStocks.length > 0) {
        vStore.setPortfolioStocks([...stocks, ...newStocks]);
      }
      setShowWatchlistImport(false);
    },
    [watchlistGroups, stocks, vStore],
  );

  const handleSectorImport = useCallback(
    (importedStocks: PortfolioStock[]) => {
      const existing = new Set(stocks.map((s) => s.symbol));
      const newStocks = importedStocks
        .filter((s) => !existing.has(s.symbol))
        .slice(0, MAX_PORTFOLIO_STOCKS - stocks.length);
      if (newStocks.length > 0) {
        vStore.setPortfolioStocks([...stocks, ...newStocks]);
      }
      setShowSectorImport(false);
    },
    [stocks, vStore],
  );

  // Sector distribution
  const sectorDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stocks) {
      const sec = s.sector ?? "未知";
      map.set(sec, (map.get(sec) ?? 0) + 1);
    }
    const total = stocks.length || 1;
    return Array.from(map.entries())
      .map(([sector, count]) => ({
        sector,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [stocks]);

  // Per-stock allocation preview
  const perStockAllocation = useMemo(() => {
    if (stocks.length === 0) return 0;
    if (sizing === "equal") {
      return config.capital / stocks.length;
    }
    return config.capital / stocks.length; // Simplified for preview
  }, [stocks.length, sizing, config.capital]);

  // Validation
  const canStart = useMemo(() => {
    if (isRunning) return false;
    if (stocks.length < MIN_PORTFOLIO_STOCKS) return false;
    if (!config.startDate || !config.endDate) return false;
    if (config.endDate < config.startDate) return false;
    return true;
  }, [isRunning, stocks.length, config.startDate, config.endDate]);

  const disabledReason = useMemo(() => {
    if (isRunning) return "正在回测中...";
    if (stocks.length < MIN_PORTFOLIO_STOCKS)
      return `至少需要 ${MIN_PORTFOLIO_STOCKS} 只股票`;
    if (!config.startDate || !config.endDate) return "请设置回测日期区间";
    if (config.endDate < config.startDate) return "结束日期必须晚于开始日期";
    return "";
  }, [isRunning, stocks.length, config.startDate, config.endDate]);

  // Sector concentration warnings
  const sectorWarnings = useMemo(() => {
    return sectorDist.filter((s) => s.pct / 100 > maxSecPct);
  }, [sectorDist, maxSecPct]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            组合分仓
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            一个策略 x 多只股票 x 智能分仓
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-mono tabular-nums">
          {stocks.length}/{MAX_PORTFOLIO_STOCKS}
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Stock Selection                                            */}
      {/* ================================================================= */}
      <StepSection step={1} title="选择股票" subtitle={`已选 ${stocks.length}/${MAX_PORTFOLIO_STOCKS}`}>
        {/* Search bar */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索添加股票..."
              disabled={stocks.length >= MAX_PORTFOLIO_STOCKS}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition text-sm disabled:opacity-40"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {searchResults.map((stock) => {
                const alreadyAdded = stocks.some(
                  (s) => s.symbol === stock.symbol,
                );
                return (
                  <button
                    key={stock.symbol}
                    onClick={() => {
                      if (!alreadyAdded) {
                        handleAddStock(stock.symbol, stock.name);
                      }
                    }}
                    disabled={alreadyAdded}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2.5 text-left transition border-b border-white/5 last:border-b-0",
                      alreadyAdded
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-white/5",
                    )}
                  >
                    <span className="text-white font-medium text-sm">
                      {stock.displayName}
                    </span>
                    {stock.isST && (
                      <span className="text-xs px-1.5 py-0.5 bg-loss/20 text-loss rounded">
                        ST
                      </span>
                    )}
                    {alreadyAdded && (
                      <span className="text-xs text-white/30">已添加</span>
                    )}
                    <span className="text-xs text-white/30 ml-auto">
                      {stock.exchange}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick import buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleImportFavorites}
            disabled={
              marketStore.favorites.length === 0 ||
              stocks.length >= MAX_PORTFOLIO_STOCKS
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition border border-white/10"
          >
            <Star className="w-3 h-3" />
            从收藏夹导入
            <span className="font-mono tabular-nums">
              ({marketStore.favorites.length})
            </span>
          </button>
          <button
            onClick={() => setShowSectorImport(true)}
            disabled={stocks.length >= MAX_PORTFOLIO_STOCKS}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition border border-white/10"
          >
            <Layers className="w-3 h-3" />
            按板块添加
          </button>
          <div className="relative">
            <button
              onClick={() => setShowWatchlistImport(!showWatchlistImport)}
              disabled={
                stocks.length >= MAX_PORTFOLIO_STOCKS ||
                watchlistGroups.every((g) => g.stocks.length === 0)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition border border-white/10"
            >
              <List className="w-3 h-3" />
              从自选股导入
            </button>
            {showWatchlistImport && (
              <div className="absolute z-20 top-full left-0 mt-1 bg-surface border border-white/10 rounded-lg shadow-xl min-w-[160px] py-1">
                {watchlistGroups
                  .filter((g) => g.stocks.length > 0)
                  .map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleImportWatchlistGroup(g.id)}
                      className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white transition flex items-center justify-between"
                    >
                      <span>{g.name}</span>
                      <span className="font-mono tabular-nums text-white/30">
                        {g.stocks.length}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Sector import modal */}
        {showSectorImport && (
          <SectorQuickImport
            sectors={sectors}
            existingSymbols={stocks.map((s) => s.symbol)}
            maxImport={MAX_PORTFOLIO_STOCKS - stocks.length}
            onImport={handleSectorImport}
            onClose={() => setShowSectorImport(false)}
          />
        )}

        {/* Selected stocks grid */}
        {stocks.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-white/40 mb-2">已选股票</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className="relative group rounded-lg border border-white/10 bg-white/[0.03] p-2 text-center hover:border-white/20 transition"
                >
                  <div className="text-xs font-mono tabular-nums text-white/70">
                    {stock.symbol}
                  </div>
                  <div className="text-xs text-white/50 truncate mt-0.5">
                    {stock.name}
                  </div>
                  {stock.sector && (
                    <div className="text-[10px] text-white/30 truncate">
                      {stock.sector}
                    </div>
                  )}
                  <button
                    onClick={() => vStore.removePortfolioStock(stock.symbol)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-loss/20 hover:border-loss/40"
                    aria-label={`移除 ${stock.name}`}
                  >
                    <X className="w-3 h-3 text-white/60" />
                  </button>
                </div>
              ))}
            </div>

            {/* Clear all */}
            {stocks.length > 3 && (
              <button
                onClick={() => vStore.clearPortfolioStocks()}
                className="mt-2 text-xs text-white/30 hover:text-loss transition"
              >
                清空全部
              </button>
            )}
          </div>
        )}

        {/* Sector distribution bar */}
        {sectorDist.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-white/40 mb-2">行业分布</div>
            {/* Stacked bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-white/5">
              {sectorDist.map((s, i) => (
                <div
                  key={s.sector}
                  className="h-full transition-all"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                    opacity: 0.7,
                  }}
                  title={`${s.sector} ${s.pct}%`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {sectorDist.map((s, i) => (
                <span key={s.sector} className="flex items-center gap-1.5 text-xs text-white/50">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                    }}
                  />
                  {s.sector}
                  <span className="font-mono tabular-nums">{s.pct}%</span>
                </span>
              ))}
            </div>

            {/* Warnings */}
            {sectorWarnings.length > 0 && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-accent/5 border border-accent/20">
                <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <div className="text-xs text-accent/80">
                  {sectorWarnings.map((w) => (
                    <span key={w.sector}>
                      {w.sector}板块占比{w.pct}%, 超过限制{Math.round(maxSecPct * 100)}%
                      {"; "}
                    </span>
                  ))}
                  建议分散配置
                </div>
              </div>
            )}
          </div>
        )}
      </StepSection>

      {/* ================================================================= */}
      {/* STEP 2: Position Sizing                                            */}
      {/* ================================================================= */}
      <StepSection step={2} title="分仓方式">
        {/* Sizing method tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SIZING_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => vStore.setPositionSizing(m.value)}
              className={cn(
                "px-3 py-2.5 rounded-lg text-xs transition-all border text-center",
                sizing === m.value
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white",
              )}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">
                {m.description}
              </div>
            </button>
          ))}
        </div>

        {/* Allocation preview */}
        {stocks.length > 0 && sizing === "equal" && (
          <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-white/60">
            等权分配: 每只股票分配{" "}
            <span className="font-mono tabular-nums text-white font-medium">
              {"\u00A5"}
              {perStockAllocation.toLocaleString("zh-CN", {
                maximumFractionDigits: 0,
              })}
            </span>{" "}
            (总资金{" "}
            <span className="font-mono tabular-nums">
              {"\u00A5"}
              {config.capital.toLocaleString("zh-CN", {
                maximumFractionDigits: 0,
              })}
            </span>
            )
          </div>
        )}

        {/* Risk controls */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Settings2 className="w-3.5 h-3.5" />
            风控设置
          </div>

          {/* Max position per stock */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">
              单只股票最大占比
            </div>
            <div className="flex gap-1.5">
              {MAX_POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => vStore.setMaxPositionPct(opt.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all",
                    maxPosPct === opt.value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-white/5 text-white/50 border border-transparent hover:text-white/70",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max position per sector */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">
              单个行业最大占比
            </div>
            <div className="flex gap-1.5">
              {MAX_SECTOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => vStore.setMaxSectorPct(opt.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all",
                    maxSecPct === opt.value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-white/5 text-white/50 border border-transparent hover:text-white/70",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rebalance frequency */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">再平衡频率</div>
            <div className="flex gap-1.5">
              {REBALANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => vStore.setRebalanceFrequency(opt.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all",
                    rebalance === opt.value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-white/5 text-white/50 border border-transparent hover:text-white/70",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </StepSection>

      {/* ================================================================= */}
      {/* STEP 3: Backtest Settings                                          */}
      {/* ================================================================= */}
      <StepSection step={3} title="回测设置">
        <div className="space-y-4">
          {/* Strategy selector */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">策略</div>
            <select
              value={config.strategyId}
              onChange={(e) =>
                vStore.updateConfig({ strategyId: e.target.value })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition appearance-none"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Capital and Commission row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-white/40 mb-1.5">资金</div>
              <div className="flex gap-1">
                {CAPITAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      vStore.updateConfig({ capital: opt.value })
                    }
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded text-xs transition-all",
                      config.capital === opt.value
                        ? "bg-accent/15 text-accent font-medium border border-accent/30"
                        : "bg-white/5 text-white/50 border border-transparent",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-[120px]">
              <div className="text-xs text-white/40 mb-1.5">佣金</div>
              <div className="flex gap-1">
                {COMMISSION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      vStore.updateConfig({ commission: opt.value })
                    }
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded text-xs transition-all",
                      config.commission === opt.value
                        ? "bg-accent/15 text-accent font-medium border border-accent/30"
                        : "bg-white/5 text-white/50 border border-transparent",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date range */}
          <div>
            <div className="text-xs text-white/40 mb-1.5">时间区间</div>
            <div className="flex flex-wrap items-center gap-2">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    if (p.start && p.end) {
                      vStore.updateConfig({
                        startDate: p.start,
                        endDate: p.end,
                      });
                    } else if (p.startOffset) {
                      vStore.updateConfig({
                        startDate: dateFromOffset(p.startOffset),
                        endDate: todayStr(),
                      });
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs transition-all border",
                    p.start === config.startDate && p.end === config.endDate
                      ? "bg-accent/15 text-accent border-accent/30 font-medium"
                      : "bg-white/5 text-white/50 border-white/10 hover:text-white/70",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) =>
                    vStore.updateConfig({ startDate: e.target.value })
                  }
                  className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-accent/50 w-32"
                />
                <span className="text-white/30">~</span>
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(e) =>
                    vStore.updateConfig({ endDate: e.target.value })
                  }
                  className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-accent/50 w-32"
                />
              </div>
            </div>
          </div>
        </div>
      </StepSection>

      {/* ================================================================= */}
      {/* Start Button                                                       */}
      {/* ================================================================= */}
      <div className="pt-2">
        <button
          onClick={onStartBacktest}
          disabled={!canStart}
          title={!canStart ? disabledReason : undefined}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all btn-tactile",
            canStart
              ? "bg-accent text-void hover:brightness-110 shadow-[0_0_20px_rgba(var(--lucrum-accent-rgb,234,179,8),0.25)]"
              : "bg-white/5 text-white/30 cursor-not-allowed",
          )}
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              组合回测中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              开始组合回测
            </>
          )}
        </button>
        {!canStart && disabledReason && (
          <p className="text-xs text-white/30 text-center mt-2">
            {disabledReason}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

const SECTOR_COLORS = [
  "#eab308", // accent gold
  "#22d3ee", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ef4444", // red
  "#22c55e", // green
  "#f97316", // orange
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
];

function StepSection({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface/50 p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-xs font-bold font-mono">
          {step}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          {subtitle && (
            <div className="text-xs text-white/40">{subtitle}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
