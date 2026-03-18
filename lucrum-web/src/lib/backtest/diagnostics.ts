/**
 * Backtest Diagnostics Engine - Intelligent strategy analysis
 * 回测诊断引擎 - 智能策略分析
 *
 * This module provides automated diagnostic rules to analyze backtest results
 * and provide actionable insights for strategy improvement.
 *
 * @module lib/backtest/diagnostics
 */

import type {
  DiagnosticItem,
  DiagnosticReport,
  DiagnosticSeverity,
  StrategyHighlight,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
} from "./types";

// =============================================================================
// DIAGNOSTIC RULE DEFINITION / 诊断规则定义
// =============================================================================

/**
 * Metrics input for diagnostic evaluation
 * 诊断评估的指标输入
 */
export interface DiagnosticInput {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
}

/**
 * Diagnostic rule definition
 * 诊断规则定义
 */
interface DiagnosticRule {
  id: string;
  condition: (input: DiagnosticInput) => boolean;
  severity: DiagnosticSeverity;
  message: string;
  messageEn: string;
  getValue: (input: DiagnosticInput) => string;
  suggestion: string;
  suggestionEn: string;
  relatedParams?: string[];
  category: "return" | "risk" | "trading" | "general";
}

/**
 * Highlight rule definition
 * 亮点规则定义
 */
interface HighlightRule {
  id: string;
  condition: (input: DiagnosticInput) => boolean;
  message: string;
  messageEn: string;
  getValue: (input: DiagnosticInput) => string;
}

// =============================================================================
// DIAGNOSTIC RULES / 诊断规则
// =============================================================================

