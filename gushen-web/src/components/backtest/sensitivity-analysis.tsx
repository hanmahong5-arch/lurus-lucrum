"use client";

/**
 * Parameter Sensitivity Analysis Component
 * 参数敏感性分析组件
 *
 * Displays single and dual parameter sensitivity analysis results
 * 展示单参数和双参数敏感性分析结果
 */

import { useMemo, useState } from "react";
import {
  Activity,
  TrendingUp,
  Target,
  Sliders,
  Info,
  Star,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  SensitivityReport,
  SingleParameterSensitivity,
  DualParameterSensitivity,
  HeatmapCell,
} from "@/lib/backtest/types";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface SensitivityAnalysisProps {
  report?: SensitivityReport;
  className?: string;
  onParameterSelect?: (paramName: string, value: number) => void;
}

interface SingleParamChartProps {
  data: SingleParameterSensitivity;
  onValueSelect?: (value: number) => void;
}

interface HeatmapChartProps {
  data: DualParameterSensitivity;
  onCellSelect?: (param1: number, param2: number) => void;
}

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

function getReturnColor(value: number): string {
  if (value >= 20) return "bg-green-600";
  if (value >= 10) return "bg-green-500";
  if (value >= 5) return "bg-green-400";
  if (value >= 0) return "bg-green-300";
  if (value >= -5) return "bg-red-300";
  if (value >= -10) return "bg-red-400";
  return "bg-red-500";
}

function getReturnTextColor(value: number): string {
  if (value >= 10 || value <= -10) return "text-white";
  return "text-gray-900";
}

function getStabilityLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "非常稳定", color: "text-green-600" };
  if (score >= 60) return { label: "较稳定", color: "text-green-500" };
  if (score >= 40) return { label: "中等", color: "text-yellow-600" };
  return { label: "不稳定", color: "text-red-500" };
}

// =============================================================================
// SINGLE PARAMETER CHART / 单参数图表
// =============================================================================

