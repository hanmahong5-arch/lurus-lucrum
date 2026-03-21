"use client";

/**
 * Enhanced Backtest Result Dashboard Component
 * 增强回测结果仪表板组件
 *
 * Displays comprehensive backtest results with 4 categories of metrics
 * 展示包含4类指标的完整回测结果
 */

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getMetricRating,
  getMetricTooltip,
  RATING_DOT_CLASSES,
} from "@/lib/backtest/metric-rating";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import type {
  UnifiedBacktestResult,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
  StockBacktestResult,
} from "@/lib/backtest/types";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface ResultDashboardProps {
  result: UnifiedBacktestResult;
  className?: string;
  showDiagnostics?: boolean;
  onExport?: () => void;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
  tooltip?: string;
  /** Metric key for rating evaluation and tooltip lookup */
  metricKey?: string;
}

// =============================================================================
// METRIC CARD COMPONENT / 指标卡片组件
// =============================================================================

function MetricCard({
  label,
  value,
  unit = "",
  trend = "neutral",
  highlight = false,
  metricKey,
}: MetricCardProps) {
  const numericValue =
    typeof value === "number" ? value : parseFloat(String(value));
  const rating =
    metricKey && !isNaN(numericValue)
      ? getMetricRating(metricKey, numericValue)
      : undefined;
  const tooltipText = metricKey ? getMetricTooltip(metricKey) : undefined;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card",
        highlight && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        {rating && (
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
              RATING_DOT_CLASSES[rating],
            )}
            aria-label={`Rating: ${rating}`}
          />
        )}
        {metricKey ? (
          <SmartTooltip term={metricKey}>
            <span className="truncate">{label}</span>
          </SmartTooltip>
        ) : tooltipText ? (
          <>
            <span className="truncate">{label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-xl font-semibold font-mono tabular-nums",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600",
          )}
        >
          {typeof value === "number" ? value.toFixed(2) : value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        {trend === "up" && (
          <ArrowUpRight className="h-4 w-4 text-green-600 ml-1" />
        )}
        {trend === "down" && (
          <ArrowDownRight className="h-4 w-4 text-red-600 ml-1" />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// RETURN METRICS SECTION / 收益指标区块
// =============================================================================

interface ReturnMetricsSectionProps {
  metrics: ReturnMetrics;
}

function ReturnMetricsSection({ metrics }: ReturnMetricsSectionProps) {
  const totalReturnTrend = metrics.totalReturn >= 0 ? "up" : "down";
  const annualizedTrend = metrics.annualizedReturn >= 0 ? "up" : "down";
  const alphaTrend =
    metrics.alpha !== undefined
      ? metrics.alpha >= 0
        ? "up"
        : "down"
      : "neutral";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          收益指标 / Return Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <MetricCard
            label="总收益率"
            value={metrics.totalReturn}
            unit="%"
            trend={totalReturnTrend}
            highlight
            metricKey="totalReturn"
          />
          <MetricCard
            label="年化收益率"
            value={metrics.annualizedReturn}
            unit="%"
            trend={annualizedTrend}
            metricKey="annualizedReturn"
          />
          {metrics.alpha !== undefined && (
            <MetricCard
              label="超额收益(Alpha)"
              value={metrics.alpha}
              unit="%"
              trend={alphaTrend}
              metricKey="alpha"
            />
          )}
          <MetricCard
            label="收益波动率"
            value={(metrics.returnVolatility * 100).toFixed(2)}
            unit="%"
            metricKey="returnVolatility"
          />
          {metrics.bestMonth !== undefined && (
            <MetricCard
              label="最佳月度"
              value={metrics.bestMonth}
              unit="%"
              trend="up"
            />
          )}
          {metrics.worstMonth !== undefined && (
            <MetricCard
              label="最差月度"
              value={metrics.worstMonth}
              unit="%"
              trend="down"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// RISK METRICS SECTION / 风险指标区块
// =============================================================================

interface RiskMetricsSectionProps {
  metrics: RiskMetrics;
}

function RiskMetricsSection({ metrics }: RiskMetricsSectionProps) {
  const sharpeTrend =
    metrics.sharpeRatio >= 1
      ? "up"
      : metrics.sharpeRatio < 0
        ? "down"
        : "neutral";
  const drawdownSeverity =
    metrics.maxDrawdown > 25
      ? "error"
      : metrics.maxDrawdown > 15
        ? "warning"
        : "ok";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          风险指标 / Risk Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <MetricCard
            label="最大回撤"
            value={-metrics.maxDrawdown}
            unit="%"
            trend="down"
            highlight={drawdownSeverity === "error"}
            metricKey="maxDrawdown"
          />
          <MetricCard
            label="回撤持续天数"
            value={metrics.maxDrawdownDuration}
            unit="天"
            metricKey="maxDrawdownDuration"
          />
          <MetricCard
            label="夏普比率"
            value={metrics.sharpeRatio}
            trend={sharpeTrend}
            highlight
            metricKey="sharpeRatio"
          />
          <MetricCard
            label="索提诺比率"
            value={metrics.sortinoRatio}
            trend={metrics.sortinoRatio >= 1.5 ? "up" : "neutral"}
            metricKey="sortinoRatio"
          />
          <MetricCard
            label="卡玛比率"
            value={metrics.calmarRatio}
            trend={metrics.calmarRatio >= 1 ? "up" : "neutral"}
            metricKey="calmarRatio"
          />
          {metrics.var95 !== undefined && (
            <MetricCard label="VaR (95%)" value={-metrics.var95} unit="%" metricKey="var95" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// TRADING METRICS SECTION / 交易指标区块
// =============================================================================

interface TradingMetricsSectionProps {
  metrics: TradingMetrics;
}

function TradingMetricsSection({ metrics }: TradingMetricsSectionProps) {
  const winRateTrend =
    metrics.winRate >= 55 ? "up" : metrics.winRate < 45 ? "down" : "neutral";
  const profitFactorTrend =
    metrics.profitFactor >= 1.5
      ? "up"
      : metrics.profitFactor < 1
        ? "down"
        : "neutral";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-600" />
          交易指标 / Trading Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <MetricCard
            label="胜率"
            value={metrics.winRate}
            unit="%"
            trend={winRateTrend}
            highlight
            metricKey="winRate"
          />
          <MetricCard
            label="盈亏比"
            value={metrics.profitFactor}
            trend={profitFactorTrend}
            highlight
            metricKey="profitFactor"
          />
          <MetricCard
            label="总交易次数"
            value={metrics.totalTrades}
            unit="笔"
            metricKey="totalTrades"
          />
          <MetricCard
            label="平均持仓天数"
            value={metrics.avgHoldingDays}
            unit="天"
            metricKey="avgHoldingDays"
          />
          <MetricCard
            label="最大连胜"
            value={metrics.maxConsecutiveWins}
            unit="次"
            metricKey="maxConsecutiveWins"
          />
          <MetricCard
            label="最大连亏"
            value={metrics.maxConsecutiveLosses}
            unit="次"
            trend={metrics.maxConsecutiveLosses >= 5 ? "down" : "neutral"}
            metricKey="maxConsecutiveLosses"
          />
        </div>

        {/* Additional trading details */}
        <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground">盈利笔数</div>
            <div className="font-medium text-green-600">
              {metrics.winningTrades}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">亏损笔数</div>
            <div className="font-medium text-red-600">
              {metrics.losingTrades}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">平均盈利</div>
            <div className="font-medium text-green-600">
              +{metrics.avgWin.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">平均亏损</div>
            <div className="font-medium text-red-600">
              {metrics.avgLoss.toFixed(2)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// DIAGNOSTIC SECTION / 诊断指标区块
// =============================================================================

interface DiagnosticSectionProps {
  metrics: {
    returnMetrics: ReturnMetrics;
    riskMetrics: RiskMetrics;
    tradingMetrics: TradingMetrics;
  };
}

function DiagnosticSection({ metrics }: DiagnosticSectionProps) {
  const { tradingMetrics, riskMetrics } = metrics;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-orange-600" />
          诊断指标 / Diagnostic Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <MetricCard label="盈利因子" value={tradingMetrics.profitFactor} metricKey="profitFactor" />
          <MetricCard
            label="月均交易"
            value={tradingMetrics.tradingFrequency}
            unit="笔"
          />
          <MetricCard
            label="最大单笔盈利"
            value={tradingMetrics.maxSingleWin}
            unit="%"
            trend="up"
            metricKey="maxSingleWin"
          />
          <MetricCard
            label="最大单笔亏损"
            value={tradingMetrics.maxSingleLoss}
            unit="%"
            trend="down"
            metricKey="maxSingleLoss"
          />
          {riskMetrics.drawdownRecoveryDays !== undefined && (
            <MetricCard
              label="回撤恢复天数"
              value={riskMetrics.drawdownRecoveryDays}
              unit="天"
            />
          )}
          {riskMetrics.cvar !== undefined && (
            <MetricCard label="CVaR" value={-riskMetrics.cvar} unit="%" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// STOCK RANKING TABLE / 个股排名表格
// =============================================================================

interface StockRankingTableProps {
  stocks: StockBacktestResult[];
  title?: string;
  maxRows?: number;
}

function StockRankingTable({
  stocks,
  title = "个股表现排名",
  maxRows = 10,
}: StockRankingTableProps) {
  const [expanded, setExpanded] = useState(false);
  const displayStocks = expanded ? stocks : stocks.slice(0, maxRows);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline">{stocks.length}只</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">排名</TableHead>
              <TableHead>股票</TableHead>
              <TableHead className="text-right">收益率</TableHead>
              <TableHead className="text-right hidden sm:table-cell">胜率</TableHead>
              <TableHead className="text-right hidden sm:table-cell">交易数</TableHead>
              <TableHead className="text-right hidden md:table-cell">贡献度</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayStocks.map((stock, index) => (
              <TableRow key={stock.symbol}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{stock.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {stock.symbol}
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    stock.totalReturn >= 0 ? "text-green-600" : "text-red-600",
                  )}
                >
                  {stock.totalReturn >= 0 ? "+" : ""}
                  {stock.totalReturn.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell">
                  {stock.winRate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell">{stock.tradeCount}</TableCell>
                <TableCell className="text-right hidden md:table-cell">
                  {stock.contribution.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {stocks.length > maxRows && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  查看全部 ({stocks.length}只)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function ResultDashboard({
  result,
  className,
  showDiagnostics = true,
  onExport,
}: ResultDashboardProps) {
  const {
    returnMetrics,
    riskMetrics,
    tradingMetrics,
    sectorResult,
    stockResults,
    target,
  } = result;

  // Calculate summary badge
  const summaryBadge = useMemo(() => {
    if (returnMetrics.totalReturn > 20 && riskMetrics.sharpeRatio > 1.5) {
      return { label: "优秀", variant: "success" as const };
    } else if (returnMetrics.totalReturn > 0 && riskMetrics.sharpeRatio > 0.5) {
      return { label: "良好", variant: "secondary" as const };
    } else if (returnMetrics.totalReturn < 0) {
      return { label: "亏损", variant: "danger" as const };
    }
    return { label: "一般", variant: "outline" as const };
  }, [returnMetrics, riskMetrics]);

  // Warnings check
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (riskMetrics.maxDrawdown > 25) {
      list.push("最大回撤超过25%");
    }
    if (tradingMetrics.winRate < 40) {
      list.push("胜率低于40%");
    }
    if (tradingMetrics.totalTrades < 20) {
      list.push("交易次数较少，统计意义有限");
    }
    if (riskMetrics.sharpeRatio < 0) {
      list.push("夏普比率为负");
    }
    return list;
  }, [riskMetrics, tradingMetrics]);

  return (
    <TooltipProvider>
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-base sm:text-lg font-semibold">回测结果</h2>
          <Badge variant={summaryBadge.variant}>{summaryBadge.label}</Badge>
          {target.mode === "sector" && target.sector && (
            <Badge variant="outline">{target.sector.name}</Badge>
          )}
          {target.mode === "stock" && target.stock && (
            <Badge variant="outline">{target.stock.name}</Badge>
          )}
          {target.mode === "portfolio" && target.portfolio && (
            <Badge variant="outline">
              {target.portfolio.name} ({target.portfolio.stocks.length}只)
            </Badge>
          )}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-yellow-800 dark:text-yellow-200">
                风险提示
              </div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 list-disc list-inside">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Four metrics sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReturnMetricsSection metrics={returnMetrics} />
        <RiskMetricsSection metrics={riskMetrics} />
        <TradingMetricsSection metrics={tradingMetrics} />
        {showDiagnostics && (
          <DiagnosticSection
            metrics={{ returnMetrics, riskMetrics, tradingMetrics }}
          />
        )}
      </div>

      {/* Sector-specific: Stock ranking table */}
      {target.mode === "sector" &&
        sectorResult &&
        sectorResult.stockResults.length > 0 && (
          <StockRankingTable stocks={sectorResult.stockResults} />
        )}

      {/* Portfolio-specific: Stock results */}
      {target.mode === "portfolio" &&
        stockResults &&
        stockResults.length > 0 && (
          <StockRankingTable stocks={stockResults} title="组合内股票表现" />
        )}
    </div>
    </TooltipProvider>
  );
}

export default ResultDashboard;