const diagnosticRules: DiagnosticRule[] = [
  // -------------------------------------------------------------------------
  // Return-related diagnostics / 收益相关诊断
  // -------------------------------------------------------------------------
  {
    id: "negative_return",
    condition: (m) => m.returnMetrics.totalReturn < 0,
    severity: "error",
    message: "策略总体亏损",
    messageEn: "Strategy has overall loss",
    getValue: (m) => `${(m.returnMetrics.totalReturn * 100).toFixed(2)}%`,
    suggestion: "建议重新审视策略逻辑，检查入场和出场条件是否合理",
    suggestionEn:
      "Review strategy logic, check if entry and exit conditions are reasonable",
    relatedParams: ["entryCondition", "exitCondition"],
    category: "return",
  },
  {
    id: "low_annualized_return",
    condition: (m) =>
      m.returnMetrics.annualizedReturn < 0.05 &&
      m.returnMetrics.annualizedReturn > 0,
    severity: "warning",
    message: "年化收益率较低",
    messageEn: "Low annualized return",
    getValue: (m) => `${(m.returnMetrics.annualizedReturn * 100).toFixed(2)}%`,
    suggestion: "年化收益低于5%，可能不如持有指数基金，建议优化策略逻辑",
    suggestionEn:
      "Annualized return below 5%, may underperform index funds, consider optimizing strategy",
    category: "return",
  },
  {
    id: "negative_alpha",
    condition: (m) =>
      m.returnMetrics.alpha !== undefined && m.returnMetrics.alpha < -5,
    severity: "error",
    message: "策略跑输基准超过5%",
    messageEn: "Strategy underperforms benchmark by >5%",
    getValue: (m) => `${m.returnMetrics.alpha?.toFixed(2)}%`,
    suggestion: "策略效果不佳，建议重新审视策略逻辑或考虑直接投资指数",
    suggestionEn:
      "Strategy ineffective, consider reviewing logic or investing in index directly",
    category: "return",
  },
  {
    id: "high_return_volatility",
    condition: (m) => m.returnMetrics.returnVolatility > 0.3,
    severity: "warning",
    message: "收益波动较大",
    messageEn: "High return volatility",
    getValue: (m) => `${(m.returnMetrics.returnVolatility * 100).toFixed(2)}%`,
    suggestion: "收益不稳定，建议增加风险控制措施或减少仓位",
    suggestionEn:
      "Unstable returns, consider adding risk controls or reducing position size",
    relatedParams: ["positionSize", "stopLoss"],
    category: "return",
  },

  // -------------------------------------------------------------------------
  // Risk-related diagnostics / 风险相关诊断
  // -------------------------------------------------------------------------
  {
    id: "high_drawdown",
    condition: (m) => m.riskMetrics.maxDrawdown > 25,
    severity: "error",
    message: "最大回撤超过25%",
    messageEn: "Maximum drawdown exceeds 25%",
    getValue: (m) => `${m.riskMetrics.maxDrawdown.toFixed(2)}%`,
    suggestion: "回撤过大，建议降低单笔仓位或加强止损设置",
    suggestionEn:
      "Excessive drawdown, reduce position size or strengthen stop-loss",
    relatedParams: ["stopLoss", "positionSize"],
    category: "risk",
  },
  {
    id: "very_high_drawdown",
    condition: (m) => m.riskMetrics.maxDrawdown > 40,
    severity: "error",
    message: "最大回撤超过40%，风险极高",
    messageEn: "Maximum drawdown exceeds 40%, extremely high risk",
    getValue: (m) => `${m.riskMetrics.maxDrawdown.toFixed(2)}%`,
    suggestion: "严重风险警告！建议立即添加止损机制，考虑减半仓位",
    suggestionEn:
      "Severe risk warning! Add stop-loss mechanism immediately, consider halving position",
    relatedParams: ["stopLoss", "positionSize"],
    category: "risk",
  },
  {
    id: "long_drawdown_duration",
    condition: (m) => m.riskMetrics.maxDrawdownDuration > 60,
    severity: "warning",
    message: "回撤持续时间过长",
    messageEn: "Drawdown duration too long",
    getValue: (m) => `${m.riskMetrics.maxDrawdownDuration}天`,
    suggestion: "恢复能力较弱，建议检查策略在不同市场环境下的适应性",
    suggestionEn:
      "Weak recovery, check strategy adaptability in different market conditions",
    category: "risk",
  },
  {
    id: "low_sharpe",
    condition: (m) =>
      m.riskMetrics.sharpeRatio < 0.5 && m.returnMetrics.totalReturn > 0,
    severity: "warning",
    message: "夏普比率偏低",
    messageEn: "Low Sharpe ratio",
    getValue: (m) => m.riskMetrics.sharpeRatio.toFixed(2),
    suggestion: "风险调整收益不佳，建议优化策略以提高收益稳定性",
    suggestionEn:
      "Poor risk-adjusted returns, optimize strategy for more stable returns",
    category: "risk",
  },
  {
    id: "negative_sharpe",
    condition: (m) => m.riskMetrics.sharpeRatio < 0,
    severity: "error",
    message: "夏普比率为负",
    messageEn: "Negative Sharpe ratio",
    getValue: (m) => m.riskMetrics.sharpeRatio.toFixed(2),
    suggestion: "策略风险收益比极差，建议重新设计策略",
    suggestionEn: "Extremely poor risk-reward ratio, redesign strategy",
    category: "risk",
  },
  {
    id: "low_calmar",
    condition: (m) =>
      m.riskMetrics.calmarRatio < 0.5 && m.returnMetrics.totalReturn > 0,
    severity: "info",
    message: "卡玛比率偏低",
    messageEn: "Low Calmar ratio",
    getValue: (m) => m.riskMetrics.calmarRatio.toFixed(2),
    suggestion: "相对回撤的收益较低，可考虑优化回撤控制",
    suggestionEn:
      "Low return relative to drawdown, consider optimizing drawdown control",
    category: "risk",
  },

  // -------------------------------------------------------------------------
  // Trading-related diagnostics / 交易相关诊断
  // -------------------------------------------------------------------------
  {
    id: "low_win_rate",
    condition: (m) =>
      m.tradingMetrics.winRate < 45 && m.tradingMetrics.profitFactor < 1.2,
    severity: "warning",
    message: "胜率和盈亏比均较低",
    messageEn: "Both win rate and profit factor are low",
    getValue: (m) =>
      `胜率 ${m.tradingMetrics.winRate.toFixed(1)}%, 盈亏比 ${m.tradingMetrics.profitFactor.toFixed(2)}`,
    suggestion: "建议提高信号阈值或增加过滤条件",
    suggestionEn: "Increase signal threshold or add filter conditions",
    relatedParams: ["entryCondition", "threshold"],
    category: "trading",
  },
  {
    id: "very_low_win_rate",
    condition: (m) => m.tradingMetrics.winRate < 30,
    severity: "error",
    message: "胜率过低",
    messageEn: "Win rate too low",
    getValue: (m) => `${m.tradingMetrics.winRate.toFixed(1)}%`,
    suggestion: "胜率低于30%，需要极高的盈亏比才能盈利，建议审视入场条件",
    suggestionEn:
      "Win rate below 30%, requires very high profit factor, review entry conditions",
    relatedParams: ["entryCondition"],
    category: "trading",
  },
  {
    id: "few_trades",
    condition: (m) => m.tradingMetrics.totalTrades < 20,
    severity: "info",
    message: "交易次数较少，统计意义有限",
    messageEn: "Few trades, limited statistical significance",
    getValue: (m) => `${m.tradingMetrics.totalTrades}笔`,
    suggestion: "建议扩大回测时间范围或增加标的数量",
    suggestionEn: "Extend backtest period or increase number of symbols",
    category: "trading",
  },
  {
    id: "high_frequency",
    condition: (m) =>
      m.tradingMetrics.avgHoldingDays < 2 && m.tradingMetrics.totalTrades > 100,
    severity: "warning",
    message: "交易频率过高",
    messageEn: "Trading frequency too high",
    getValue: (m) =>
      `平均持仓 ${m.tradingMetrics.avgHoldingDays.toFixed(1)}天, ${m.tradingMetrics.totalTrades}笔交易`,
    suggestion: "高频交易成本较大，建议优化入场条件减少交易次数",
    suggestionEn:
      "High-frequency trading costs are high, optimize entry to reduce trades",
    relatedParams: ["entryCondition", "holdingPeriod"],
    category: "trading",
  },
  {
    id: "high_consecutive_losses",
    condition: (m) => m.tradingMetrics.maxConsecutiveLosses >= 6,
    severity: "warning",
    message: "最大连续亏损次数较多",
    messageEn: "High maximum consecutive losses",
    getValue: (m) => `${m.tradingMetrics.maxConsecutiveLosses}次`,
    suggestion: "连续亏损可能影响交易心理，建议增加风控措施",
    suggestionEn:
      "Consecutive losses may affect trading psychology, add risk controls",
    relatedParams: ["stopLoss", "maxLossLimit"],
    category: "trading",
  },
  {
    id: "large_single_loss",
    condition: (m) => Math.abs(m.tradingMetrics.maxSingleLoss) > 10,
    severity: "warning",
    message: "单笔最大亏损过大",
    messageEn: "Single trade loss too large",
    getValue: (m) => `${m.tradingMetrics.maxSingleLoss.toFixed(2)}%`,
    suggestion: "单笔亏损超过10%，建议设置止损保护",
    suggestionEn: "Single loss exceeds 10%, set stop-loss protection",
    relatedParams: ["stopLoss"],
    category: "trading",
  },
  {
    id: "low_profit_factor",
    condition: (m) =>
      m.tradingMetrics.profitFactor < 1 && m.tradingMetrics.profitFactor > 0,
    severity: "error",
    message: "盈亏比小于1",
    messageEn: "Profit factor below 1",
    getValue: (m) => m.tradingMetrics.profitFactor.toFixed(2),
    suggestion: "总盈利小于总亏损，策略长期必然亏损，需要彻底重构",
    suggestionEn:
      "Total profit less than total loss, strategy will lose long-term, needs redesign",
    category: "trading",
  },

  // -------------------------------------------------------------------------
  // General diagnostics / 通用诊断
  // -------------------------------------------------------------------------
  {
    id: "overfit_risk",
    condition: (m) =>
      m.riskMetrics.sharpeRatio > 2.5 && m.tradingMetrics.totalTrades < 20,
    severity: "info",
    message: "可能存在过拟合风险",
    messageEn: "Potential overfitting risk",
    getValue: (m) =>
      `夏普 ${m.riskMetrics.sharpeRatio.toFixed(2)}, ${m.tradingMetrics.totalTrades}笔交易`,
    suggestion: "夏普比率优秀但交易次数过少，建议扩大回测时间范围验证",
    suggestionEn:
      "Excellent Sharpe but few trades, expand backtest period for validation",
    category: "general",
  },
  {
    id: "imbalanced_trades",
    condition: (m) =>
      m.tradingMetrics.avgWin > 0 &&
      m.tradingMetrics.avgLoss < 0 &&
      Math.abs(m.tradingMetrics.avgWin / m.tradingMetrics.avgLoss) > 5,
    severity: "info",
    message: "盈亏不对称",
    messageEn: "Asymmetric profit/loss",
    getValue: (m) =>
      `平均盈利 ${m.tradingMetrics.avgWin.toFixed(2)}%, 平均亏损 ${m.tradingMetrics.avgLoss.toFixed(2)}%`,
    suggestion: "盈亏比例失衡，可能是止损设置过紧或持仓时间不一致",
    suggestionEn:
      "Imbalanced profit/loss ratio, may indicate tight stop-loss or inconsistent holding periods",
    category: "general",
  },
];

