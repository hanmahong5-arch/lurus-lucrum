"use client";

/**
 * Strategy Diagnostics Content (Enhanced with Health Score Dashboard)
 *
 * Shows:
 * - Overall health score with category breakdown
 * - Visual score bars for each dimension
 * - Actionable suggestions
 * - Detailed DiagnosticPanel and SensitivityAnalysis (gated)
 *
 * Wired to analysis-store for diagnostic results persistence.
 */

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { DiagnosticPanel } from "@/components/backtest/diagnostic-panel";
import { SensitivityAnalysis } from "@/components/backtest/sensitivity-analysis";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { useUpgradeGate } from "@/hooks/use-upgrade-gate";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import {
  useStrategyWorkspaceStore,
  selectWorkspace,
} from "@/lib/stores/strategy-workspace-store";
import { useAnalysisStore } from "@/lib/stores/analysis-store";
import type {
  BacktestResult,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
} from "@/lib/backtest/types";
import { ExportButton } from "@/components/backtest/export-button";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPE GUARD & METRIC EXTRACTION
// =============================================================================

function hasBacktestData(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.totalReturn === "number" && typeof obj.sharpeRatio === "number"
  );
}

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
      winningTrades:
        r.enhanced?.summary?.winningTrades ??
        Math.round(((r.totalTrades ?? 0) * (r.winRate ?? 0)) / 100),
      losingTrades:
        r.enhanced?.summary?.losingTrades ??
        (r.totalTrades ?? 0) -
          Math.round(((r.totalTrades ?? 0) * (r.winRate ?? 0)) / 100),
      winRate: r.winRate ?? 0,
      profitFactor: r.profitFactor ?? 1,
      avgWin: r.avgWin ?? 0,
      avgLoss: r.avgLoss ?? 0,
      avgHoldingDays: r.avgHoldingPeriod ?? 0,
      maxConsecutiveWins: r.maxConsecutiveWins ?? 0,
      maxConsecutiveLosses: r.maxConsecutiveLosses ?? 0,
      maxSingleWin: r.maxSingleWin ?? 0,
      maxSingleLoss: r.maxSingleLoss ?? 0,
      tradingFrequency: r.enhanced?.summary
        ? r.totalTrades /
          Math.max(1, r.enhanced.summary.tradingDays / 22)
        : 0,
    },
  };
}

// =============================================================================
// HEALTH SCORE CALCULATION
// =============================================================================

interface HealthDimension {
  name: string;
  nameEn: string;
  score: number;
  maxScore: number;
  status: "good" | "moderate" | "weak";
  suggestion?: string;
}

