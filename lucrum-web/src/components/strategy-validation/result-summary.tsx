"use client";

/**
 * Strategy Validation Result Summary Component
 * 策略验证结果汇总组件
 *
 * Displays key metrics in card format: win rate, avg return, signal count, excess return
 * 以卡片形式展示关键指标：胜率、平均收益、信号数量、超额收益
 */

import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ValidationSummary {
  strategy: string;
  strategyName: string;
  sector: string;
  sectorName: string;
  totalStocks: number;
  stocksWithSignals: number;
  totalSignals: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
  maxReturn: number;
  minReturn: number;
  sectorIndexReturn: number;
  excessReturn: number;
  startDate: string;
  endDate: string;
  holdingDays: number;
  // Enhanced metrics / 增强指标
  sharpeRatio?: number;
  sortinoRatio?: number;
  maxDrawdown?: number;
  profitFactor?: number;
  // Status counts / 状态统计
  holdingSignals?: number;
  suspendedSignals?: number;
  cannotExecuteSignals?: number;
}

/**
 * Warning message type
 * 警告消息类型
 */
export interface ValidationWarning {
  type: "info" | "warning" | "error";
  message: string;
  messageEn?: string;
}

interface ResultSummaryProps {
  summary: ValidationSummary | null;
  warnings?: ValidationWarning[];
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function ResultSummary({
  summary,
  warnings = [],
  isLoading = false,
  className = "",
}: ResultSummaryProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="text-sm font-medium text-white">
              验证结果 / Validation Results
            </span>
          </div>
        </div>
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
          <span className="text-white/50">正在验证策略...</span>
          <span className="text-xs text-white/30 mt-1">
            Validating strategy...
          </span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!summary) {
    return (
      <div
        className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="text-sm font-medium text-white">
              验证结果 / Validation Results
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-white/40">
          <p>配置参数后点击"开始验证"</p>
          <p className="text-xs mt-1">Configure and click "Start Validation"</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}
      data-testid="result-summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="text-sm font-medium text-white">
            验证结果 / Validation Results
          </span>
        </div>
        <div className="text-xs text-white/40">
          {summary.startDate} ~ {summary.endDate}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Warnings Section */}
        {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

        {/* Signal Status Warnings (auto-generated from summary) */}
        {(summary.holdingSignals ||
          summary.suspendedSignals ||
          summary.cannotExecuteSignals) && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
              <span>⚠️</span>
              <span className="font-medium">
                信号状态提示 / Signal Status Notes
              </span>
            </div>
            <div className="space-y-1 text-xs text-white/60">
              {summary.holdingSignals && summary.holdingSignals > 0 && (
                <div>
                  • {summary.holdingSignals}{" "}
                  个信号仍在持有中（数据不足以计算出场）
                </div>
              )}
              {summary.suspendedSignals && summary.suspendedSignals > 0 && (
                <div>• {summary.suspendedSignals} 个信号因停牌延迟出场</div>
              )}
              {summary.cannotExecuteSignals &&
                summary.cannotExecuteSignals > 0 && (
                  <div>
                    • {summary.cannotExecuteSignals} 个信号因涨跌停无法执行
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Extreme Return Warning */}
        {(summary.maxReturn > 50 || summary.minReturn < -30) && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <span>🔥</span>
              <span className="font-medium">
                极端收益警告 / Extreme Return Warning
              </span>
            </div>
            <div className="text-xs text-white/60 mt-1">
              存在极端收益信号（最高 {summary.maxReturn.toFixed(1)}%, 最低{" "}
              {summary.minReturn.toFixed(1)}%），请注意风险
            </div>
          </div>
        )}

        {/* Strategy & Sector Info */}
        <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg border border-accent/20">
          <div>
            <span className="text-sm font-medium text-accent">
              {summary.strategyName}
            </span>
            <span className="text-white/40 mx-2">→</span>
            <span className="text-sm text-white">{summary.sectorName}</span>
          </div>
          <div className="text-xs text-white/40">
            持有 {summary.holdingDays} 天
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Win Rate */}
          <MetricCard
            label="胜率"
            labelEn="Win Rate"
            value={`${summary.winRate.toFixed(1)}%`}
            subtext={`${summary.stocksWithSignals}/${summary.totalStocks} 只股票有信号`}
            valueColor={summary.winRate >= 50 ? "text-profit" : "text-loss"}
            highlight
            icon="🎯"
            data-testid="win-rate"
          />

          {/* Average Return */}
          <MetricCard
            label="平均收益"
            labelEn="Avg Return"
            value={`${summary.avgReturn >= 0 ? "+" : ""}${summary.avgReturn.toFixed(2)}%`}
            subtext={`中位数: ${summary.medianReturn >= 0 ? "+" : ""}${summary.medianReturn.toFixed(2)}%`}
            valueColor={summary.avgReturn >= 0 ? "text-profit" : "text-loss"}
            highlight
            icon="💰"
          />

          {/* Total Signals */}
          <MetricCard
            label="信号数量"
            labelEn="Total Signals"
            value={summary.totalSignals.toString()}
            subtext={`平均每股 ${(summary.totalSignals / Math.max(summary.stocksWithSignals, 1)).toFixed(1)} 次`}
            valueColor="text-accent"
            icon="📊"
          />

          {/* Excess Return */}
          <MetricCard
            label="超额收益"
            labelEn="Excess Return"
            value={`${summary.excessReturn >= 0 ? "+" : ""}${summary.excessReturn.toFixed(2)}%`}
            subtext={`行业指数: ${summary.sectorIndexReturn >= 0 ? "+" : ""}${summary.sectorIndexReturn.toFixed(2)}%`}
            valueColor={summary.excessReturn >= 0 ? "text-profit" : "text-loss"}
            icon="🚀"
          />
        </div>

        {/* Return Range */}
        <div className="p-3 bg-primary/30 rounded-lg">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/50">收益范围 / Return Range</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Min Return */}
            <div className="flex-1 text-center p-2 bg-loss/10 rounded">
              <div className="text-xs text-white/40">最低</div>
              <div className="text-sm font-medium text-loss">
                {summary.minReturn.toFixed(2)}%
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex-[2] h-2 bg-white/10 rounded-full overflow-hidden relative">
              {/* Zero marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                style={{
                  left: `${Math.min(100, Math.max(0, (-summary.minReturn / (summary.maxReturn - summary.minReturn)) * 100))}%`,
                }}
              />
              {/* Average marker */}
              <div
                className={cn(
                  "absolute top-0 bottom-0 w-1 rounded",
                  summary.avgReturn >= 0 ? "bg-profit" : "bg-loss",
                )}
                style={{
                  left: `${Math.min(100, Math.max(0, ((summary.avgReturn - summary.minReturn) / (summary.maxReturn - summary.minReturn)) * 100))}%`,
                }}
              />
            </div>

            {/* Max Return */}
            <div className="flex-1 text-center p-2 bg-profit/10 rounded">
              <div className="text-xs text-white/40">最高</div>
              <div className="text-sm font-medium text-profit">
                +{summary.maxReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Performance Comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-primary/20 rounded-lg">
            <div className="text-xs text-white/40 mb-1">策略收益 vs 指数</div>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-lg font-bold",
                  summary.avgReturn >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {summary.avgReturn >= 0 ? "+" : ""}
                {summary.avgReturn.toFixed(2)}%
              </span>
              <span className="text-white/30">vs</span>
              <span
                className={cn(
                  "text-sm",
                  summary.sectorIndexReturn >= 0
                    ? "text-profit/70"
                    : "text-loss/70",
                )}
              >
                {summary.sectorIndexReturn >= 0 ? "+" : ""}
                {summary.sectorIndexReturn.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="p-3 bg-primary/20 rounded-lg">
            <div className="text-xs text-white/40 mb-1">策略表现评级</div>
            <div className="flex items-center gap-2">
              <PerformanceRating
                winRate={summary.winRate}
                excessReturn={summary.excessReturn}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

interface MetricCardProps {
  label: string;
  labelEn: string;
  value: string;
  subtext?: string;
  valueColor?: string;
  highlight?: boolean;
  icon?: string;
  "data-testid"?: string;
}

function MetricCard({
  label,
  labelEn,
  value,
  subtext,
  valueColor = "text-white",
  highlight = false,
  icon,
  "data-testid": testId,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg",
        highlight ? "bg-accent/10 border border-accent/30" : "bg-primary/30",
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs text-white/50">
          {label}
          <span className="block text-white/30">{labelEn}</span>
        </div>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <div className={cn("text-xl font-bold", valueColor)}>{value}</div>
      {subtext && <div className="text-xs text-white/40 mt-1">{subtext}</div>}
    </div>
  );
}

interface PerformanceRatingProps {
  winRate: number;
  excessReturn: number;
}

function PerformanceRating({ winRate, excessReturn }: PerformanceRatingProps) {
  // Calculate rating based on win rate and excess return
  // 根据胜率和超额收益计算评级
  let rating: "excellent" | "good" | "average" | "poor";
  let label: string;
  let labelEn: string;
  let emoji: string;

  if (winRate >= 60 && excessReturn >= 3) {
    rating = "excellent";
    label = "优秀";
    labelEn = "Excellent";
    emoji = "🌟";
  } else if (winRate >= 50 && excessReturn >= 1) {
    rating = "good";
    label = "良好";
    labelEn = "Good";
    emoji = "✅";
  } else if (winRate >= 45 && excessReturn >= 0) {
    rating = "average";
    label = "一般";
    labelEn = "Average";
    emoji = "⚠️";
  } else {
    rating = "poor";
    label = "较差";
    labelEn = "Poor";
    emoji = "❌";
  }

  const colorMap = {
    excellent: "text-accent",
    good: "text-profit",
    average: "text-yellow-500",
    poor: "text-loss",
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <span className={cn("text-lg font-bold", colorMap[rating])}>{label}</span>
      <span className="text-xs text-white/40">/ {labelEn}</span>
    </div>
  );
}

/**
 * Warnings panel component
 * 警告面板组件
 */
function WarningsPanel({ warnings }: { warnings: ValidationWarning[] }) {
  if (warnings.length === 0) return null;

  const iconMap = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
  };

  const colorMap = {
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
    },
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
    },
  };

  // Group warnings by type
  const hasErrors = warnings.some((w) => w.type === "error");
  const hasWarnings = warnings.some((w) => w.type === "warning");
  const primaryType = hasErrors ? "error" : hasWarnings ? "warning" : "info";
  const colors = colorMap[primaryType];

  return (
    <div className={cn("p-3 rounded-lg border", colors.bg, colors.border)}>
      <div className={cn("flex items-center gap-2 text-sm mb-2", colors.text)}>
        <span>{iconMap[primaryType]}</span>
        <span className="font-medium">
          {primaryType === "error"
            ? "错误提示 / Errors"
            : primaryType === "warning"
              ? "警告提示 / Warnings"
              : "信息提示 / Info"}
        </span>
      </div>
      <div className="space-y-1">
        {warnings.map((warning, index) => (
          <div
            key={index}
            className="flex items-start gap-2 text-xs text-white/60"
          >
            <span className="mt-0.5">{iconMap[warning.type]}</span>
            <div>
              <span>{warning.message}</span>
              {warning.messageEn && (
                <span className="text-white/40 ml-1">
                  / {warning.messageEn}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResultSummary;
