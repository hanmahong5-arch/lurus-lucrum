"use client";

/**
 * History Page - Trading and Strategy History
 *
 * Fetches real data from the history API endpoints:
 * - GET /api/history?type=strategy  for strategy generation history
 * - GET /api/history?type=backtest  for backtest history
 * - GET /api/history?type=trading   for trading history
 *
 * Shows an empty state when no data exists.
 */

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// =============================================================================
// Types
// =============================================================================

interface TradeHistory {
  id: string;
  type: "trade";
  symbol: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  total: number;
  pnl?: number;
  timestamp: string;
  status: "completed" | "cancelled";
}

interface StrategyHistory {
  id: string;
  type: "strategy";
  name: string;
  prompt: string;
  backtestReturn?: number;
  backtestWinRate?: number;
  timestamp: string;
  status: "success" | "failed" | "pending";
}

interface AdvisorHistory {
  id: string;
  type: "advisor";
  query: string;
  responsePreview: string;
  category: string;
  timestamp: string;
}

type HistoryEntry = TradeHistory | StrategyHistory | AdvisorHistory;

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchHistoryData(): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];

  // Fetch all three history types in parallel
  const [strategyRes, backtestRes, tradingRes] = await Promise.allSettled([
    fetch("/api/history?type=strategy&limit=50"),
    fetch("/api/history?type=backtest&limit=50"),
    fetch("/api/history?type=trading&limit=50"),
  ]);

  // Parse strategy history
  if (strategyRes.status === "fulfilled" && strategyRes.value.ok) {
    try {
      const data = await strategyRes.value.json();
      if (data.success && Array.isArray(data.data)) {
        for (const s of data.data) {
          entries.push({
            id: `S${s.id}`,
            type: "strategy",
            name: s.strategyName || s.strategy_name || "Unnamed Strategy",
            prompt: s.description || s.strategyCode?.slice(0, 80) || "",
            backtestReturn: s.totalReturn ?? s.total_return ?? undefined,
            backtestWinRate: s.winRate ?? s.win_rate ?? undefined,
            timestamp: s.createdAt || s.created_at || new Date().toISOString(),
            status: s.isActive === false ? "failed" : "success",
          });
        }
      }
    } catch {
      // Strategy history fetch failed silently
    }
  }

  // Parse backtest history (map to strategy-like entries for display)
  if (backtestRes.status === "fulfilled" && backtestRes.value.ok) {
    try {
      const data = await backtestRes.value.json();
      if (data.success && Array.isArray(data.data)) {
        for (const b of data.data) {
          entries.push({
            id: `B${b.id}`,
            type: "strategy",
            name: b.stockName ? `${b.symbol} ${b.stockName}` : b.symbol || "Backtest",
            prompt: `${b.startDate} ~ ${b.endDate} | ${b.timeframe || "1d"}`,
            backtestReturn: b.totalReturn ?? b.total_return ?? undefined,
            backtestWinRate: b.winRate ?? b.win_rate ?? undefined,
            timestamp: b.createdAt || b.created_at || new Date().toISOString(),
            status: "success",
          });
        }
      }
    } catch {
      // Backtest history fetch failed silently
    }
  }

  // Parse trading history
  if (tradingRes.status === "fulfilled" && tradingRes.value.ok) {
    try {
      const data = await tradingRes.value.json();
      if (data.success && Array.isArray(data.data)) {
        for (const t of data.data) {
          entries.push({
            id: `T${t.id}`,
            type: "trade",
            symbol: t.symbol || "",
            side: t.side === "sell" ? "sell" : "buy",
            price: t.price ?? 0,
            size: t.size ?? 0,
            total: t.amount ?? (t.price ?? 0) * (t.size ?? 0),
            pnl: t.realizedPnl ?? t.realized_pnl ?? undefined,
            timestamp: t.executedAt || t.executed_at || t.createdAt || new Date().toISOString(),
            status: t.status === "cancelled" ? "cancelled" : "completed",
          });
        }
      }
    } catch {
      // Trading history fetch failed silently
    }
  }

  // Sort by timestamp descending
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return entries;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

