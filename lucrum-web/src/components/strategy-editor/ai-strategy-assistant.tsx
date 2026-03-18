/**
 * AI Strategy Assistant Component
 * AI策略助手组件
 *
 * Features:
 * - Parameter optimization suggestions panel
 * - Strategy interpretation panel
 * - Sensitivity analysis panel
 * - One-click apply suggested values
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ParameterBoundaryPanel } from "./parameter-boundary-panel";
import { useFeatureUsage } from "@/hooks/use-feature-usage";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";

// Types for API responses
interface ParameterSuggestion {
  name: string;
  currentValue: number | string | boolean;
  suggestedValue: number | string | boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
  expectedImpact: string;
}

interface OptimizationSuggestion {
  parameters: ParameterSuggestion[];
  overallStrategy: string;
  riskAssessment: string;
  expectedImprovement: {
    returnRate: string;
    maxDrawdown: string;
    sharpeRatio: string;
  };
}

interface StrategyExplanation {
  summary: string;
  entryLogic: string;
  exitLogic: string;
  riskManagement: string;
  marketConditions: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface SensitivityResult {
  parameter: string;
  sensitivity: "high" | "medium" | "low";
  optimalRange: { min: number; max: number };
  impact: string;
  recommendation: string;
}

interface SensitivityAnalysis {
  results: SensitivityResult[];
  summary: string;
  criticalParameters: string[];
  stableParameters: string[];
}

// Props interface
interface AIStrategyAssistantProps {
  strategyCode: string;
  backtestResult?: {
    metrics?: {
      totalReturn?: number;
      maxDrawdown?: number;
      sharpeRatio?: number;
      winRate?: number;
      totalTrades?: number;
    };
  };
  currentParameters?: Array<{
    name: string;
    value: number | string | boolean | number[];
  }>;
  onApplyParameter?: (name: string, value: number | string | boolean) => void;
  onApplyAllSuggestions?: (
    suggestions: Array<{ name: string; value: number | string | boolean }>
  ) => void;
  className?: string;
}

// Loading spinner component
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

// Confidence badge component
function ConfidenceBadge({
  confidence,
}: {
  confidence: "high" | "medium" | "low";
}) {
  const styles = {
    high: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const labels = {
    high: "高置信度",
    medium: "中置信度",
    low: "低置信度",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", styles[confidence])}>
      {labels[confidence]}
    </Badge>
  );
}

// Sensitivity badge component
function SensitivityBadge({
  sensitivity,
}: {
  sensitivity: "high" | "medium" | "low";
}) {
  const styles = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const labels = {
    high: "高敏感",
    medium: "中敏感",
    low: "低敏感",
  };

  return (
    <Badge variant="outline" className={cn("text-xs", styles[sensitivity])}>
      {labels[sensitivity]}
    </Badge>
  );
}

export function AIStrategyAssistant({
  strategyCode,
  backtestResult,
  currentParameters,
  onApplyParameter,
  onApplyAllSuggestions,
  className,
}: AIStrategyAssistantProps) {
  // Usage tracking
  const { usage, isBlocked, refresh: refreshUsage } = useFeatureUsage();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  // State management
  const [activeTab, setActiveTab] = useState("optimize");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimization suggestions state
  const [optimization, setOptimization] = useState<OptimizationSuggestion | null>(null);

  // Strategy explanation state
  const [explanation, setExplanation] = useState<StrategyExplanation | null>(null);

  // Sensitivity analysis state
  const [sensitivity, setSensitivity] = useState<SensitivityAnalysis | null>(null);

  // Convert currentParameters to format needed by ParameterBoundaryPanel
  // 转换 currentParameters 为 ParameterBoundaryPanel 需要的格式
  const parameterList = useMemo(() => {
    if (!currentParameters) return [];
    return currentParameters.map((p) => ({
      name: p.name,
      displayName: p.name,
      value: p.value,
    }));
  }, [currentParameters]);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["params"])
  );

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Fetch optimization suggestions
  const fetchOptimizationSuggestions = useCallback(async () => {
    if (!strategyCode) {
      setError("请先提供策略代码 | Please provide strategy code first");
      return;
    }

    // Client-side quota pre-check
    if (isBlocked("ai_call")) {
      setUpgradeDialogOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/strategy/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_params",
          strategyCode,
          backtestResult,
          currentParameters,
        }),
      });

      if (response.status === 429) {
        setUpgradeDialogOpen(true);
        void refreshUsage();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch optimization suggestions");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setOptimization(data.data);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      console.error("[AIAssistant] Optimization fetch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "获取优化建议失败 | Failed to fetch optimization suggestions"
      );
    } finally {
      setIsLoading(false);
      void refreshUsage();
    }
  }, [strategyCode, backtestResult, currentParameters, isBlocked, refreshUsage]);

  // Fetch strategy explanation
  const fetchStrategyExplanation = useCallback(async () => {
    if (!strategyCode) {
      setError("请先提供策略代码 | Please provide strategy code first");
      return;
    }

    if (isBlocked("ai_call")) {
      setUpgradeDialogOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/strategy/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "explain_strategy",
          strategyCode,
        }),
      });

      if (response.status === 429) {
        setUpgradeDialogOpen(true);
        void refreshUsage();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch strategy explanation");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setExplanation(data.data);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      console.error("[AIAssistant] Explanation fetch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "获取策略解读失败 | Failed to fetch strategy explanation"
      );
    } finally {
      setIsLoading(false);
      void refreshUsage();
    }
  }, [strategyCode, isBlocked, refreshUsage]);

  // Fetch sensitivity analysis
  const fetchSensitivityAnalysis = useCallback(async () => {
    if (!strategyCode) {
      setError("请先提供策略代码 | Please provide strategy code first");
      return;
    }

    if (isBlocked("ai_call")) {
      setUpgradeDialogOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/strategy/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sensitivity_analysis",
          strategyCode,
          currentParameters,
        }),
      });

      if (response.status === 429) {
        setUpgradeDialogOpen(true);
        void refreshUsage();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sensitivity analysis");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setSensitivity(data.data);
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (err) {
      console.error("[AIAssistant] Sensitivity fetch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "获取敏感性分析失败 | Failed to fetch sensitivity analysis"
      );
    } finally {
      setIsLoading(false);
      void refreshUsage();
    }
  }, [strategyCode, currentParameters, isBlocked, refreshUsage]);

  // Apply single parameter suggestion
  const handleApplySingleParam = useCallback(
    (name: string, value: number | string | boolean) => {
      if (onApplyParameter) {
        onApplyParameter(name, value);
      }
    },
    [onApplyParameter]
  );

  // Apply all suggestions
  const handleApplyAllSuggestions = useCallback(() => {
    if (!optimization?.parameters || !onApplyAllSuggestions) return;

    const suggestions = optimization.parameters.map((p) => ({
      name: p.name,
      value: p.suggestedValue,
    }));

    onApplyAllSuggestions(suggestions);
  }, [optimization, onApplyAllSuggestions]);

  // Render optimization tab content
  const renderOptimizationContent = () => {
    if (isLoading && activeTab === "optimize") {
      return <LoadingSpinner />;
    }

    if (!optimization) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            点击下方按钮获取AI优化建议
            <br />
            <span className="text-xs">
              Click the button below to get AI optimization suggestions
            </span>
          </p>
          <Button
            onClick={fetchOptimizationSuggestions}
            disabled={isLoading || !strategyCode}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <span className="mr-2">🤖</span>
            获取优化建议 | Get Suggestions
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Parameter Suggestions */}
        <Collapsible
          open={expandedSections.has("params")}
          onOpenChange={() => toggleSection("params")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span className="font-medium">
                参数优化建议 | Parameter Suggestions
              </span>
              <Badge variant="secondary" className="ml-2">
                {optimization.parameters.length}
              </Badge>
            </div>
            <span
              className={cn(
                "transform transition-transform",
                expandedSections.has("params") ? "rotate-180" : ""
              )}
            >
              ▼
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-3">
              {optimization.parameters.map((param, index) => (
                <div
                  key={`${param.name}-${index}`}
                  className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-blue-400">
                        {param.name}
                      </span>
                      <ConfidenceBadge confidence={param.confidence} />
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApplySingleParam(
                                param.name,
                                param.suggestedValue
                              )
                            }
                            disabled={!onApplyParameter}
                            className="h-7 text-xs"
                          >
                            应用 | Apply
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>应用此建议值 | Apply this suggested value</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                    <div>
                      <span className="text-muted-foreground">当前值:</span>
                      <span className="ml-2 font-mono">
                        {String(param.currentValue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">建议值:</span>
                      <span className="ml-2 font-mono text-green-400">
                        {String(param.suggestedValue)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{param.reason}</p>
                  <p className="text-xs text-blue-400 mt-1">
                    预期影响: {param.expectedImpact}
                  </p>
                </div>
              ))}

              {/* Apply All Button */}
              {optimization.parameters.length > 0 && onApplyAllSuggestions && (
                <Button
                  onClick={handleApplyAllSuggestions}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <span className="mr-2">⚡</span>
                  一键应用所有建议 | Apply All Suggestions
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Overall Strategy Assessment */}
        <Collapsible
          open={expandedSections.has("strategy")}
          onOpenChange={() => toggleSection("strategy")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span className="font-medium">
                策略整体评估 | Overall Assessment
              </span>
            </div>
            <span
              className={cn(
                "transform transition-transform",
                expandedSections.has("strategy") ? "rotate-180" : ""
              )}
            >
              ▼
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-1">
                  策略评估 | Strategy Assessment
                </h4>
                <p className="text-sm text-muted-foreground">
                  {optimization.overallStrategy}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-yellow-400 mb-1">
                  风险评估 | Risk Assessment
                </h4>
                <p className="text-sm text-muted-foreground">
                  {optimization.riskAssessment}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-green-400 mb-1">
                  预期改进 | Expected Improvement
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-slate-700/50 rounded">
                    <div className="text-muted-foreground">收益率</div>
                    <div className="font-mono text-green-400">
                      {optimization.expectedImprovement.returnRate}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-700/50 rounded">
                    <div className="text-muted-foreground">最大回撤</div>
                    <div className="font-mono text-yellow-400">
                      {optimization.expectedImprovement.maxDrawdown}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-700/50 rounded">
                    <div className="text-muted-foreground">夏普比率</div>
                    <div className="font-mono text-blue-400">
                      {optimization.expectedImprovement.sharpeRatio}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Refresh Button */}
        <Button
          variant="outline"
          onClick={fetchOptimizationSuggestions}
          disabled={isLoading}
          className="w-full"
        >
          <span className="mr-2">🔄</span>
          刷新建议 | Refresh Suggestions
        </Button>
      </div>
    );
  };

  // Render explanation tab content
  const renderExplanationContent = () => {
    if (isLoading && activeTab === "explain") {
      return <LoadingSpinner />;
    }

    if (!explanation) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            点击下方按钮获取策略解读
            <br />
            <span className="text-xs">
              Click the button below to get strategy explanation
            </span>
          </p>
          <Button
            onClick={fetchStrategyExplanation}
            disabled={isLoading || !strategyCode}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <span className="mr-2">📖</span>
            解读策略 | Explain Strategy
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-blue-400 mb-2">
            📋 策略概述 | Summary
          </h4>
          <p className="text-sm text-muted-foreground">{explanation.summary}</p>
        </div>

        {/* Entry Logic */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-green-500/30">
          <h4 className="text-sm font-medium text-green-400 mb-2">
            🟢 入场逻辑 | Entry Logic
          </h4>
          <p className="text-sm text-muted-foreground">{explanation.entryLogic}</p>
        </div>

        {/* Exit Logic */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-red-500/30">
          <h4 className="text-sm font-medium text-red-400 mb-2">
            🔴 出场逻辑 | Exit Logic
          </h4>
          <p className="text-sm text-muted-foreground">{explanation.exitLogic}</p>
        </div>

        {/* Risk Management */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-yellow-500/30">
          <h4 className="text-sm font-medium text-yellow-400 mb-2">
            ⚠️ 风险管理 | Risk Management
          </h4>
          <p className="text-sm text-muted-foreground">
            {explanation.riskManagement}
          </p>
        </div>

        {/* Market Conditions */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-purple-500/30">
          <h4 className="text-sm font-medium text-purple-400 mb-2">
            📈 适用市场 | Market Conditions
          </h4>
          <p className="text-sm text-muted-foreground">
            {explanation.marketConditions}
          </p>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <h4 className="text-sm font-medium text-green-400 mb-2">
              💪 优势 | Strengths
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {explanation.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-green-400">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <h4 className="text-sm font-medium text-red-400 mb-2">
              ⚡ 弱点 | Weaknesses
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {explanation.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-red-400">!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <h4 className="text-sm font-medium text-blue-400 mb-2">
            💡 改进建议 | Recommendations
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {explanation.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-blue-400">→</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          onClick={fetchStrategyExplanation}
          disabled={isLoading}
          className="w-full"
        >
          <span className="mr-2">🔄</span>
          重新解读 | Re-analyze
        </Button>
      </div>
    );
  };

  // Render sensitivity tab content
  const renderSensitivityContent = () => {
    if (isLoading && activeTab === "sensitivity") {
      return <LoadingSpinner />;
    }

    if (!sensitivity) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            点击下方按钮进行参数敏感性分析
            <br />
            <span className="text-xs">
              Click the button below to analyze parameter sensitivity
            </span>
          </p>
          <Button
            onClick={fetchSensitivityAnalysis}
            disabled={isLoading || !strategyCode}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
          >
            <span className="mr-2">📊</span>
            分析敏感性 | Analyze Sensitivity
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <p className="text-sm text-muted-foreground">{sensitivity.summary}</p>
        </div>

        {/* Critical vs Stable Parameters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <h4 className="text-sm font-medium text-red-400 mb-2">
              🔥 关键参数 | Critical
            </h4>
            <div className="flex flex-wrap gap-1">
              {sensitivity.criticalParameters.map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="text-xs bg-red-500/20 text-red-400 border-red-500/30"
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <h4 className="text-sm font-medium text-green-400 mb-2">
              🛡️ 稳定参数 | Stable
            </h4>
            <div className="flex flex-wrap gap-1">
              {sensitivity.stableParameters.map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="text-xs bg-green-500/20 text-green-400 border-green-500/30"
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">详细分析 | Detailed Analysis</h4>
          {sensitivity.results.map((result, index) => (
            <div
              key={`${result.parameter}-${index}`}
              className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-blue-400">
                  {result.parameter}
                </span>
                <SensitivityBadge sensitivity={result.sensitivity} />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="text-slate-400">最优区间:</span>{" "}
                  <span className="font-mono">
                    [{result.optimalRange.min}, {result.optimalRange.max}]
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">影响:</span> {result.impact}
                </p>
                <p>
                  <span className="text-slate-400">建议:</span>{" "}
                  {result.recommendation}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          onClick={fetchSensitivityAnalysis}
          disabled={isLoading}
          className="w-full"
        >
          <span className="mr-2">🔄</span>
          重新分析 | Re-analyze
        </Button>
      </div>
    );
  };

  return (
    <Card className={cn("bg-slate-900/50 border-slate-700/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div>策略助手</div>
            <div className="text-xs font-normal text-muted-foreground">
              Strategy Assistant
            </div>
          </div>
          {usage.ai_call && isFinite(usage.ai_call.limit) && (
            <span className="text-xs font-mono text-muted-foreground bg-slate-800/50 px-2 py-1 rounded">
              {usage.ai_call.remaining}/{usage.ai_call.limit}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <span>❌</span>
              <span>{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="mt-2 text-xs"
            >
              关闭 | Dismiss
            </Button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-xs text-yellow-400">
            ⚠️ AI建议仅供参考，请结合实际情况和回测结果做出决策。
            <br />
            <span className="text-yellow-500/70">
              AI suggestions are for reference only. Please make decisions based on
              actual conditions and backtest results.
            </span>
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="optimize" className="text-xs">
              🎯 优化建议
            </TabsTrigger>
            <TabsTrigger value="explain" className="text-xs">
              📖 策略解读
            </TabsTrigger>
            <TabsTrigger value="sensitivity" className="text-xs">
              📊 敏感性
            </TabsTrigger>
            <TabsTrigger value="boundaries" className="text-xs">
              🎚️ 参数边界
            </TabsTrigger>
          </TabsList>

          <TabsContent value="optimize" className="mt-0">
            {renderOptimizationContent()}
          </TabsContent>

          <TabsContent value="explain" className="mt-0">
            {renderExplanationContent()}
          </TabsContent>

          <TabsContent value="sensitivity" className="mt-0">
            {renderSensitivityContent()}
          </TabsContent>

          <TabsContent value="boundaries" className="mt-0">
            <ParameterBoundaryPanel
              parameters={parameterList}
              strategyCode={strategyCode}
              onApplyValue={onApplyParameter ? (name, value) => onApplyParameter(name, value) : undefined}
            />
          </TabsContent>
        </Tabs>

        {/* Backtest Result Summary (if available) */}
        {backtestResult?.metrics && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              当前回测结果 | Current Backtest Result
            </h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-muted-foreground">收益率</div>
                <div
                  className={cn(
                    "font-mono",
                    (backtestResult.metrics.totalReturn ?? 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  )}
                >
                  {((backtestResult.metrics.totalReturn ?? 0) * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-muted-foreground">最大回撤</div>
                <div className="font-mono text-yellow-400">
                  {((backtestResult.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-muted-foreground">夏普比率</div>
                <div className="font-mono text-blue-400">
                  {(backtestResult.metrics.sharpeRatio ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-muted-foreground">胜率</div>
                <div className="font-mono text-purple-400">
                  {((backtestResult.metrics.winRate ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Upgrade dialog for AI quota exceeded */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        variant="limit"
        featureName="ai_call"
        used={usage.ai_call?.used ?? 0}
        limit={usage.ai_call?.limit ?? 0}
        resetAt={usage.ai_call?.resetAt}
      />
    </Card>
  );
}

export default AIStrategyAssistant;
