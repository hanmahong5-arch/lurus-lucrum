"use client";

/**
 * Backtest Diagnostic Panel Component
 * 回测诊断面板组件
 *
 * Displays intelligent diagnostic results and suggestions
 * 展示智能诊断结果和建议
 */

import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Lightbulb,
  TrendingUp,
  Shield,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  DiagnosticReport,
  DiagnosticItem,
  DiagnosticSeverity,
  StrategyHighlight,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
} from "@/lib/backtest/types";
import {
  runDiagnostics,
  type DiagnosticInput,
} from "@/lib/backtest/diagnostics";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface DiagnosticPanelProps {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
  className?: string;
  onParamAdjust?: (paramName: string) => void;
}

interface DiagnosticIssueProps {
  issue: DiagnosticItem;
  onParamClick?: (param: string) => void;
}

interface HighlightItemProps {
  highlight: StrategyHighlight;
}

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

function getSeverityIcon(severity: DiagnosticSeverity) {
  switch (severity) {
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "info":
      return <Info className="h-5 w-5 text-blue-500" />;
  }
}

function getSeverityStyles(severity: DiagnosticSeverity) {
  switch (severity) {
    case "error":
      return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30";
    case "warning":
      return "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30";
    case "info":
      return "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30";
  }
}

function getSeverityBadgeVariant(severity: DiagnosticSeverity) {
  switch (severity) {
    case "error":
      return "danger" as const;
    case "warning":
      return "warning" as const;
    case "info":
      return "secondary" as const;
  }
}

function getRiskLevelColor(riskLevel: "low" | "medium" | "high") {
  switch (riskLevel) {
    case "low":
      return "text-green-600";
    case "medium":
      return "text-yellow-600";
    case "high":
      return "text-red-600";
  }
}

function getRiskLevelLabel(riskLevel: "low" | "medium" | "high") {
  switch (riskLevel) {
    case "low":
      return "低风险";
    case "medium":
      return "中等风险";
    case "high":
      return "高风险";
  }
}

// =============================================================================
// DIAGNOSTIC ISSUE COMPONENT / 诊断问题组件
// =============================================================================