function SingleParamChart({ data, onValueSelect }: SingleParamChartProps) {
  const { results, baseValue, optimalValue, paramLabel } = data;

  // Find max return for scaling
  const maxReturn = Math.max(...results.map((r) => Math.abs(r.totalReturn)));
  const scale = maxReturn > 0 ? 100 / maxReturn : 1;

  // Stability info
  const stability = getStabilityLabel(data.stabilityScore);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{paramLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            基准值: <span className="font-mono">{baseValue}</span>
          </span>
          <Badge variant="outline" className="gap-1">
            <Star className="h-3 w-3 text-yellow-500" />
            最优值: {optimalValue}
          </Badge>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48 border rounded-lg p-4 bg-muted/20">
        <div className="absolute inset-0 flex items-end justify-around p-4 pt-8">
          {results.map((point, index) => {
            const height = Math.abs(point.totalReturn) * scale;
            const isPositive = point.totalReturn >= 0;
            const isBase = point.paramValue === baseValue;
            const isOptimal = point.paramValue === optimalValue;

            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "relative flex flex-col items-center justify-end transition-all hover:opacity-80",
                        "w-8 cursor-pointer",
                      )}
                      style={{ height: "100%" }}
                      onClick={() => onValueSelect?.(point.paramValue)}
                    >
                      {/* Bar */}
                      <div
                        className={cn(
                          "w-6 rounded-t transition-all",
                          isPositive ? "bg-green-500" : "bg-red-500",
                          isOptimal && "ring-2 ring-yellow-400 ring-offset-1",
                        )}
                        style={{
                          height: `${height}%`,
                          minHeight: "4px",
                        }}
                      />
                      {/* Label */}
                      <div
                        className={cn(
                          "text-xs mt-1",
                          isBase
                            ? "font-bold text-blue-600"
                            : "text-muted-foreground",
                        )}
                      >
                        {point.paramValue}
                      </div>
                      {/* Optimal indicator */}
                      {isOptimal && (
                        <Star className="h-3 w-3 text-yellow-500 absolute -top-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm space-y-1">
                      <div>
                        {paramLabel}: {point.paramValue}
                      </div>
                      <div
                        className={cn(
                          "font-medium",
                          isPositive ? "text-green-500" : "text-red-500",
                        )}
                      >
                        收益率: {point.totalReturn >= 0 ? "+" : ""}
                        {point.totalReturn.toFixed(2)}%
                      </div>
                      <div>夏普: {point.sharpeRatio.toFixed(2)}</div>
                      <div>胜率: {point.winRate.toFixed(1)}%</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Zero line */}
        <div className="absolute left-4 right-4 top-1/2 border-t border-dashed border-gray-400" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="p-2 rounded bg-muted/50">
          <div className="text-muted-foreground">最优收益</div>
          <div className="font-medium text-green-600">
            +{data.optimalReturn.toFixed(2)}%
          </div>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="text-muted-foreground">稳定性</div>
          <div className={cn("font-medium", stability.color)}>
            {stability.label} ({data.stabilityScore})
          </div>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="text-muted-foreground">推荐范围</div>
          <div className="font-medium">{data.recommendation}</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HEATMAP CHART / 热力图
// =============================================================================

function HeatmapChart({ data, onCellSelect }: HeatmapChartProps) {
  const {
    param1Label,
    param1Values,
    param2Label,
    param2Values,
    heatmapData,
    optimalCombination,
  } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-purple-500" />
          <span className="font-medium">
            {param1Label} × {param2Label}
          </span>
        </div>
        <Badge variant="outline" className="gap-1">
          <Star className="h-3 w-3 text-yellow-500" />
          最优组合: ({optimalCombination.param1}, {optimalCombination.param2})
        </Badge>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-muted-foreground">
                {param1Label} \ {param2Label}
              </th>
              {param2Values.map((val) => (
                <th
                  key={val}
                  className="p-2 text-xs font-medium text-center min-w-[50px]"
                >
                  {val}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {param1Values.map((p1Val, rowIdx) => (
              <tr key={p1Val}>
                <td className="p-2 text-xs font-medium text-right">{p1Val}</td>
                {param2Values.map((p2Val, colIdx) => {
                  const cell = heatmapData[rowIdx]?.[colIdx];
                  if (!cell) return null;

                  const isOptimal = cell.isOptimal;
                  const returnVal = cell.totalReturn;

                  return (
                    <TooltipProvider key={p2Val}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={cn(
                              "p-2 text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary",
                              getReturnColor(returnVal),
                              getReturnTextColor(returnVal),
                              isOptimal && "ring-2 ring-yellow-400",
                            )}
                            onClick={() => onCellSelect?.(p1Val, p2Val)}
                          >
                            <div className="text-xs font-medium">
                              {returnVal >= 0 ? "+" : ""}
                              {returnVal.toFixed(1)}%
                            </div>
                            {isOptimal && (
                              <Star className="h-3 w-3 mx-auto mt-0.5" />
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm space-y-1">
                            <div>
                              {param1Label}: {p1Val}
                            </div>
                            <div>
                              {param2Label}: {p2Val}
                            </div>
                            <div
                              className={cn(
                                "font-medium",
                                returnVal >= 0
                                  ? "text-green-500"
                                  : "text-red-500",
                              )}
                            >
                              收益率: {returnVal >= 0 ? "+" : ""}
                              {returnVal.toFixed(2)}%
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>亏损</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-300 rounded" />
          <span>小盈</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>中盈</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded" />
          <span>大盈</span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <span>最优</span>
        </div>
      </div>

      {/* Optimal info */}
      <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">最优参数组合</span>
        </div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{param1Label}:</span>
            <span className="ml-2 font-mono font-medium">
              {optimalCombination.param1}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{param2Label}:</span>
            <span className="ml-2 font-mono font-medium">
              {optimalCombination.param2}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">预期收益:</span>
            <span className="ml-2 font-medium text-green-600">
              +{optimalCombination.return.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function SensitivityAnalysis({
  report,
  className,
  onParameterSelect,
}: SensitivityAnalysisProps) {
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

  // Get available single params
  const singleParams = report?.singleParams || [];
  const dualParams = report?.dualParams;

  // Selected single param data
  const selectedSingleParam = useMemo(() => {
    if (!selectedParam && singleParams.length > 0) {
      return singleParams[0];
    }
    return singleParams.find((p) => p.paramName === selectedParam);
  }, [selectedParam, singleParams]);

  // Handle no data
  if (!report || singleParams.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            参数敏感性分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sliders className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <div>暂无敏感性分析数据</div>
            <div className="text-sm mt-1">
              运行回测时启用敏感性分析选项以生成数据
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-blue-500" />
            参数敏感性分析 / Sensitivity Analysis
          </span>
          <Badge
            variant={
              report.parameterStability === "stable"
                ? "success"
                : report.parameterStability === "moderate"
                  ? "warning"
                  : "danger"
            }
          >
            {report.parameterStability === "stable"
              ? "参数稳定"
              : report.parameterStability === "moderate"
                ? "参数中等"
                : "参数不稳定"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall recommendation */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="font-medium">综合建议</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {report.overallRecommendation}
          </div>
        </div>

        {/* Tabs for single vs dual parameter */}
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <Activity className="h-4 w-4 mr-2" />
              单参数分析
            </TabsTrigger>
            <TabsTrigger value="dual" disabled={!dualParams}>
              <Grid3X3 className="h-4 w-4 mr-2" />
              双参数热力图
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4 space-y-4">
            {/* Parameter selector */}
            {singleParams.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">选择参数:</span>
                <Select
                  value={selectedParam || singleParams[0]?.paramName}
                  onValueChange={setSelectedParam}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {singleParams.map((param) => (
                      <SelectItem key={param.paramName} value={param.paramName}>
                        {param.paramLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Single param chart */}
            {selectedSingleParam && (
              <SingleParamChart
                data={selectedSingleParam}
                onValueSelect={(value) =>
                  onParameterSelect?.(selectedSingleParam.paramName, value)
                }
              />
            )}
          </TabsContent>

          <TabsContent value="dual" className="mt-4">
            {dualParams ? (
              <HeatmapChart
                data={dualParams}
                onCellSelect={(p1, p2) => {
                  onParameterSelect?.(dualParams.param1Name, p1);
                  onParameterSelect?.(dualParams.param2Name, p2);
                }}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                双参数分析数据不可用
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* All params quick view */}
        {singleParams.length > 1 && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-3">所有参数概览</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {singleParams.map((param) => {
                const stability = getStabilityLabel(param.stabilityScore);
                return (
                  <button
                    key={param.paramName}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all hover:border-primary",
                      selectedParam === param.paramName &&
                        "border-primary bg-primary/5",
                    )}
                    onClick={() => setSelectedParam(param.paramName)}
                  >
                    <div className="font-medium text-sm">
                      {param.paramLabel}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">
                        最优: {param.optimalValue}
                      </span>
                      <span className={stability.color}>
                        {param.stabilityScore}分
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SensitivityAnalysis;