// =============================================================================
// HIGHLIGHT RULES / 亮点规则
// =============================================================================

const highlightRules: HighlightRule[] = [
  {
    id: "excellent_sharpe",
    condition: (m) => m.riskMetrics.sharpeRatio > 1.5,
    message: "夏普比率优秀",
    messageEn: "Excellent Sharpe ratio",
    getValue: (m) => m.riskMetrics.sharpeRatio.toFixed(2),
  },
  {
    id: "good_drawdown_control",
    condition: (m) =>
      m.riskMetrics.maxDrawdown < 10 && m.returnMetrics.totalReturn > 0,
    message: "回撤控制良好",
    messageEn: "Good drawdown control",
    getValue: (m) => `${m.riskMetrics.maxDrawdown.toFixed(2)}%`,
  },
  {
    id: "high_win_rate",
    condition: (m) => m.tradingMetrics.winRate > 65,
    message: "胜率较高",
    messageEn: "High win rate",
    getValue: (m) => `${m.tradingMetrics.winRate.toFixed(1)}%`,
  },
  {
    id: "positive_alpha",
    condition: (m) =>
      m.returnMetrics.alpha !== undefined && m.returnMetrics.alpha > 5,
    message: "超额收益明显",
    messageEn: "Significant alpha",
    getValue: (m) => `+${m.returnMetrics.alpha?.toFixed(2)}%`,
  },
  {
    id: "strong_annualized",
    condition: (m) => m.returnMetrics.annualizedReturn > 0.2,
    message: "年化收益可观",
    messageEn: "Strong annualized return",
    getValue: (m) => `${(m.returnMetrics.annualizedReturn * 100).toFixed(2)}%`,
  },
  {
    id: "high_profit_factor",
    condition: (m) => m.tradingMetrics.profitFactor > 2,
    message: "盈亏比出色",
    messageEn: "Excellent profit factor",
    getValue: (m) => m.tradingMetrics.profitFactor.toFixed(2),
  },
  {
    id: "consistent_returns",
    condition: (m) =>
      m.returnMetrics.returnVolatility < 0.1 &&
      m.returnMetrics.totalReturn > 0.1,
    message: "收益稳定性好",
    messageEn: "Consistent returns",
    getValue: (m) => `波动率 ${(m.returnMetrics.returnVolatility * 100).toFixed(2)}%`,
  },
  {
    id: "good_calmar",
    condition: (m) => m.riskMetrics.calmarRatio > 2,
    message: "卡玛比率优秀",
    messageEn: "Excellent Calmar ratio",
    getValue: (m) => m.riskMetrics.calmarRatio.toFixed(2),
  },
];