function computeHealthScore(metrics: {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
}): {
  total: number;
  label: string;
  labelColor: string;
  dimensions: HealthDimension[];
} {
  const { returnMetrics, riskMetrics, tradingMetrics } = metrics;

  // Parameter stability (based on Sharpe and Sortino consistency)
  const sharpe = riskMetrics.sharpeRatio;
  const paramStability = Math.min(100, Math.max(0, sharpe * 40 + 20));

  // Data quality (based on total trades — more trades = more reliable)
  const trades = tradingMetrics.totalTrades;
  const dataQuality = Math.min(100, Math.max(0, Math.log10(trades + 1) * 45));

  // Drawdown control (max drawdown severity)
  const dd = Math.abs(riskMetrics.maxDrawdown);
  const drawdownControl = Math.min(100, Math.max(0, (1 - dd * 2) * 100));

  // Return consistency (win rate + profit factor combined)
  const wr = tradingMetrics.winRate / 100;
  const pf = Math.min(tradingMetrics.profitFactor, 5);
  const returnConsistency = Math.min(
    100,
    Math.max(0, wr * 50 + (pf / 5) * 50)
  );

  const total = Math.round(
    paramStability * 0.25 +
      dataQuality * 0.2 +
      drawdownControl * 0.3 +
      returnConsistency * 0.25
  );

  const label =
    total >= 80 ? "优秀" : total >= 60 ? "良好" : total >= 40 ? "一般" : "较弱";
  const labelColor =
    total >= 80
      ? "text-profit"
      : total >= 60
        ? "text-accent"
        : total >= 40
          ? "text-yellow-400"
          : "text-loss";

  function getStatus(score: number): "good" | "moderate" | "weak" {
    if (score >= 70) return "good";
    if (score >= 45) return "moderate";
    return "weak";
  }

  const dimensions: HealthDimension[] = [
    {
      name: "参数稳定性",
      nameEn: "Parameter Stability",
      score: Math.round(paramStability),
      maxScore: 100,
      status: getStatus(paramStability),
      suggestion:
        paramStability < 60
          ? "夏普比率偏低, 建议优化策略参数或增加过滤条件"
          : undefined,
    },
    {
      name: "数据质量",
      nameEn: "Data Quality",
      score: Math.round(dataQuality),
      maxScore: 100,
      status: getStatus(dataQuality),
      suggestion:
        dataQuality < 60
          ? "交易次数较少, 建议延长回测区间以提高统计显著性"
          : undefined,
    },
    {
      name: "回撤控制",
      nameEn: "Drawdown Control",
      score: Math.round(drawdownControl),
      maxScore: 100,
      status: getStatus(drawdownControl),
      suggestion:
        drawdownControl < 60
          ? "最大回撤偏高, 建议添加止损逻辑或仓位管理"
          : undefined,
    },
    {
      name: "收益一致性",
      nameEn: "Return Consistency",
      score: Math.round(returnConsistency),
      maxScore: 100,
      status: getStatus(returnConsistency),
      suggestion:
        returnConsistency < 60
          ? "盈亏比或胜率不足, 建议优化入场时机和持仓周期"
          : undefined,
    },
  ];

  return { total, label, labelColor, dimensions };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ScoreBar({
  dimension,
}: {
  dimension: HealthDimension;
}) {
  const barColor =
    dimension.status === "good"
      ? "bg-profit"
      : dimension.status === "moderate"
        ? "bg-accent"
        : "bg-loss";
  const textColor =
    dimension.status === "good"
      ? "text-profit"
      : dimension.status === "moderate"
        ? "text-accent"
        : "text-loss";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70">{dimension.name}</span>
        <span className={cn("font-mono tabular-nums font-medium", textColor)}>
          {dimension.score}
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${dimension.score}%` }}
        />
      </div>
    </div>
  );
}

function HealthScoreDashboard({
  total,
  label,
  labelColor,
  dimensions,
}: {
  total: number;
  label: string;
  labelColor: string;
  dimensions: HealthDimension[];
}) {
  const suggestions = dimensions
    .filter((d) => d.suggestion)
    .map((d) => ({ name: d.name, suggestion: d.suggestion! }));

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-5">
      {/* Header: overall score */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold font-mono tabular-nums text-white">
            {total}
            <span className="text-lg text-white/40">/100</span>
          </div>
          <div className={cn("text-sm font-medium mt-1", labelColor)}>
            [{label}]
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-white/50 mb-2">策略健康度评分</div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                total >= 80
                  ? "bg-profit"
                  : total >= 60
                    ? "bg-accent"
                    : total >= 40
                      ? "bg-yellow-400"
                      : "bg-loss"
              )}
              style={{ width: `${total}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dimension score grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {dimensions.map((dim) => (
          <ScoreBar key={dim.name} dimension={dim} />
        ))}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="border-t border-border pt-4 space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.name}
              className="flex items-start gap-2 text-sm text-white/70"
            >
              <span className="text-accent shrink-0 mt-0.5">*</span>
              <span>
                <span className="text-white/50">{s.name}:</span> {s.suggestion}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DiagnosticsContent() {
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const { data: overview } = useAccountOverview();
  const upgradeGate = useUpgradeGate(overview?.subscription?.plan_code);
  const analysisStore = useAnalysisStore();

  const result = workspace.lastBacktestResult;
  const hasResult = hasBacktestData(result);

  const canDiagnose = upgradeGate.hasAccess("strategy_diagnostic");
  const canSensitivity = upgradeGate.hasAccess("parameter_sensitivity");
  const canPdf = upgradeGate.hasAccess("pdf_export");

  const metrics = useMemo(() => {
    if (!hasResult) return null;
    return extractMetrics(result);
  }, [hasResult, result]);

  const healthScore = useMemo(() => {
    if (!metrics) return null;
    return computeHealthScore(metrics);
  }, [metrics]);

  // Persist diagnostic results to store when computed
  const persistDiagnostics = useCallback(() => {
    if (healthScore) {
      analysisStore.setDiagnosticResults(
        healthScore.dimensions.map((d) => ({
          name: d.name,
          status:
            d.status === "good"
              ? "pass"
              : d.status === "moderate"
                ? "warn"
                : "fail",
          message: d.suggestion ?? `${d.name} 评分: ${d.score}/100`,
          value: d.score,
        }))
      );
    }
  }, [healthScore, analysisStore]);

  // Persist on first computation
  useMemo(() => {
    persistDiagnostics();
  }, [persistDiagnostics]);

  if (!hasResult || !metrics || !healthScore) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">
            基于回测结果的智能分析和改进建议
          </p>
        </div>
        {canPdf ? (
          <ExportButton
            returnMetrics={metrics.returnMetrics}
            riskMetrics={metrics.riskMetrics}
            tradingMetrics={metrics.tradingMetrics}
          />
        ) : (
          <button
            onClick={() => upgradeGate.gate("pdf_export")}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition"
          >
            PDF 导出 (Pro)
          </button>
        )}
      </div>

      {/* Health Score Dashboard */}
      <HealthScoreDashboard
        total={healthScore.total}
        label={healthScore.label}
        labelColor={healthScore.labelColor}
        dimensions={healthScore.dimensions}
      />

      {/* Diagnostic Panel */}
      {canDiagnose ? (
        <DiagnosticPanel
          returnMetrics={metrics.returnMetrics}
          riskMetrics={metrics.riskMetrics}
          tradingMetrics={metrics.tradingMetrics}
        />
      ) : (
        <div className="p-8 bg-surface rounded-xl border border-border text-center space-y-3">
          <h3 className="text-base font-medium text-white">策略诊断</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            诊断引擎分析策略的收益、风险、交易三大维度
          </p>
          <button
            onClick={() => upgradeGate.gate("strategy_diagnostic")}
            className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
          >
            升级到进阶版解锁
          </button>
        </div>
      )}

      {/* Sensitivity Analysis */}
      {canSensitivity ? (
        <SensitivityAnalysis />
      ) : (
        <div className="p-8 bg-surface rounded-xl border border-border text-center space-y-3">
          <h3 className="text-base font-medium text-white">参数敏感度分析</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            单参数逐一扫描 + 双参数热力图
          </p>
          <button
            onClick={() => upgradeGate.gate("parameter_sensitivity")}
            className="inline-block px-6 py-2.5 bg-accent text-primary-600 rounded-lg font-medium text-sm hover:bg-accent/90 transition"
          >
            升级到专业版解锁
          </button>
        </div>
      )}

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
