"use client";

/**
 * Account Management Page
 * 账户管理页面 - 展示账户详情、交易统计、重置功能
 * Uses DashboardHeader for consistent navigation across all dashboard pages
 * 使用 DashboardHeader 确保所有仪表板页面导航一致
 */

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  RotateCcw,
  Activity,
  Target,
  Award,
  AlertTriangle,
  X,
  CheckCircle
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

/**
 * Account Summary interface
 * 账户摘要接口
 */
interface AccountSummary {
  // Basic info / 基本信息
  initial_capital: number;
  balance: number;
  frozen: number;
  available: number;

  // P&L / 盈亏
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_commission: number;
  return_pct: number;

  // Trading stats / 交易统计
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
}

/**
 * Account Management Page
 * 账户管理页面 - 展示账户详情、交易统计、重置功能
 */
export default function AccountPage() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Fetch account summary
  // 获取账户摘要
  const fetchAccount = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/backend/account/summary");
      const data = await response.json();

      if (data.success && data.summary) {
        // Normalize all numeric fields to prevent toLocaleString on undefined
        const s = data.summary;
        setAccount({
          initial_capital: s.initial_capital ?? 0,
          balance: s.balance ?? 0,
          frozen: s.frozen ?? 0,
          available: s.available ?? 0,
          total_pnl: s.total_pnl ?? 0,
          realized_pnl: s.realized_pnl ?? 0,
          unrealized_pnl: s.unrealized_pnl ?? 0,
          total_commission: s.total_commission ?? 0,
          return_pct: s.return_pct ?? 0,
          total_trades: s.total_trades ?? 0,
          winning_trades: s.winning_trades ?? 0,
          losing_trades: s.losing_trades ?? 0,
          win_rate: s.win_rate ?? 0,
          max_drawdown: s.max_drawdown ?? 0,
          sharpe_ratio: s.sharpe_ratio ?? 0,
        });
        setError(null);
      } else {
        // Fallback to basic account info
        // 回退到基本账户信息
        const basicResponse = await fetch("/api/backend/account/info");
        const basicData = await basicResponse.json();
        if (basicData.success && basicData.account) {
          const a = basicData.account;
          setAccount({
            initial_capital: a.initial_capital ?? 0,
            balance: a.balance ?? 0,
            frozen: a.frozen ?? 0,
            available: a.available ?? 0,
            total_pnl: a.total_pnl ?? 0,
            realized_pnl: a.total_pnl ?? 0,
            unrealized_pnl: 0,
            total_commission: a.total_commission ?? 0,
            return_pct: a.return_pct ?? 0,
            total_trades: a.total_trades ?? 0,
            winning_trades: 0,
            losing_trades: 0,
            win_rate: 0,
            max_drawdown: 0,
            sharpe_ratio: 0,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch account");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  // Reset account
  // 重置账户
  const handleReset = async () => {
    try {
      setIsResetting(true);
      const response = await fetch("/api/backend/account/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_capital: 1000000 }),
      });

      const data = await response.json();

      if (data.success) {
        setShowResetConfirm(false);
        setResetSuccess(true);
        await fetchAccount();
        setTimeout(() => setResetSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to reset account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsResetting(false);
    }
  };

  // Format currency — defensive against undefined/null from API failures
  // 格式化货币 — 防御上游返回空值
  const formatCurrency = (value: number | null | undefined) => {
    const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
  };

  // Format percentage — defensive against undefined/null
  // 格式化百分比
  const formatPercent = (value: number | null | undefined) => {
    const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const pct = (v * 100).toFixed(2);
    return v >= 0 ? `+${pct}%` : `${pct}%`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Dashboard Header with account status */}
      {/* 统一的仪表板头部，包含账户状态 */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              账户管理
              <span className="text-base font-normal text-white/50 ml-2">
                / Account Management
              </span>
            </h1>
            <p className="text-white/60">
              查看账户详情、交易统计和绩效指标
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAccount}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white/60 hover:text-white text-sm transition"
              title="刷新账户数据"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-loss/10 border border-white/10 hover:border-loss/30 rounded-lg text-white/60 hover:text-loss text-sm transition"
            >
              <RotateCcw className="w-4 h-4" />
              重置账户
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-center justify-between">
            <p className="text-loss text-sm">⚠️ {error}</p>
            <button onClick={() => setError(null)} className="text-loss/60 hover:text-loss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {resetSuccess && (
          <div className="mb-6 p-4 bg-profit/10 border border-profit/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-profit" />
            <p className="text-profit text-sm">账户已重置成功！ / Account reset successfully!</p>
          </div>
        )}

        {/* Reset confirmation modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 p-6 bg-surface border border-border rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-loss/10 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-loss" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  确认重置账户？
                </h2>
              </div>
              <p className="text-white/60 text-sm mb-6">
                此操作将清除所有交易记录、持仓和盈亏数据，账户资金将重置为 ¥1,000,000。此操作不可撤销。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-white/60 hover:text-white text-sm transition"
                >
                  取消
                </button>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="flex items-center gap-2 px-4 py-2 bg-loss hover:bg-loss/90 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {isResetting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  确认重置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !account ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : account ? (
          <>
            {/* Main stats grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Balance */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <Wallet className="w-4 h-4" />
                  总资产 / Total Balance
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(account.balance)}
                </div>
                <div className="text-sm text-white/40 mt-1">
                  初始: {formatCurrency(account.initial_capital)}
                </div>
              </div>

              {/* Available */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <BarChart3 className="w-4 h-4" />
                  可用资金 / Available
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(account.available)}
                </div>
                <div className="text-sm text-white/40 mt-1">
                  冻结: {formatCurrency(account.frozen)}
                </div>
              </div>

              {/* Total P&L */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  {account.total_pnl >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-profit" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-loss" />
                  )}
                  总盈亏 / Total P&L
                </div>
                <div className={`text-2xl font-bold ${account.total_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {account.total_pnl >= 0 ? "+" : ""}{formatCurrency(account.total_pnl)}
                </div>
                <div className={`text-sm mt-1 ${account.return_pct >= 0 ? "text-profit/60" : "text-loss/60"}`}>
                  {formatPercent(account.return_pct)}
                </div>
              </div>

              {/* Win Rate */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                  <Target className="w-4 h-4" />
                  胜率 / Win Rate
                </div>
                <div className="text-2xl font-bold text-white">
                  {(account.win_rate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-white/40 mt-1">
                  {account.winning_trades}胜 / {account.losing_trades}负
                </div>
              </div>
            </div>

            {/* Detailed stats */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* P&L Breakdown */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent" />
                  盈亏明细 / P&L Breakdown
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">已实现盈亏</span>
                    <span className={`font-medium ${account.realized_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {account.realized_pnl >= 0 ? "+" : ""}{formatCurrency(account.realized_pnl)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">未实现盈亏</span>
                    <span className={`font-medium ${account.unrealized_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {account.unrealized_pnl >= 0 ? "+" : ""}{formatCurrency(account.unrealized_pnl)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">总手续费</span>
                    <span className="font-medium text-white">
                      {formatCurrency(account.total_commission)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-white/60">净盈亏</span>
                    <span className={`font-medium ${account.total_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {account.total_pnl >= 0 ? "+" : ""}{formatCurrency(account.total_pnl)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trading Stats */}
              <div className="p-6 bg-surface border border-border rounded-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-accent" />
                  交易统计 / Trading Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">总交易次数</span>
                    <span className="font-medium text-white">
                      {account.total_trades}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">盈利交易</span>
                    <span className="font-medium text-profit">
                      {account.winning_trades}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">亏损交易</span>
                    <span className="font-medium text-loss">
                      {account.losing_trades}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-white/60">最大回撤</span>
                    <span className="font-medium text-loss">
                      {(account.max_drawdown * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-white/60">夏普比率</span>
                    <span className="font-medium text-white">
                      {account.sharpe_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl">
              <h3 className="text-sm font-medium text-accent mb-2">
                💡 提示 / Tips
              </h3>
              <ul className="text-sm text-white/60 space-y-1">
                <li>• 模拟账户初始资金为 100 万元，可随时重置</li>
                <li>• 所有交易均为模拟交易，不涉及真实资金</li>
                <li>• 建议在模拟环境充分测试策略后再考虑实盘</li>
                <li>• Paper trading does not involve real money</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-white/40">
            无法加载账户数据
          </div>
        )}
      </main>
    </div>
  );
}