// =============================================================================
// DIAGNOSTIC ENGINE / 诊断引擎
// =============================================================================

/**
 * Calculate overall health score based on metrics
 * 根据指标计算整体健康分数
 */
function calculateHealthScore(input: DiagnosticInput): number {
  let score = 70; // Base score (基础分)

  // Return factor (收益因素)
  if (input.returnMetrics.totalReturn > 0.2) score += 10;
  else if (input.returnMetrics.totalReturn > 0.1) score += 5;
  else if (input.returnMetrics.totalReturn < 0) score -= 15;
  else if (input.returnMetrics.totalReturn < 0.05) score -= 5;

  // Risk factor (风险因素)
  if (input.riskMetrics.maxDrawdown < 10) score += 10;
  else if (input.riskMetrics.maxDrawdown < 20) score += 5;
  else if (input.riskMetrics.maxDrawdown > 30) score -= 15;
  else if (input.riskMetrics.maxDrawdown > 25) score -= 10;

  // Sharpe factor (夏普因素)
  if (input.riskMetrics.sharpeRatio > 2) score += 10;
  else if (input.riskMetrics.sharpeRatio > 1) score += 5;
  else if (input.riskMetrics.sharpeRatio < 0.5) score -= 10;
  else if (input.riskMetrics.sharpeRatio < 0) score -= 20;

  // Trading factor (交易因素)
  if (input.tradingMetrics.winRate > 60) score += 5;
  else if (input.tradingMetrics.winRate < 40) score -= 5;

  if (input.tradingMetrics.profitFactor > 2) score += 5;
  else if (input.tradingMetrics.profitFactor < 1) score -= 15;

  // Statistical significance (统计显著性)
  if (input.tradingMetrics.totalTrades < 10) score -= 10;
  else if (input.tradingMetrics.totalTrades < 20) score -= 5;

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine risk level based on metrics
 * 根据指标确定风险级别
 */
function determineRiskLevel(
  input: DiagnosticInput
): "low" | "medium" | "high" {
  const hasHighDrawdown = input.riskMetrics.maxDrawdown > 25;
  const hasNegativeSharpe = input.riskMetrics.sharpeRatio < 0;
  const hasLowWinRate = input.tradingMetrics.winRate < 35;
  const hasNegativeReturn = input.returnMetrics.totalReturn < 0;
  const hasLowProfitFactor = input.tradingMetrics.profitFactor < 1;

  const riskFactors = [
    hasHighDrawdown,
    hasNegativeSharpe,
    hasLowWinRate,
    hasNegativeReturn,
    hasLowProfitFactor,
  ].filter(Boolean).length;

  if (riskFactors >= 3) return "high";
  if (riskFactors >= 1) return "medium";
  return "low";
}

/**
 * Run diagnostic analysis on backtest results
 * 对回测结果运行诊断分析
 *
 * @param input - Metrics from backtest result (回测结果指标)
 * @returns Diagnostic report (诊断报告)
 */
export function runDiagnostics(input: DiagnosticInput): DiagnosticReport {
  const issues: DiagnosticItem[] = [];
  const highlights: StrategyHighlight[] = [];

  // Evaluate diagnostic rules (评估诊断规则)
  for (const rule of diagnosticRules) {
    if (rule.condition(input)) {
      issues.push({
        id: rule.id,
        severity: rule.severity,
        message: rule.message,
        messageEn: rule.messageEn,
        currentValue: rule.getValue(input),
        suggestion: rule.suggestion,
        relatedParams: rule.relatedParams,
      });
    }
  }

  // Evaluate highlight rules (评估亮点规则)
  for (const rule of highlightRules) {
    if (rule.condition(input)) {
      highlights.push({
        id: rule.id,
        message: rule.message,
        messageEn: rule.messageEn,
        value: rule.getValue(input),
      });
    }
  }

  // Sort issues by severity (按严重程度排序)
  const severityOrder: Record<DiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    timestamp: Date.now(),
    issues,
    highlights,
    overallScore: calculateHealthScore(input),
    riskLevel: determineRiskLevel(input),
  };
}

