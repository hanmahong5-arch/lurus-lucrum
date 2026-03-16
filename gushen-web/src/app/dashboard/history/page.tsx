"use client";

/**
 * History Page - Trading and Strategy History
 * 历史记录页面 - 交易和策略历史
 *
 * Features:
 * - View trading history
 * - View strategy generation history
 * - View advisor conversation history
 * - Filter and search functionality
 * - Unified DashboardHeader with user status
 *
 * 功能：
 * - 查看交易历史
 * - 查看策略生成历史
 * - 查看顾问对话历史
 * - 筛选和搜索功能
 * - 统一的仪表板头部，包含用户状态
 */

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// History entry type definitions
// 历史记录条目类型定义
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
  category: "天道" | "地道" | "人道";
  timestamp: string;
}

type HistoryEntry = TradeHistory | StrategyHistory | AdvisorHistory;

// Mock history data for demonstration
// 演示用的模拟历史数据
const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: "T001",
    type: "trade",
    symbol: "BTC/USDT",
    side: "buy",
    price: 43250.0,
    size: 0.5,
    total: 21625.0,
    timestamp: "2026-01-18 10:30:00",
    status: "completed",
  },
  {
    id: "S001",
    type: "strategy",
    name: "双均线突破策略",
    prompt: "当5日均线向上穿过20日均线时买入，向下穿过时卖出",
    backtestReturn: 23.5,
    backtestWinRate: 58.2,
    timestamp: "2026-01-18 09:15:00",
    status: "success",
  },
  {
    id: "A001",
    type: "advisor",
    query: "当前A股市场环境如何？",
    responsePreview: "根据三道六术分析框架，当前市场处于震荡整理期...",
    category: "天道",
    timestamp: "2026-01-18 08:45:00",
  },
  {
    id: "T002",
    type: "trade",
    symbol: "ETH/USDT",
    side: "sell",
    price: 2380.0,
    size: 2.0,
    total: 4760.0,
    pnl: 200.0,
    timestamp: "2026-01-17 16:20:00",
    status: "completed",
  },
  {
    id: "S002",
    type: "strategy",
    name: "RSI超卖反弹策略",
    prompt: "当RSI低于30时买入，高于70时卖出",
    backtestReturn: 15.8,
    backtestWinRate: 52.1,
    timestamp: "2026-01-17 14:30:00",
    status: "success",
  },
  {
    id: "A002",
    type: "advisor",
    query: "新能源板块后续走势分析",
    responsePreview: "结合地道分析，新能源板块当前估值处于历史中位数...",
    category: "地道",
    timestamp: "2026-01-17 11:00:00",
  },
  {
    id: "T003",
    type: "trade",
    symbol: "SOL/USDT",
    side: "buy",
    price: 95.5,
    size: 20,
    total: 1910.0,
    timestamp: "2026-01-17 09:30:00",
    status: "cancelled",
  },
  {
    id: "A003",
    type: "advisor",
    query: "北向资金持续流出的影响",
    responsePreview: "从人道角度分析，北向资金流向反映了外资风险偏好...",
    category: "人道",
    timestamp: "2026-01-16 15:00:00",
  },
];

/**
 * Format date for display
 * 格式化日期显示
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "今天 " + (dateStr.split(" ")[1] ?? "");
  if (days === 1) return "昨天 " + (dateStr.split(" ")[1] ?? "");
  if (days < 7) return `${days}天前`;
  return dateStr.split(" ")[0] ?? dateStr;
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<
    "all" | "trade" | "strategy" | "advisor"
  >("all");
  const [history, setHistory] = useState<HistoryEntry[]>(MOCK_HISTORY);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter history based on active tab and search
  // 根据当前标签和搜索过滤历史记录
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
  // 统计数据计算
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
      {/* Unified Dashboard Header with user status / 统一的仪表板头部，包含用户状态 */}
      <DashboardHeader />

      {/* Main content */}
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
              <div className="text-2xl font-bold text-white">
                {stats.totalTrades}
              </div>
              <div className="text-xs text-[#10b981]">
                {stats.completedTrades} 已完成
              </div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">生成策略数</div>
              <div className="text-2xl font-bold text-white">
                {stats.totalStrategies}
              </div>
              <div className="text-xs text-[#10b981]">
                {stats.successStrategies} 成功
              </div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">顾问咨询</div>
              <div className="text-2xl font-bold text-white">
                {stats.totalAdvisorQueries}
              </div>
              <div className="text-xs text-[#f5a623]">三道六术分析</div>
            </div>
            <div className="bg-[#1a1f36] rounded-xl p-4 border border-[#2a2f46]">
              <div className="text-white/50 text-xs mb-1">活跃天数</div>
              <div className="text-2xl font-bold text-white">3</div>
              <div className="text-xs text-white/50">最近7天</div>
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
          {filteredHistory.length === 0 ? (
            <div className="bg-[#1a1f36] rounded-xl p-12 text-center border border-[#2a2f46]">
              <div className="text-white/30 text-lg mb-2">暂无记录</div>
              <div className="text-white/20 text-sm">
                {searchQuery
                  ? "尝试其他搜索关键词"
                  : "开始交易或生成策略后，记录将显示在这里"}
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

/**
 * History Card Component
 * 历史记录卡片组件
 */
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
              <div className="text-sm text-white/50">
                {entry.size} @ ${entry.price.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium">
              ${entry.total.toLocaleString()}
            </div>
            {entry.pnl !== undefined && (
              <div
                className={`text-sm ${entry.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}
              >
                {entry.pnl >= 0 ? "+" : ""}${entry.pnl.toFixed(2)}
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
                className={`text-lg font-medium ${
                  entry.backtestReturn >= 0
                    ? "text-[#10b981]"
                    : "text-[#ef4444]"
                }`}
              >
                {entry.backtestReturn >= 0 ? "+" : ""}
                {entry.backtestReturn}%
              </div>
            )}
            {entry.backtestWinRate !== undefined && (
              <div className="text-sm text-white/50">
                胜率 {entry.backtestWinRate}%
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
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  entry.category === "天道"
                    ? "bg-blue-500/10 text-blue-400"
                    : entry.category === "地道"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-purple-500/10 text-purple-400"
                }`}
              >
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