function DiagnosticIssue({ issue, onParamClick }: DiagnosticIssueProps) {
  return (
    <div
      className={cn("p-4 rounded-lg border", getSeverityStyles(issue.severity))}
    >
      <div className="flex items-start gap-3">
        {getSeverityIcon(issue.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{issue.message}</span>
            <Badge
              variant={getSeverityBadgeVariant(issue.severity)}
              className="text-xs"
            >
              {issue.severity === "error"
                ? "严重"
                : issue.severity === "warning"
                  ? "警告"
                  : "提示"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            当前值: <span className="font-mono">{issue.currentValue}</span>
          </div>
          <div className="flex items-start gap-2 mt-2 text-sm">
            <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <span>{issue.suggestion}</span>
          </div>
          {issue.relatedParams && issue.relatedParams.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">相关参数:</span>
              {issue.relatedParams.map((param) => (
                <Button
                  key={param}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onParamClick?.(param)}
                >
                  {param}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HIGHLIGHT ITEM COMPONENT / 亮点项组件
// =============================================================================

function HighlightItem({ highlight }: HighlightItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
      <div className="flex-1">
        <span className="font-medium text-green-800 dark:text-green-200">
          {highlight.message}
        </span>
        <span className="ml-2 font-mono text-green-600 dark:text-green-400">
          {highlight.value}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// HEALTH SCORE COMPONENT / 健康分数组件
// =============================================================================

interface HealthScoreProps {
  score: number;
  riskLevel: "low" | "medium" | "high";
}

function HealthScore({ score, riskLevel }: HealthScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-yellow-500";
    if (s >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "优秀";
    if (s >= 60) return "良好";
    if (s >= 40) return "一般";
    return "需改进";
  };

  return (
    <div className="flex items-center gap-6">
      {/* Score circle */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 264} 264`}
            className={cn(
              score >= 80
                ? "text-green-500"
                : score >= 60
                  ? "text-yellow-500"
                  : score >= 40
                    ? "text-orange-500"
                    : "text-red-500",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{score}</span>
          <span className="text-xs text-muted-foreground">分</span>
        </div>
      </div>

      {/* Score details */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <span className="font-medium text-lg">策略健康度</span>
          <Badge
            variant={
              score >= 80 ? "success" : score >= 60 ? "warning" : "danger"
            }
          >
            {getScoreLabel(score)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          <span className="text-muted-foreground">风险等级:</span>
          <span className={cn("font-medium", getRiskLevelColor(riskLevel))}>
            {getRiskLevelLabel(riskLevel)}
          </span>
        </div>
        <Progress value={score} className={cn("h-2", getScoreColor(score))} />
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORY SUMMARY COMPONENT / 类别摘要组件
// =============================================================================

interface CategorySummaryProps {
  report: DiagnosticReport;
}

function CategorySummary({ report }: CategorySummaryProps) {
  const categoryCounts = useMemo(() => {
    const counts = {
      return: { errors: 0, warnings: 0, infos: 0 },
      risk: { errors: 0, warnings: 0, infos: 0 },
      trading: { errors: 0, warnings: 0, infos: 0 },
    };

    // Group issues by category (simplified mapping)
    for (const issue of report.issues) {
      let category: keyof typeof counts = "return";
      if (
        issue.id.includes("drawdown") ||
        issue.id.includes("sharpe") ||
        issue.id.includes("risk")
      ) {
        category = "risk";
      } else if (
        issue.id.includes("win") ||
        issue.id.includes("trade") ||
        issue.id.includes("frequency") ||
        issue.id.includes("profit")
      ) {
        category = "trading";
      }

      if (issue.severity === "error") counts[category].errors++;
      else if (issue.severity === "warning") counts[category].warnings++;
      else counts[category].infos++;
    }

    return counts;
  }, [report.issues]);

  const categories = [
    {
      key: "return" as const,
      label: "收益",
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      key: "risk" as const,
      label: "风险",
      icon: Shield,
      color: "text-blue-600",
    },
    {
      key: "trading" as const,
      label: "交易",
      icon: Activity,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {categories.map(({ key, label, icon: Icon, color }) => {
        const counts = categoryCounts[key];
        const total = counts.errors + counts.warnings + counts.infos;

        return (
          <div
            key={key}
            className="p-3 rounded-lg border bg-card flex items-center gap-3"
          >
            <Icon className={cn("h-5 w-5", color)} />
            <div className="flex-1">
              <div className="font-medium text-sm">{label}</div>
              <div className="flex gap-2 mt-1">
                {counts.errors > 0 && (
                  <Badge variant="danger" className="text-xs">
                    {counts.errors}
                  </Badge>
                )}
                {counts.warnings > 0 && (
                  <Badge variant="warning" className="text-xs">
                    {counts.warnings}
                  </Badge>
                )}
                {counts.infos > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {counts.infos}
                  </Badge>
                )}
                {total === 0 && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function DiagnosticPanel({
  returnMetrics,
  riskMetrics,
  tradingMetrics,
  className,
  onParamAdjust,
}: DiagnosticPanelProps) {
  // Run diagnostics
  const report = useMemo<DiagnosticReport>(() => {
    const input: DiagnosticInput = {
      returnMetrics,
      riskMetrics,
      tradingMetrics,
    };
    return runDiagnostics(input);
  }, [returnMetrics, riskMetrics, tradingMetrics]);

  const errorCount = report.issues.filter((i) => i.severity === "error").length;
  const warningCount = report.issues.filter(
    (i) => i.severity === "warning",
  ).length;
  const infoCount = report.issues.filter((i) => i.severity === "info").length;

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            策略诊断报告 / Diagnostic Report
          </span>
          <div className="flex gap-2">
            {errorCount > 0 && (
              <Badge variant="danger">{errorCount}个严重</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="warning">{warningCount}个警告</Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary">{infoCount}个提示</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score */}
        <HealthScore score={report.overallScore} riskLevel={report.riskLevel} />

        {/* Category Summary */}
        <CategorySummary report={report} />

        {/* Highlights */}
        {report.highlights.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              策略亮点 ({report.highlights.length})
            </h3>
            <div className="space-y-2">
              {report.highlights.map((highlight) => (
                <HighlightItem key={highlight.id} highlight={highlight} />
              ))}
            </div>
          </div>
        )}

        {/* Issues */}
        {report.issues.length > 0 && (
          <Accordion type="single" collapsible defaultValue="issues">
            <AccordionItem value="issues">
              <AccordionTrigger className="font-medium">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  需要关注的问题 ({report.issues.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {report.issues.map((issue) => (
                    <DiagnosticIssue
                      key={issue.id}
                      issue={issue}
                      onParamClick={onParamAdjust}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* No issues state */}
        {report.issues.length === 0 && report.highlights.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <div className="font-medium">策略状态良好</div>
            <div className="text-sm text-muted-foreground">
              未发现明显问题，策略各项指标正常
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DiagnosticPanel;