// =============================================================================
// Page Component
// =============================================================================

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<
    "all" | "trade" | "strategy" | "advisor"
  >("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchHistoryData();
      setHistory(data);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load history"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Filter history based on active tab and search
  const filteredHistory = history.filter((entry) => {
    const matchesTab = activeTab === "all" || entry.type === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      (entry.type === "trade" &&
        entry.symbol.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.type === "strategy" &&
        (entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.prompt.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (entry.type === "advisor" &&
        (entry.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.responsePreview
            .toLowerCase()
            .includes(searchQuery.toLowerCase())));
    return matchesTab && matchesSearch;
  });

  // Statistics calculation
  const stats = {
    totalTrades: history.filter((h) => h.type === "trade").length,
    completedTrades: history.filter(
      (h) => h.type === "trade" && h.status === "completed",
    ).length,
    totalStrategies: history.filter((h) => h.type === "strategy").length,
    successStrategies: history.filter(
      (h) => h.type === "strategy" && h.status === "success",
    ).length,
    totalAdvisorQueries: history.filter((h) => h.type === "advisor").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page title and stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            历史记录
            <span className="text-base font-normal text-white/50 ml-2">
              / History
            </span>
          </h1>
          <p className="text-white/60 mb-6">
            查看您的交易、策略生成和投资顾问对话历史
          </p>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">总交易次数</div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums">
                {stats.totalTrades}
              </div>
              <div className="text-xs text-[#10b981]">
                {stats.completedTrades} 已完成
              </div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">生成策略数</div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums">
                {stats.totalStrategies}
              </div>
              <div className="text-xs text-[#10b981]">
                {stats.successStrategies} 成功
              </div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">顾问咨询</div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums">
                {stats.totalAdvisorQueries}
              </div>
              <div className="text-xs text-[#f5a623]">三道六术分析</div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">记录总数</div>
              <div className="text-2xl font-bold text-white font-mono tabular-nums">
                {history.length}
              </div>
              <div className="text-xs text-white/50">全部类型</div>
            </div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="flex items-center justify-between mb-6">
          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: "all", label: "全部 / All" },
              { key: "trade", label: "交易 / Trades" },
              { key: "strategy", label: "策略 / Strategies" },
              { key: "advisor", label: "顾问 / Advisor" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 text-sm rounded-lg transition ${
                  activeTab === tab.key
                    ? "bg-[#f5a623]/10 text-[#f5a623] border border-[#f5a623]/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索历史记录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-[#1a1f36] border border-[#2a2f46] rounded-lg px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f5a623]/50"
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* History list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-[#1a1f36] rounded-xl p-12 text-center border border-[#2a2f46]">
              <div className="text-white/50 text-lg mb-2">加载中...</div>
              <div className="text-white/30 text-sm">
                正在获取历史记录
              </div>
            </div>
          ) : fetchError ? (
            <div className="bg-[#1a1f36] rounded-xl p-12 text-center border border-[#2a2f46]">
              <div className="text-white/50 text-lg mb-2">加载失败</div>
              <div className="text-white/30 text-sm mb-4">
                {fetchError}
              </div>
              <button
                onClick={loadHistory}
                className="px-4 py-2 text-sm bg-[#f5a623]/10 text-[#f5a623] rounded-lg hover:bg-[#f5a623]/20 transition"
              >
                重试
              </button>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-[#1a1f36] rounded-xl p-12 text-center border border-[#2a2f46]">
              <div className="text-white/30 text-lg mb-2">
                {history.length === 0 ? "暂无历史记录" : "暂无记录"}
              </div>
              <div className="text-white/20 text-sm">
                {history.length === 0
                  ? "No history yet. Run your first backtest to see results here."
                  : searchQuery
                    ? "尝试其他搜索关键词"
                    : "当前筛选条件下无记录"}
              </div>
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* Pagination hint */}
        {filteredHistory.length > 0 && (
          <div className="mt-6 text-center text-white/30 text-sm">
            显示 {filteredHistory.length} 条记录
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Card Component
// =============================================================================

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  if (entry.type === "trade") {
    return (
      <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46] hover:border-[#3a3f56] transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                entry.side === "buy" ? "bg-[#10b981]/10" : "bg-[#ef4444]/10"
              }`}
            >
              <span
                className={
                  entry.side === "buy" ? "text-[#10b981]" : "text-[#ef4444]"
                }
              >
                {entry.side === "buy" ? "买" : "卖"}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{entry.symbol}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    entry.status === "completed"
                      ? "bg-[#10b981]/10 text-[#10b981]"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {entry.status === "completed" ? "已完成" : "已取消"}
                </span>
              </div>
              <div className="text-sm text-white/50 font-mono tabular-nums">
                {entry.size} @ {entry.price.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium font-mono tabular-nums">
              {entry.total.toLocaleString()}
            </div>
            {entry.pnl !== undefined && (
              <div
                className={`text-sm font-mono tabular-nums ${entry.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}
              >
                {entry.pnl >= 0 ? "+" : ""}{entry.pnl.toFixed(2)}
              </div>
            )}
            <div className="text-xs text-white/30">
              {formatDate(entry.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === "strategy") {
    return (
      <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46] hover:border-[#3a3f56] transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#f5a623]/10 flex items-center justify-center">
              <span className="text-[#f5a623]">策</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{entry.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    entry.status === "success"
                      ? "bg-[#10b981]/10 text-[#10b981]"
                      : entry.status === "failed"
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : "bg-white/10 text-white/50"
                  }`}
                >
                  {entry.status === "success"
                    ? "成功"
                    : entry.status === "failed"
                      ? "失败"
                      : "处理中"}
                </span>
              </div>
              <div className="text-sm text-white/50 max-w-md truncate">
                {entry.prompt}
              </div>
            </div>
          </div>
          <div className="text-right">
            {entry.backtestReturn !== undefined && (
              <div
                className={`text-lg font-medium font-mono tabular-nums ${
                  entry.backtestReturn >= 0
                    ? "text-[#10b981]"
                    : "text-[#ef4444]"
                }`}
              >
                {entry.backtestReturn >= 0 ? "+" : ""}
                {entry.backtestReturn.toFixed(1)}%
              </div>
            )}
            {entry.backtestWinRate !== undefined && (
              <div className="text-sm text-white/50 font-mono tabular-nums">
                胜率 {entry.backtestWinRate.toFixed(1)}%
              </div>
            )}
            <div className="text-xs text-white/30">
              {formatDate(entry.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Advisor type
  return (
    <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46] hover:border-[#3a3f56] transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center">
            <span className="text-[#8b5cf6]">问</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{entry.query}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                {entry.category}
              </span>
            </div>
            <div className="text-sm text-white/50 max-w-lg truncate">
              {entry.responsePreview}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/30">
            {formatDate(entry.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
