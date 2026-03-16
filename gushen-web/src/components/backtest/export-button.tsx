"use client";

/**
 * Export Button Component
 *
 * Triggers PDF/CSV export of backtest diagnostic results.
 * Pro tier required for PDF export.
 */

import { useState, useCallback } from "react";
import type { ReturnMetrics, RiskMetrics, TradingMetrics } from "@/lib/backtest/types";
import { runDiagnostics, type DiagnosticInput } from "@/lib/backtest/diagnostics";

interface ExportButtonProps {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
  className?: string;
}

/**
 * Format a number as percentage string
 */
function pct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

/**
 * Generate CSV content from diagnostic results
 */
function generateCsv(
  returnMetrics: ReturnMetrics,
  riskMetrics: RiskMetrics,
  tradingMetrics: TradingMetrics,
): string {
  const input: DiagnosticInput = { returnMetrics, riskMetrics, tradingMetrics };
  const report = runDiagnostics(input);

  const lines: string[] = [
    "策略诊断报告",
    `生成时间,${new Date().toLocaleString("zh-CN")}`,
    `健康度评分,${report.overallScore}/100`,
    `风险等级,${report.riskLevel === "low" ? "低" : report.riskLevel === "medium" ? "中" : "高"}`,
    "",
    "== 收益指标 ==",
    `总收益率,${pct(returnMetrics.totalReturn)}`,
    `年化收益率,${pct(returnMetrics.annualizedReturn)}`,
    `收益波动率,${pct(returnMetrics.returnVolatility)}`,
    returnMetrics.alpha !== undefined ? `Alpha,${returnMetrics.alpha.toFixed(2)}%` : "",
    "",
    "== 风险指标 ==",
    `最大回撤,${riskMetrics.maxDrawdown.toFixed(2)}%`,
    `回撤持续天数,${riskMetrics.maxDrawdownDuration}`,
    `夏普比率,${riskMetrics.sharpeRatio.toFixed(2)}`,
    `索提诺比率,${riskMetrics.sortinoRatio.toFixed(2)}`,
    `卡玛比率,${riskMetrics.calmarRatio.toFixed(2)}`,
    "",
    "== 交易指标 ==",
    `总交易次数,${tradingMetrics.totalTrades}`,
    `胜率,${tradingMetrics.winRate.toFixed(1)}%`,
    `盈亏比,${tradingMetrics.profitFactor.toFixed(2)}`,
    `平均持仓天数,${tradingMetrics.avgHoldingDays.toFixed(1)}`,
    `最大连胜,${tradingMetrics.maxConsecutiveWins}`,
    `最大连亏,${tradingMetrics.maxConsecutiveLosses}`,
    "",
    "== 诊断结果 ==",
    "严重程度,问题,当前值,建议",
  ];

  for (const issue of report.issues) {
    const severity =
      issue.severity === "error" ? "严重" : issue.severity === "warning" ? "警告" : "提示";
    lines.push(
      `${severity},"${issue.message}","${issue.currentValue}","${issue.suggestion}"`,
    );
  }

  if (report.highlights.length > 0) {
    lines.push("", "== 策略亮点 ==", "亮点,数值");
    for (const h of report.highlights) {
      lines.push(`"${h.message}","${h.value}"`);
    }
  }

  return lines.filter(Boolean).join("\n");
}

/**
 * Generate simple HTML report for PDF printing
 */
