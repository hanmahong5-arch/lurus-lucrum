/**
 * Parameter Boundary Analysis Panel
 * 参数边界分析面板
 *
 * Features:
 * - Visual boundary indicators (safe zone / danger zone)
 * - AI-powered parameter analysis
 * - Tiered guidance (beginner / intermediate / advanced)
 * - Function analysis and risk warnings
 *
 * @module components/strategy-editor/parameter-boundary-panel
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// =============================================================================
// TYPE DEFINITIONS / 类型定义
// =============================================================================

/**
 * Parameter boundary analysis result from AI
 * AI返回的参数边界分析结果
 */
export interface ParameterBoundaryAnalysis {
  parameterName: string;
  displayName: string;

  boundaries: {
    theoreticalMin: number;    // Theoretical minimum / 理论最小值
    theoreticalMax: number;    // Theoretical maximum / 理论最大值
    practicalMin: number;      // Practical minimum / 实用最小值
    practicalMax: number;      // Practical maximum / 实用最大值
    optimalRange: { min: number; max: number };  // Recommended range / 建议范围
  };

  functionAnalysis: {
    role: string;              // Parameter role / 参数作用
    affectedIndicators: string[];
    impactDescription: string;
  };

  guidance: {
    beginner: string;          // Beginner advice / 初学者建议
    intermediate: string;      // Intermediate advice / 进阶建议
    advanced: string;          // Expert advice / 专家建议
    riskWarning?: string;      // Risk warning / 风险提示
  };
}

/**
 * User level for tiered guidance
 * 用户等级，用于分级指导
 */
type UserLevel = "beginner" | "intermediate" | "advanced";

interface ParameterBoundaryPanelProps {
  /**
   * Available parameters for analysis
   * 可分析的参数列表
   */
  parameters: Array<{
    name: string;
    displayName?: string;
    value: number | string | boolean | number[];
  }>;

  /**
   * Strategy code for context
   * 策略代码，用于上下文分析
   */
  strategyCode: string;

  /**
   * Callback when user applies a suggested value
   * 用户应用建议值时的回调
   */
  onApplyValue?: (name: string, value: number) => void;

  /**
   * Additional CSS classes
   * 额外的CSS类名
   */
  className?: string;
}

// =============================================================================
// BOUNDARY VISUALIZATION / 边界可视化
// =============================================================================

interface BoundaryVisualizerProps {
  boundaries: ParameterBoundaryAnalysis["boundaries"];
  currentValue: number;
  onApply?: (value: number) => void;
}