/**
 * Get diagnostic summary text
 * 获取诊断摘要文本
 */
export function getDiagnosticSummary(report: DiagnosticReport): {
  zh: string;
  en: string;
} {
  const errorCount = report.issues.filter((i) => i.severity === "error").length;
  const warningCount = report.issues.filter(
    (i) => i.severity === "warning"
  ).length;
  const highlightCount = report.highlights.length;

  const zhParts: string[] = [];
  const enParts: string[] = [];

  if (errorCount > 0) {
    zhParts.push(`${errorCount}个严重问题`);
    enParts.push(`${errorCount} critical issue${errorCount > 1 ? "s" : ""}`);
  }
  if (warningCount > 0) {
    zhParts.push(`${warningCount}个警告`);
    enParts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);
  }
  if (highlightCount > 0) {
    zhParts.push(`${highlightCount}个亮点`);
    enParts.push(`${highlightCount} highlight${highlightCount > 1 ? "s" : ""}`);
  }

  return {
    zh:
      zhParts.length > 0
        ? `发现 ${zhParts.join("、")}，健康度 ${report.overallScore}/100`
        : `策略健康度 ${report.overallScore}/100，无明显问题`,
    en:
      enParts.length > 0
        ? `Found ${enParts.join(", ")}, health score ${report.overallScore}/100`
        : `Strategy health score ${report.overallScore}/100, no significant issues`,
  };
}

/**
 * Filter diagnostics by category
 * 按分类过滤诊断
 */
export function filterDiagnosticsByCategory(
  report: DiagnosticReport,
  category: "return" | "risk" | "trading" | "general"
): DiagnosticItem[] {
  const categoryRules = new Set(
    diagnosticRules.filter((r) => r.category === category).map((r) => r.id)
  );
  return report.issues.filter((i) => categoryRules.has(i.id));
}

/**
 * Get most critical issues
 * 获取最关键的问题
 */
export function getMostCriticalIssues(
  report: DiagnosticReport,
  maxCount: number = 3
): DiagnosticItem[] {
  return report.issues.slice(0, maxCount);
}

// Export rules for testing / 导出规则供测试使用
export { diagnosticRules, highlightRules };