function generateHtmlReport(
  returnMetrics: ReturnMetrics,
  riskMetrics: RiskMetrics,
  tradingMetrics: TradingMetrics,
): string {
  const input: DiagnosticInput = { returnMetrics, riskMetrics, tradingMetrics };
  const report = runDiagnostics(input);

  const scoreColor =
    report.overallScore >= 80
      ? "#22c55e"
      : report.overallScore >= 60
        ? "#f59e0b"
        : "#ef4444";

  const riskLabel =
    report.riskLevel === "low" ? "低风险" : report.riskLevel === "medium" ? "中等风险" : "高风险";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>策略诊断报告 - GuShen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
  h1 { font-size: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px; }
  h2 { font-size: 18px; margin-top: 32px; color: #333; }
  .score { display: inline-flex; align-items: center; gap: 12px; padding: 16px 24px; border-radius: 12px; background: #f9f9f9; margin-bottom: 24px; }
  .score-num { font-size: 36px; font-weight: bold; color: ${scoreColor}; }
  .score-label { font-size: 14px; color: #666; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .metric { padding: 12px; border-radius: 8px; background: #f9f9f9; }
  .metric-label { font-size: 12px; color: #888; }
  .metric-value { font-size: 18px; font-weight: 600; font-family: 'SF Mono', monospace; }
  .issue { padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid; }
  .issue-error { border-color: #ef4444; background: #fef2f2; }
  .issue-warning { border-color: #f59e0b; background: #fffbeb; }
  .issue-info { border-color: #3b82f6; background: #eff6ff; }
  .highlight { padding: 8px 12px; border-radius: 6px; background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 6px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; }
  .green { color: #22c55e; } .red { color: #ef4444; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>策略诊断报告</h1>
<div class="score">
  <div class="score-num">${report.overallScore}</div>
  <div>
    <div class="score-label">健康度评分</div>
    <div class="score-label">${riskLabel}</div>
  </div>
</div>

<h2>收益指标</h2>
<div class="grid">
  <div class="metric"><div class="metric-label">总收益率</div><div class="metric-value ${returnMetrics.totalReturn >= 0 ? "green" : "red"}">${pct(returnMetrics.totalReturn)}</div></div>
  <div class="metric"><div class="metric-label">年化收益率</div><div class="metric-value">${pct(returnMetrics.annualizedReturn)}</div></div>
  <div class="metric"><div class="metric-label">收益波动率</div><div class="metric-value">${pct(returnMetrics.returnVolatility)}</div></div>
</div>

<h2>风险指标</h2>
<div class="grid">
  <div class="metric"><div class="metric-label">最大回撤</div><div class="metric-value red">${riskMetrics.maxDrawdown.toFixed(2)}%</div></div>
  <div class="metric"><div class="metric-label">夏普比率</div><div class="metric-value">${riskMetrics.sharpeRatio.toFixed(2)}</div></div>
  <div class="metric"><div class="metric-label">索提诺比率</div><div class="metric-value">${riskMetrics.sortinoRatio.toFixed(2)}</div></div>
</div>

<h2>交易指标</h2>
<div class="grid">
  <div class="metric"><div class="metric-label">总交易次数</div><div class="metric-value">${tradingMetrics.totalTrades}</div></div>
  <div class="metric"><div class="metric-label">胜率</div><div class="metric-value">${tradingMetrics.winRate.toFixed(1)}%</div></div>
  <div class="metric"><div class="metric-label">盈亏比</div><div class="metric-value">${tradingMetrics.profitFactor.toFixed(2)}</div></div>
</div>

${
  report.highlights.length > 0
    ? `<h2>策略亮点</h2>${report.highlights.map((h) => `<div class="highlight"><strong>${h.message}</strong> — ${h.value}</div>`).join("")}`
    : ""
}

${
  report.issues.length > 0
    ? `<h2>诊断问题 (${report.issues.length})</h2>${report.issues
        .map(
          (i) =>
            `<div class="issue issue-${i.severity}"><strong>${i.message}</strong><br/><span style="font-size:13px;color:#666">当前值: ${i.currentValue}</span><br/><span style="font-size:13px;color:#444">💡 ${i.suggestion}</span></div>`,
        )
        .join("")}`
    : ""
}

<div class="footer">
  GuShen 策略诊断报告 · ${new Date().toLocaleDateString("zh-CN")} · Powered by GuShen Multi-Agent
</div>
</body>
</html>`;
}

export function ExportButton({
  returnMetrics,
  riskMetrics,
  tradingMetrics,
  className,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleCsvExport = useCallback(() => {
    const csv = generateCsv(returnMetrics, riskMetrics, tradingMetrics);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `策略诊断报告_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [returnMetrics, riskMetrics, tradingMetrics]);

  const handlePdfExport = useCallback(() => {
    setExporting(true);
    try {
      const html = generateHtmlReport(returnMetrics, riskMetrics, tradingMetrics);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } finally {
      setExporting(false);
    }
  }, [returnMetrics, riskMetrics, tradingMetrics]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <button
        onClick={handleCsvExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition border border-white/10"
      >
        📋 CSV
      </button>
      <button
        onClick={handlePdfExport}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition border border-accent/20"
      >
        📄 PDF 报告
      </button>
    </div>
  );
}
