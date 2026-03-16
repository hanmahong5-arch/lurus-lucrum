"use client";

/**
 * Strategy Diagnostics Report Page
 *
 * Standalone page for viewing strategy diagnostic reports
 * and parameter sensitivity analysis. Gated by subscription tier.
 */

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DiagnosticPanel } from "@/components/backtest/diagnostic-panel";
import { SensitivityAnalysis } from "@/components/backtest/sensitivity-analysis";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import {
  useStrategyWorkspaceStore,
  selectWorkspace,
} from "@/lib/stores/strategy-workspace-store";
import type {
  BacktestResult,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
} from "@/lib/backtest/types";
import { ExportButton } from "@/components/backtest/export-button";

// =============================================================================
// TYPE GUARD & METRIC EXTRACTION
// =============================================================================

/**
 * Check if the workspace result looks like a BacktestResult.
 * BacktestResult is a flat structure with fields like totalReturn, sharpeRatio, etc.
 */
function hasBacktestData(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.totalReturn === "number" && typeof obj.sharpeRatio === "number";
}

/**
 * Extract structured metrics from the flat BacktestResult for the DiagnosticPanel.
 */
function extractMetrics(v: unknown): {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
} | null {
  if (!v || typeof v !== "object") return null;
  const r = v as BacktestResult;

  return {
    returnMetrics: {
      totalReturn: r.totalReturn ?? 0,
      annualizedReturn: r.annualizedReturn ?? 0,
      monthlyReturns: [],
      alpha: r.enhanced?.summary?.alpha,
      returnVolatility: r.enhanced?.summary?.volatility ?? 0.15,
    },
    riskMetrics: {
      maxDrawdown: r.maxDrawdown ?? 0,
      maxDrawdownDuration: r.enhanced?.summary?.maxDrawdownDuration ?? 0,
      sharpeRatio: r.sharpeRatio ?? 0,
      sortinoRatio: r.sortinoRatio ?? 0,
      calmarRatio: r.enhanced?.summary?.calmarRatio ?? 0,
    },
    tradingMetrics: {
      totalTrades: r.totalTrades ?? 0,
      winningTrades: r.enhanced?.summary?.winningTrades ?? Math.round((r.totalTrades ?? 0) * (r.winRate ?? 0) / 100),
      losingTrades: r.enhanced?.summary?.losingTrades ?? (r.totalTrades ?? 0) - Math.round((r.totalTrades ?? 0) * (r.winRate ?? 0) / 100),
      winRate: r.winRate ?? 0,
      profitFactor: r.profitFactor ?? 1,
      avgWin: r.avgWin ?? 0,
      avgLoss: r.avgLoss ?? 0,
      avgHoldingDays: r.avgHoldingPeriod ?? 0,
      maxConsecutiveWins: r.maxConsecutiveWins ?? 0,
      maxConsecutiveLosses: r.maxConsecutiveLosses ?? 0,
      maxSingleWin: r.maxSingleWin ?? 0,
      maxSingleLoss: r.maxSingleLoss ?? 0,
      tradingFrequency: r.enhanced?.summary ? r.totalTrades / Math.max(1, r.enhanced.summary.tradingDays / 22) : 0,
    },
  };
}

// =============================================================================
// PAGE CONTENT
// =============================================================================

function DiagnosticsContent() {
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const { data: overview } = useAccountOverview();
  const upgradeGate = useUpgradeGate(overview?.subscription?.plan_code);

  const result = workspace.lastBacktestResult;
  const hasResult = hasBacktestData(result);

  const canDiagnose = upgradeGate.hasAccess("strategy_diagnostic");
  const canSensitivity = upgradeGate.hasAccess("parameter_sensitivity");
  const canPdf = upgradeGate.hasAccess("pdf_export");

  const metrics = useMemo(() => {
    if (!hasResult) return null;
    return extractMetrics(result);
  }, [hasResult, result]);

  // No backtest result available
  if (!hasResult || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔬</span>
          </div>
          <h2 className="text-xl font-bold text-white">策略诊断报告</h2>
          <p className="text-sm text-white/50">
            请先在策略工坊中运行回测，然后返回此页面查看诊断报告
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
          >
            前往策略工坊
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">策略诊断报告</h1>
          <p className="text-sm text-white/50">
            基于回测结果的智能分析和改进建议
          </p>
        </div>
        {canPdf && (
          <ExportButton
            returnMetrics={metrics.returnMetrics}
            riskMetrics={metrics.riskMetrics}
            tradingMetrics={metrics.tradingMetrics}
          />
        )}
        {!canPdf && (
          <button
            onClick={() => upgradeGate.gate("pdf_export")}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition"
          >
            <span>🔒</span>
            PDF 导出 (Pro)
          </button>
        )}
      </div>

      {/* Diagnostic Panel — gated for free users */}
      {canDiagnose ? (
        <DiagnosticPanel
          returnMetrics={metrics.returnMetrics}
          riskMetrics={metrics.riskMetrics}
          tradingMetrics={metrics.tradingMetrics}
        />
      ) : (
        <div className="p-8 bg-surface rounded-xl border border-border text-center space-y-3">
          <div className="text-4xl">🔬</div>
          <h3 className="text-base font-medium text-white">策略诊断</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            诊断引擎分析策略的收益、风险、交易三大维度，发现潜在问题并给出改进建议
          </p>
          <button
            onClick={() => upgradeGate.gate("strategy_diagnostic")}
            className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
          >
            升级到进阶版解锁
          </button>
        </div>
      )}

      {/* Sensitivity Analysis — gated for free/basic users */}
      {canSensitivity ? (
        <SensitivityAnalysis />
      ) : (
        <div className="p-8 bg-surface rounded-xl border border-border text-center space-y-3">
          <div className="text-4xl">📊</div>
          <h3 className="text-base font-medium text-white">参数敏感度分析</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            单参数逐一扫描 + 双参数热力图，找到最优参数组合和稳定区间
          </p>
          <button
            onClick={() => upgradeGate.gate("parameter_sensitivity")}
            className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
          >
            升级到专业版解锁
          </button>
        </div>
      )}

      {/* Next step suggestions */}
      <div className="p-4 bg-surface/30 rounded-xl border border-border">
        <h3 className="text-sm font-medium text-white/70 mb-3">下一步建议</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard"
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-center"
          >
            <div className="text-lg mb-1">⚙️</div>
            <div className="text-xs text-white/70">调参优化</div>
          </Link>
          <Link
            href="/dashboard/strategy-validation"
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-center"
          >
            <div className="text-lg mb-1">📈</div>
            <div className="text-xs text-white/70">多股验证</div>
          </Link>
          <Link
            href="/dashboard/advisor"
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-center"
          >
            <div className="text-lg mb-1">🧠</div>
            <div className="text-xs text-white/70">AI 顾问分析</div>
          </Link>
        </div>
      </div>

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

// =============================================================================
// PAGE
// =============================================================================

export default function DiagnosticsPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <DashboardHeader />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[calc(100vh-56px)]">
            <div className="text-gray-400">加载中...</div>
          </div>
        }
      >
        <DiagnosticsContent />
      </Suspense>
    </div>
  );
}
