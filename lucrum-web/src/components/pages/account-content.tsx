"use client";

/**
 * Account Management Content (extracted from original page)
 *
 * Renders without DashboardHeader so it can be embedded in Settings tabs.
 * Shows trading account details, stats, and reset functionality.
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
  CheckCircle,
} from "lucide-react";

interface AccountSummary {
  initial_capital: number;
  balance: number;
  frozen: number;
  available: number;
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_commission: number;
  return_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
}

export function AccountContent() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const fetchAccount = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/backend/account/summary");
      const data = await response.json();
      if (data.success && data.summary) {
        const s = data.summary;
        setAccount({
          initial_capital: s.initial_capital ?? 0, balance: s.balance ?? 0, frozen: s.frozen ?? 0, available: s.available ?? 0,
          total_pnl: s.total_pnl ?? 0, realized_pnl: s.realized_pnl ?? 0, unrealized_pnl: s.unrealized_pnl ?? 0,
          total_commission: s.total_commission ?? 0, return_pct: s.return_pct ?? 0, total_trades: s.total_trades ?? 0,
          winning_trades: s.winning_trades ?? 0, losing_trades: s.losing_trades ?? 0, win_rate: s.win_rate ?? 0,
          max_drawdown: s.max_drawdown ?? 0, sharpe_ratio: s.sharpe_ratio ?? 0,
        });
        setError(null);
      } else {
        const basicResponse = await fetch("/api/backend/account/info");
        const basicData = await basicResponse.json();
        if (basicData.success && basicData.account) {
          const a = basicData.account;
          setAccount({
            initial_capital: a.initial_capital ?? 0, balance: a.balance ?? 0, frozen: a.frozen ?? 0, available: a.available ?? 0,
            total_pnl: a.total_pnl ?? 0, realized_pnl: a.total_pnl ?? 0, unrealized_pnl: 0,
            total_commission: a.total_commission ?? 0, return_pct: a.return_pct ?? 0, total_trades: a.total_trades ?? 0,
            winning_trades: 0, losing_trades: 0, win_rate: 0, max_drawdown: 0, sharpe_ratio: 0,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch account");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      const response = await fetch("/api/backend/account/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initial_capital: 1000000 }) });
      const data = await response.json();
      if (data.success) { setShowResetConfirm(false); setResetSuccess(true); await fetchAccount(); setTimeout(() => setResetSuccess(false), 3000); }
      else setError(data.error || "Failed to reset account");
    } catch (err) { setError(err instanceof Error ? err.message : "Network error"); }
    finally { setIsResetting(false); }
  };

  const formatCurrency = (value: number | null | undefined) => {
    const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return `\u00A5${n.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number | null | undefined) => {
    const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const pct = (v * 100).toFixed(2);
    return v >= 0 ? `+${pct}%` : `${pct}%`;
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">交易账户</h2>
        <div className="flex items-center gap-3">
          <button onClick={fetchAccount} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-sm transition">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> 刷新
          </button>
          <button onClick={() => setShowResetConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-loss/10 border border-white/10 hover:border-loss/30 rounded-lg text-white/60 hover:text-loss text-sm transition">
            <RotateCcw className="w-4 h-4" /> 重置账户
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg flex items-center justify-between">
          <p className="text-loss text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-loss/60 hover:text-loss"><X className="w-4 h-4" /></button>
        </div>
      )}
      {resetSuccess && (
        <div className="mb-6 p-4 bg-profit/10 border border-profit/30 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-profit" />
          <p className="text-profit text-sm">账户已重置成功</p>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 p-6 bg-surface border border-border rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-loss/10 rounded-full"><AlertTriangle className="w-6 h-6 text-loss" /></div>
              <h2 className="text-lg font-bold text-white">确认重置账户？</h2>
            </div>
            <p className="text-white/60 text-sm mb-6">此操作将清除所有交易记录、持仓和盈亏数据，账户资金将重置为 ¥1,000,000。此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-white/60 hover:text-white text-sm transition">取消</button>
              <button onClick={handleReset} disabled={isResetting} className="flex items-center gap-2 px-4 py-2 bg-loss hover:bg-loss/90 rounded-lg text-white text-sm font-medium transition disabled:opacity-50">
                {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} 确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && !account ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-accent animate-spin" /></div>
      ) : account ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-2"><Wallet className="w-4 h-4" /> 总资产</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(account.balance)}</div>
              <div className="text-sm text-white/40 mt-1">初始: {formatCurrency(account.initial_capital)}</div>
            </div>
            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-2"><BarChart3 className="w-4 h-4" /> 可用资金</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(account.available)}</div>
            </div>
            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-2">{account.total_pnl >= 0 ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />} 总盈亏</div>
              <div className={`text-2xl font-bold ${account.total_pnl >= 0 ? "text-profit" : "text-loss"}`}>{account.total_pnl >= 0 ? "+" : ""}{formatCurrency(account.total_pnl)}</div>
              <div className={`text-sm mt-1 ${account.return_pct >= 0 ? "text-profit/60" : "text-loss/60"}`}>{formatPercent(account.return_pct)}</div>
            </div>
            <div className="p-6 bg-surface border border-border rounded-xl">
              <div className="flex items-center gap-2 text-white/60 text-sm mb-2"><Target className="w-4 h-4" /> 胜率</div>
              <div className="text-2xl font-bold text-white">{(account.win_rate * 100).toFixed(1)}%</div>
              <div className="text-sm text-white/40 mt-1">{account.winning_trades}胜 / {account.losing_trades}负</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-surface border border-border rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-accent" /> 盈亏明细</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/5"><span className="text-white/60">已实现盈亏</span><span className={`font-medium ${account.realized_pnl >= 0 ? "text-profit" : "text-loss"}`}>{account.realized_pnl >= 0 ? "+" : ""}{formatCurrency(account.realized_pnl)}</span></div>
                <div className="flex justify-between items-center py-3 border-b border-white/5"><span className="text-white/60">总手续费</span><span className="font-medium text-white">{formatCurrency(account.total_commission)}</span></div>
                <div className="flex justify-between items-center py-3"><span className="text-white/60">净盈亏</span><span className={`font-medium ${account.total_pnl >= 0 ? "text-profit" : "text-loss"}`}>{account.total_pnl >= 0 ? "+" : ""}{formatCurrency(account.total_pnl)}</span></div>
              </div>
            </div>
            <div className="p-6 bg-surface border border-border rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-accent" /> 交易统计</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/5"><span className="text-white/60">总交易次数</span><span className="font-medium text-white">{account.total_trades}</span></div>
                <div className="flex justify-between items-center py-3 border-b border-white/5"><span className="text-white/60">最大回撤</span><span className="font-medium text-loss">{(account.max_drawdown * 100).toFixed(2)}%</span></div>
                <div className="flex justify-between items-center py-3"><span className="text-white/60">夏普比率</span><span className="font-medium text-white">{account.sharpe_ratio.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </>
      ) : <div className="text-center py-20 text-white/40">无法加载账户数据</div>}
    </div>
  );
}