function BoundaryVisualizer({ boundaries, currentValue, onApply }: BoundaryVisualizerProps) {
  const { theoreticalMin, theoreticalMax, practicalMin, practicalMax, optimalRange } = boundaries;

  // Calculate positions as percentages / 计算位置百分比
  const range = theoreticalMax - theoreticalMin;
  const toPercent = (val: number) => ((val - theoreticalMin) / range) * 100;

  const dangerLeftEnd = toPercent(practicalMin);
  const safeStart = toPercent(optimalRange.min);
  const safeEnd = toPercent(optimalRange.max);
  const dangerRightStart = toPercent(practicalMax);
  const currentPos = toPercent(currentValue);

  // Check if current value is in safe zone / 检查当前值是否在安全区
  const isInSafeZone = currentValue >= optimalRange.min && currentValue <= optimalRange.max;
  const isInDangerZone = currentValue < practicalMin || currentValue > practicalMax;

  return (
    <div className="space-y-3">
      {/* Boundary bar / 边界条 */}
      <div className="relative h-8 bg-surface-hover rounded-lg overflow-hidden">
        {/* Danger zone left / 左侧危险区 */}
        <div
          className="absolute top-0 bottom-0 bg-loss/30"
          style={{ left: "0%", width: `${dangerLeftEnd}%` }}
        />

        {/* Warning zone left / 左侧警告区 */}
        <div
          className="absolute top-0 bottom-0 bg-yellow-500/20"
          style={{ left: `${dangerLeftEnd}%`, width: `${safeStart - dangerLeftEnd}%` }}
        />

        {/* Safe zone (optimal range) / 安全区（最优范围） */}
        <div
          className="absolute top-0 bottom-0 bg-profit/30"
          style={{ left: `${safeStart}%`, width: `${safeEnd - safeStart}%` }}
        />

        {/* Warning zone right / 右侧警告区 */}
        <div
          className="absolute top-0 bottom-0 bg-yellow-500/20"
          style={{ left: `${safeEnd}%`, width: `${dangerRightStart - safeEnd}%` }}
        />

        {/* Danger zone right / 右侧危险区 */}
        <div
          className="absolute top-0 bottom-0 bg-loss/30"
          style={{ left: `${dangerRightStart}%`, width: `${100 - dangerRightStart}%` }}
        />

        {/* Current value indicator / 当前值指示器 */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-1 rounded-full transition-all duration-300",
            isInSafeZone ? "bg-profit" : isInDangerZone ? "bg-loss" : "bg-yellow-400"
          )}
          style={{ left: `${Math.max(0, Math.min(99, currentPos))}%` }}
        >
          <div
            className={cn(
              "absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap",
              isInSafeZone ? "bg-profit/20 text-profit" : isInDangerZone ? "bg-loss/20 text-loss" : "bg-yellow-500/20 text-yellow-400"
            )}
          >
            {currentValue}
          </div>
        </div>
      </div>

      {/* Legend / 图例 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-loss/30" />
            <span className="text-loss">危险区</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500/20" />
            <span className="text-yellow-400">警告区</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-profit/30" />
            <span className="text-profit">安全区</span>
          </div>
        </div>

        {/* Status badge / 状态徽章 */}
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            isInSafeZone
              ? "bg-profit/20 text-profit border-profit/30"
              : isInDangerZone
                ? "bg-loss/20 text-loss border-loss/30"
                : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
          )}
        >
          {isInSafeZone ? "✓ 安全" : isInDangerZone ? "⚠ 危险" : "! 警告"}
        </Badge>
      </div>

      {/* Range labels / 范围标签 */}
      <div className="flex justify-between text-[10px] text-white/40 font-mono">
        <span>{theoreticalMin}</span>
        <span className="text-profit">{optimalRange.min} - {optimalRange.max} (推荐)</span>
        <span>{theoreticalMax}</span>
      </div>

      {/* Quick apply buttons / 快速应用按钮 */}
      {onApply && !isInSafeZone && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApply(optimalRange.min)}
            className="flex-1 text-xs h-7 bg-profit/10 border-profit/30 text-profit hover:bg-profit/20"
          >
            应用最小建议值 ({optimalRange.min})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApply(Math.round((optimalRange.min + optimalRange.max) / 2))}
            className="flex-1 text-xs h-7 bg-profit/10 border-profit/30 text-profit hover:bg-profit/20"
          >
            应用中间值 ({Math.round((optimalRange.min + optimalRange.max) / 2)})
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function ParameterBoundaryPanel({
  parameters,
  strategyCode,
  onApplyValue,
  className,
}: ParameterBoundaryPanelProps) {
  // Selected parameter for analysis / 选中的分析参数
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

  // User level for guidance / 用户等级
  const [userLevel, setUserLevel] = useState<UserLevel>("beginner");

  // Loading and error states / 加载和错误状态
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result / 分析结果
  const [analysis, setAnalysis] = useState<ParameterBoundaryAnalysis | null>(null);

  // Filter numeric parameters only / 只过滤数值参数
  const numericParams = useMemo(() => {
    return parameters.filter((p) => typeof p.value === "number");
  }, [parameters]);

  // Get current parameter value / 获取当前参数值
  const currentParamValue = useMemo(() => {
    if (!selectedParam) return null;
    const param = parameters.find((p) => p.name === selectedParam);
    return param ? (param.value as number) : null;
  }, [selectedParam, parameters]);

  // Fetch boundary analysis / 获取边界分析
  const fetchBoundaryAnalysis = useCallback(async () => {
    if (!selectedParam || !strategyCode) {
      setError("请选择参数 | Please select a parameter");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/strategy/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_boundaries",
          strategyCode,
          parameterName: selectedParam,
          currentValue: currentParamValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze boundaries");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setAnalysis(data.data);
      } else {
        throw new Error(data.error || "Invalid response");
      }
    } catch (err) {
      console.error("[BoundaryPanel] Analysis error:", err);
      setError(err instanceof Error ? err.message : "分析失败 | Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, [selectedParam, strategyCode, currentParamValue]);

  // Get guidance based on user level / 根据用户等级获取指导
  const currentGuidance = useMemo(() => {
    if (!analysis) return null;
    return analysis.guidance[userLevel];
  }, [analysis, userLevel]);

  // Handle parameter selection / 处理参数选择
  const handleParamSelect = useCallback((value: string) => {
    setSelectedParam(value);
    setAnalysis(null);
    setError(null);
  }, []);

  // Handle apply value / 处理应用值
  const handleApplyValue = useCallback(
    (value: number) => {
      if (selectedParam && onApplyValue) {
        onApplyValue(selectedParam, value);
      }
    },
    [selectedParam, onApplyValue]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Parameter selector / 参数选择器 */}
      <div className="flex items-center gap-3">
        <Select value={selectedParam ?? ""} onValueChange={handleParamSelect}>
          <SelectTrigger className="flex-1 bg-surface-hover border-border">
            <SelectValue placeholder="选择参数 | Select parameter" />
          </SelectTrigger>
          <SelectContent>
            {numericParams.map((param) => (
              <SelectItem key={param.name} value={param.name}>
                {param.displayName || param.name} ({param.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={fetchBoundaryAnalysis}
          disabled={!selectedParam || isLoading}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              分析中
            </>
          ) : (
            <>
              <span className="mr-2">🎚️</span>
              分析边界
            </>
          )}
        </Button>
      </div>

      {/* Error display / 错误显示 */}
      {error && (
        <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg text-loss text-sm">
          ❌ {error}
        </div>
      )}

      {/* Analysis result / 分析结果 */}
      {analysis && currentParamValue !== null && (
        <div className="space-y-4 p-4 bg-surface-hover/50 rounded-lg border border-border">
          {/* Parameter header / 参数头部 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">
                {analysis.displayName}
              </h4>
              <p className="text-xs text-white/50 font-mono">
                {analysis.parameterName}
              </p>
            </div>
            <Badge variant="outline" className="bg-accent/20 text-accent border-accent/30">
              当前值: {currentParamValue}
            </Badge>
          </div>

          {/* Boundary visualization / 边界可视化 */}
          <BoundaryVisualizer
            boundaries={analysis.boundaries}
            currentValue={currentParamValue}
            onApply={onApplyValue ? handleApplyValue : undefined}
          />

          {/* Function analysis / 功能分析 */}
          <div className="space-y-2 p-3 bg-primary/30 rounded-lg">
            <h5 className="text-xs font-medium text-white/80 flex items-center gap-2">
              📖 功能说明 | Function Analysis
            </h5>
            <p className="text-xs text-white/60">{analysis.functionAnalysis.role}</p>
            <p className="text-xs text-white/40">{analysis.functionAnalysis.impactDescription}</p>
            {analysis.functionAnalysis.affectedIndicators.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {analysis.functionAnalysis.affectedIndicators.map((ind) => (
                  <Badge key={ind} variant="secondary" className="text-[10px]">
                    {ind}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tiered guidance / 分级指导 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-medium text-white/80">
                💡 使用指导 | Guidance
              </h5>
              <Select
                value={userLevel}
                onValueChange={(v) => setUserLevel(v as UserLevel)}
              >
                <SelectTrigger className="w-28 h-7 text-xs bg-surface border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">🌱 初学者</SelectItem>
                  <SelectItem value="intermediate">📈 进阶</SelectItem>
                  <SelectItem value="advanced">🎯 专家</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <p className="text-xs text-white/70">{currentGuidance}</p>
            </div>
          </div>

          {/* Risk warning / 风险提示 */}
          {analysis.guidance.riskWarning && (
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg">
              <p className="text-xs text-loss flex items-start gap-2">
                <span>⚠️</span>
                <span>{analysis.guidance.riskWarning}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state / 空状态 */}
      {!analysis && !isLoading && !error && (
        <div className="text-center py-6 text-white/40">
          <p className="text-sm">选择参数并点击"分析边界"</p>
          <p className="text-xs mt-1">Select a parameter and click "Analyze Boundaries"</p>
        </div>
      )}
    </div>
  );
}

export default ParameterBoundaryPanel;
