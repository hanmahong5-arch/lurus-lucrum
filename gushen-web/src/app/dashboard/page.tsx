"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAsyncTask } from "@/hooks/use-async-task";
import Link from "next/link";
import { StrategyInput } from "@/components/strategy-editor/strategy-input";
import { CodePreview } from "@/components/strategy-editor/code-preview";
import { BacktestPanel } from "@/components/strategy-editor/backtest-panel";
import { ParameterEditor } from "@/components/strategy-editor/parameter-editor";
import { AutoSaveIndicator } from "@/components/strategy-editor/auto-save-indicator";
import { DraftHistoryPanel } from "@/components/strategy-editor/draft-history-panel";
import { StrategyGuideCard } from "@/components/strategy-editor/strategy-guide-card";
import { StrategyWorkbenchPanel } from "@/components/strategy-editor/strategy-workbench-panel";
import { StrategyLogicSummary } from "@/components/strategy-editor/strategy-logic-summary";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WorkspaceStatusBar } from "@/components/dashboard/workspace-status-bar";
import { TieredDemoSelector } from "@/components/onboarding";
import { useOnboardingImport } from "@/hooks/use-onboarding-import";
import { parseStrategyParameters, updateParameterInCode } from "@/lib/strategy/parameter-parser";
import { useUserWorkspace } from "@/hooks/use-user-workspace";
import {
  useStrategyWorkspaceStore,
  selectWorkspace,
  selectAutoSaveStatus,
  selectHasUnsavedChanges,
  selectStrategyInput,
  selectGeneratedCode,
  selectIsGenerating,
  selectIsBacktesting,
} from "@/lib/stores/strategy-workspace-store";

export default function DashboardPage() {
  // ✨ Initialize user workspace for data isolation
  // 为数据隔离初始化用户工作空间
  const { isReady, user } = useUserWorkspace();

  // ✨ Use Zustand store instead of useState for persistent state
  // 使用Zustand store替代useState以实现持久化状态
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const autoSaveStatus = useStrategyWorkspaceStore(selectAutoSaveStatus);
  const hasUnsavedChanges = useStrategyWorkspaceStore(selectHasUnsavedChanges);
  const strategyInput = useStrategyWorkspaceStore(selectStrategyInput);
  const generatedCode = useStrategyWorkspaceStore(selectGeneratedCode);
  const isGenerating = useStrategyWorkspaceStore(selectIsGenerating);
  const isBacktesting = useStrategyWorkspaceStore(selectIsBacktesting);

  const {
    updateStrategyInput,
    updateGeneratedCode,
    setGenerating,
    setGenerationError,
    setBacktesting,
    saveDraft,
    markAsUnsaved,
  } = useStrategyWorkspaceStore();

  // Local error state (not persisted)
  // 本地错误状态（不持久化）
  const [error, setError] = useState<string | null>(null);
  const generateTask = useAsyncTask();

  // Onboarding import hook for tiered demo flows (Story 3.4)
  const {
    fillAndRunSimple,
    fillIntermediate,
    fillAdvanced,
    isAutoRunning,
    autoRunError,
  } = useOnboardingImport();

  // Code-parameter linkage state / 代码-参数联动状态
  const [focusedLine, setFocusedLine] = useState<number | null>(null);

  // Calculate current workflow step (Phase 4 UX / 7-step model)
  // Maps to StrategyGuideCard 4-step type while tracking finer granularity
  // 7 steps: 构思→生成→调参→回测→验证→诊断→保存
  const currentWorkflowStep = useMemo(() => {
    if (!generatedCode && !isGenerating) return "strategy"; // Step 1: Ideation
    if (isGenerating) return "strategy"; // Step 2: Generating (mapped to strategy phase)
    if (!workspace.lastBacktestResult && !isBacktesting) return "parameters"; // Step 3: Tuning params
    if (isBacktesting) return "backtest"; // Step 4: Running backtest
    return "backtest"; // Step 5-7: Verification/diagnosis/save (mapped to backtest phase)
    // "validation" step is on strategy-validation page
  }, [generatedCode, isGenerating, isBacktesting, workspace.lastBacktestResult]);

  // Parse current parameters from generated code for AI assistant
  // 从生成的代码中解析当前参数供AI助手使用
  const currentParameters = useMemo(() => {
    if (!generatedCode) return [];
    const parseResult = parseStrategyParameters(generatedCode);
    return parseResult.parameters.map((p) => ({
      name: p.name,
      value: p.value,
    }));
  }, [generatedCode]);

  // Extract strategy logic summary from user input (MVP: frontend parsing)
  const logicSummary = useMemo(() => {
    if (!generatedCode || !strategyInput) return null;
    return extractLogicSummary(strategyInput, generatedCode, currentParameters);
  }, [generatedCode, strategyInput, currentParameters]);

  // Ref to StrategyInput for focusing after template selection
  const strategyInputRef = useRef<HTMLDivElement>(null);

  // Ref for backtest panel to trigger rerun
  const backtestPanelRef = useRef<{ runBacktest: () => void } | null>(null);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // ✨ Auto-save mechanism - debounced 3 seconds
  // 自动保存机制 - 3秒防抖
  useEffect(() => {
    if (workspace.autoSaveStatus === 'unsaved') {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(() => {
        console.log('[Dashboard] Auto-saving draft...');
        saveDraft();
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [workspace.autoSaveStatus, saveDraft]);

  // ✨ Warn before leaving page if there are unsaved changes
  // 如果有未保存的更改，离开页面前警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ✨ Save draft before Next.js route change
  // Next.js路由切换前保存草稿
  useEffect(() => {
    const handleRouteChange = () => {
      if (hasUnsavedChanges) {
        console.log('[Dashboard] Saving before route change...');
        saveDraft();
      }
    };

    // Note: In Next.js App Router, route change detection is different
    // This is a fallback mechanism, the main protection is beforeunload
    // 注意：在Next.js App Router中，路由变化检测方式不同
    // 这是一个后备机制，主要保护是beforeunload

    return () => {
      // Cleanup - save before unmount
      if (hasUnsavedChanges) {
        saveDraft();
      }
    };
  }, [hasUnsavedChanges, saveDraft]);

  /**
   * Persist strategy to database so it appears in validation page
   * 将策略保存到数据库，使其在验证页面可见
   */
  const saveStrategyToDatabase = useCallback(async (
    strategyName: string,
    strategyCode: string,
    description: string,
    strategyType: string = 'ai_generated',
  ) => {
    try {
      // Parse parameters from code for storage
      const parseResult = parseStrategyParameters(strategyCode);
      const parameters = parseResult.parameters.reduce((acc, p) => {
        acc[p.name] = p.value;
        return acc;
      }, {} as Record<string, unknown>);

      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'strategy',
          data: {
            strategyName,
            strategyCode,
            description,
            parameters,
            strategyType,
            isActive: true,
          },
        }),
      });

      if (response.ok) {
        console.log('[Dashboard] Strategy saved to database successfully');
      } else {
        // Non-critical: log but don't block user flow
        // Save to DB is best-effort; localStorage draft is the primary backup
        console.warn('[Dashboard] Failed to save strategy to database:', response.status);
      }
    } catch (err) {
      // Non-critical failure - strategy is still available in localStorage drafts
      console.warn('[Dashboard] Error saving strategy to database:', err);
    }
  }, []);

  const handleGenerate = useCallback(async (prompt: string) => {
    setGenerating(true);
    updateGeneratedCode("");
    setError(null);
    setGenerationError(null);
    updateStrategyInput(prompt);
    generateTask.registerTask({
      type: 'generate',
      title: `策略生成 — ${prompt.slice(0, 25)}${prompt.length > 25 ? '...' : ''}`,
    });

    try {
      // Call real API endpoint
      // 调用真实的 API 端点
      const response = await fetch("/api/strategy/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      // Handle non-JSON responses (e.g., 503 "no available server")
      // 处理非JSON响应
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || "Failed to generate strategy",
        );
      }

      if (data.success && data.code) {
        updateGeneratedCode(data.code);
        generateTask.complete({ codeLength: data.code.length });
        // ✨ Immediately save draft after code generation
        // 代码生成后立即保存草稿
        setTimeout(() => saveDraft(), 0);

        // ✨ Also persist to database for cross-page access (validation page)
        // 同时保存到数据库以便跨页面访问（验证页面）
        const strategyName = extractStrategyName(prompt, data.code);
        saveStrategyToDatabase(strategyName, data.code, prompt, 'ai_generated');
      } else {
        throw new Error("No code generated");
      }
    } catch (err) {
      console.error("Generation error:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMsg);
      setGenerationError(errorMsg);
      generateTask.fail(errorMsg);

      // Fallback to mock code if API fails
      // 如果 API 失败，使用模拟代码作为后备
      const fallbackCode = generateFallbackCode(prompt);
      updateGeneratedCode(fallbackCode);

      // Also save fallback strategy to database
      const strategyName = extractStrategyName(prompt, fallbackCode);
      saveStrategyToDatabase(strategyName, fallbackCode, prompt, 'ai_generated');
    } finally {
      setGenerating(false);
    }
  }, [updateStrategyInput, updateGeneratedCode, setGenerating, setGenerationError, saveDraft, saveStrategyToDatabase]);

  // Handle template selection - fill into input
  // 处理模板选择 - 填充到输入框
  const handleSelectTemplate = useCallback((prompt: string) => {
    updateStrategyInput(prompt);
    // Scroll to input area
    // 滚动到输入区域
    strategyInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [updateStrategyInput]);

  // Handle code update from parameter editor
  // 处理参数编辑器的代码更新
  const handleCodeUpdate = useCallback((newCode: string) => {
    updateGeneratedCode(newCode);
  }, [updateGeneratedCode]);

  // Handle rerun backtest request
  // 处理重新回测请求
  const handleRerunBacktest = useCallback(() => {
    backtestPanelRef.current?.runBacktest();
  }, []);

  // Handle backtest state changes
  // 处理回测状态变化
  const handleBacktestStart = useCallback(() => {
    setBacktesting(true);
  }, [setBacktesting]);

  const handleBacktestEnd = useCallback(() => {
    setBacktesting(false);
  }, [setBacktesting]);

  // Handle AI assistant single parameter application
  // 处理AI助手单个参数应用
  const handleApplyAIParameter = useCallback(
    (name: string, value: number | string | boolean) => {
      if (!generatedCode) return;
      const updatedCode = updateParameterInCode(generatedCode, name, value);
      if (updatedCode !== generatedCode) {
        updateGeneratedCode(updatedCode);
        markAsUnsaved();
      }
    },
    [generatedCode, updateGeneratedCode, markAsUnsaved]
  );

  // Handle AI assistant all suggestions application
  // 处理AI助手批量应用所有建议
  const handleApplyAllAISuggestions = useCallback(
    (suggestions: Array<{ name: string; value: number | string | boolean }>) => {
      if (!generatedCode || suggestions.length === 0) return;

      let updatedCode = generatedCode;
      for (const suggestion of suggestions) {
        updatedCode = updateParameterInCode(
          updatedCode,
          suggestion.name,
          suggestion.value
        );
      }

      if (updatedCode !== generatedCode) {
        updateGeneratedCode(updatedCode);
        markAsUnsaved();
        // Trigger backtest after applying all suggestions
        // 应用所有建议后触发回测
        setTimeout(() => {
          handleRerunBacktest();
        }, 100);
      }
    },
    [generatedCode, updateGeneratedCode, markAsUnsaved, handleRerunBacktest]
  );

  // Show loading skeleton while workspace is initializing
  // 工作空间初始化时显示加载骨架
  if (!isReady) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border h-14" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="space-y-6 animate-pulse">
            <div className="w-64 h-8 bg-surface rounded" />
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="h-64 bg-surface rounded-xl" />
              <div className="h-64 bg-surface rounded-xl hidden lg:block" />
              <div className="h-64 bg-surface rounded-xl hidden lg:block" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Shared Dashboard Header with account status */}
      {/* 共享仪表板头部，显示账户状态 */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Page title */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            AI 策略生成器
            <span className="text-sm sm:text-base font-normal text-white/50 ml-2 hidden sm:inline">
              / AI Strategy Generator
            </span>
          </h1>
          <p className="text-sm sm:text-base text-white/60">
            用自然语言描述你的交易策略，AI 将自动生成可执行的 VeighNa
            策略代码，支持参数微调和回测验证
          </p>
        </div>

        {/* Tiered onboarding demo selector - shown when no code exists (Story 3.4) */}
        {!generatedCode && !isGenerating && (
          <TieredDemoSelector
            onSimple={fillAndRunSimple}
            onIntermediate={fillIntermediate}
            onAdvanced={fillAdvanced}
            isAutoRunning={isAutoRunning}
            autoRunError={autoRunError}
            className="mb-6"
          />
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg">
            <p className="text-loss text-sm">
              ⚠️ API 调用失败，使用本地模拟生成: {error}
            </p>
          </div>
        )}

        {/* Editor grid - 3 columns on large screens, single column mobile */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left column - Input */}
          <div className="space-y-6" ref={strategyInputRef}>
            <StrategyInput
              onGenerate={handleGenerate}
              isLoading={isGenerating}
              value={strategyInput}
              onChange={updateStrategyInput}
            />

            {/* Parameter Editor - shows when code is generated */}
            {generatedCode && (
              <ParameterEditor
                code={generatedCode}
                onCodeUpdate={handleCodeUpdate}
                onRerunBacktest={handleRerunBacktest}
                isBacktesting={isBacktesting}
                onParameterFocus={setFocusedLine}
              />
            )}

            {/* Draft History Panel / 草稿历史面板 */}
            <DraftHistoryPanel />
          </div>

          {/* Middle column - Logic summary + Code preview */}
          <div className="space-y-4">
            {/* Strategy Logic Summary - shows after code generation */}
            {(generatedCode || isGenerating) && (
              <StrategyLogicSummary
                conditions={logicSummary?.conditions ?? { buy: "", sell: "", position: "" }}
                confidence={logicSummary?.confidence ?? "medium"}
                params={logicSummary?.params ?? {}}
                code={generatedCode}
                state={isGenerating ? "loading" : "default"}
              />
            )}
            <CodePreview
              code={generatedCode}
              isLoading={isGenerating}
              collapsible={true}
              highlightedLine={focusedLine}
              onHighlightClear={() => setFocusedLine(null)}
            />
          </div>

          {/* Right column - Backtest + Strategy Workbench */}
          <div className="space-y-6">
            <BacktestPanel
              strategyCode={generatedCode}
              onBacktestStart={handleBacktestStart}
              onBacktestEnd={handleBacktestEnd}
            />

            {/* Strategy Workbench Panel - combines templates + AI assistant */}
            <StrategyWorkbenchPanel
              strategyCode={generatedCode}
              backtestResult={workspace.lastBacktestResult ?? undefined}
              currentParameters={currentParameters}
              onSelectTemplate={handleSelectTemplate}
              onApplyParameter={handleApplyAIParameter}
              onApplyAllSuggestions={handleApplyAllAISuggestions}
            />
          </div>
        </div>

        {/* Risk Disclaimer / 风险提示 */}
        <div className="mt-4 p-4 bg-loss/5 border border-loss/20 rounded-xl">
          <h3 className="text-sm font-medium text-loss mb-2">
            ⚠️ 风险提示 / Risk Disclaimer
          </h3>
          <p className="text-xs text-white/50 leading-relaxed">
            本工具生成的策略代码仅供学习研究使用，不构成任何投资建议。量化交易存在市场风险，
            历史回测结果不代表未来收益。请在充分了解相关风险的前提下，谨慎决策。
            The strategies generated are for educational purposes only. Past
            performance does not guarantee future results.
          </p>
        </div>

        {/* Powered by */}
        <div className="mt-6 text-center">
          <p className="text-xs text-white/30">
            Powered by <span className="text-accent/50">DeepSeek</span> +{" "}
            <span className="text-white/40">VeighNa</span> via{" "}
            <span className="text-white/40">Lurus API</span>
          </p>
        </div>
      </main>

      {/* Floating strategy workflow guide (sidecar) */}
      <StrategyGuideCard currentStep={currentWorkflowStep} />

      {/* Bottom status bar */}
      {user?.id && (
        <WorkspaceStatusBar userId={user.id} />
      )}
    </div>
  );
}

/**
 * Extract a readable strategy name from user prompt and generated code
 * 从用户提示词和生成代码中提取可读策略名称
 */
function extractStrategyName(prompt: string, code: string): string {
  // Try to extract class name from code
  const classMatch = code.match(/class\s+(\w+)\s*[\(:]/)
  if (classMatch?.[1] && classMatch[1] !== 'AIStrategy') {
    // Convert CamelCase to readable: "DualMovingAverageStrategy" -> "DualMovingAverage"
    const name = classMatch[1].replace(/Strategy$/, '');
    return name;
  }

  // Fall back to first 30 chars of prompt
  const trimmed = prompt.trim().substring(0, 30);
  return trimmed || 'AI策略';
}

/**
 * Fallback code generator when API is unavailable
 * API 不可用时的后备代码生成器
 */
function generateFallbackCode(prompt: string): string {
  const hasMA = prompt.includes("均线") || prompt.toLowerCase().includes("ma");
  const hasRSI = prompt.includes("RSI") || prompt.includes("rsi");
  const hasMACD = prompt.includes("MACD") || prompt.includes("macd");

  let code = `"""
AI Generated Trading Strategy (Fallback Mode)
AI生成的交易策略 (离线模式)

Strategy Description / 策略描述:
${prompt}

Generated by GuShen AI / 由谷神AI生成
"""

from vnpy.trader.object import BarData
from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.constant import Interval

class AIStrategy(CtaTemplate):
    """AI-Generated CTA Strategy"""

    author = "GuShen AI"

    # Parameters / 参数
`;

  if (hasMA) {
    code += `    fast_window = 5
    slow_window = 20
`;
  }
  if (hasRSI) {
    code += `    rsi_window = 14
    rsi_buy = 30
    rsi_sell = 70
`;
  }
  if (hasMACD) {
    code += `    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
`;
  }

  code += `    fixed_size = 1

    # Variables / 变量
    inited = False
    trading = False
`;

  if (hasMA) {
    code += `    fast_ma = 0.0
    slow_ma = 0.0
`;
  }
  if (hasRSI) {
    code += `    rsi_value = 0.0
`;
  }

  code += `
    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_bar(self, bar: BarData):
        """Process new bar data / 处理新K线数据"""
        if not self.inited:
            return
`;

  if (hasMA) {
    code += `
        # Calculate moving averages / 计算均线
        am = self.cta_engine.get_am(self.vt_symbol)
        self.fast_ma = am.sma(self.fast_window)
        self.slow_ma = am.sma(self.slow_window)

        # MA crossover signal / 均线交叉信号
        if self.fast_ma > self.slow_ma and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.fast_ma < self.slow_ma and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
`;
  }

  if (hasRSI) {
    code += `
        # Calculate RSI / 计算RSI
        am = self.cta_engine.get_am(self.vt_symbol)
        self.rsi_value = am.rsi(self.rsi_window)

        # RSI signal / RSI信号
        if self.rsi_value < self.rsi_buy and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.rsi_value > self.rsi_sell and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
`;
  }

  code += `
        self.put_event()
`;

  return code;
}

/**
 * Extract strategy logic summary from user prompt and generated code (MVP: frontend parsing)
 * Parses buy/sell conditions and parameters from user's natural language input.
 */
function extractLogicSummary(
  prompt: string,
  code: string,
  params: Array<{ name: string; value: unknown }>,
): {
  conditions: { buy: string; sell: string; position: string };
  confidence: "high" | "medium" | "low";
  params: Record<string, string>;
} {
  // Extract buy/sell conditions from prompt using Chinese keyword patterns
  const lines = prompt.split(/[，,。.；;\n]+/).map((s) => s.trim()).filter(Boolean);

  let buy = "";
  let sell = "";
  let position = "";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!buy && (lower.includes("\u4E70\u5165") || lower.includes("\u505A\u591A") || lower.includes("\u91D1\u53C9") || lower.includes("buy"))) {
      buy = line;
    } else if (!sell && (lower.includes("\u5356\u51FA") || lower.includes("\u505A\u7A7A") || lower.includes("\u6B7B\u53C9") || lower.includes("sell") || lower.includes("\u6B62\u635F") || lower.includes("\u6B62\u76C8"))) {
      sell = line;
    } else if (!position && (lower.includes("\u4ED3\u4F4D") || lower.includes("\u8D44\u91D1") || lower.includes("position") || lower.includes("\u6BD4\u4F8B"))) {
      position = line;
    }
  }

  // Fallback: use the full prompt split into conditions
  if (!buy && !sell) {
    buy = prompt.length > 60 ? prompt.substring(0, 60) + "..." : prompt;
    sell = "\u672A\u660E\u786E\u6307\u5B9A";
    position = "\u9ED8\u8BA4\u4ED3\u4F4D\u7BA1\u7406";
  }
  if (!sell) sell = "\u672A\u660E\u786E\u6307\u5B9A";
  if (!position) position = "\u9ED8\u8BA4\u4ED3\u4F4D\u7BA1\u7406";

  // Build params map from parsed parameters
  const paramMap: Record<string, string> = {};
  for (const p of params) {
    paramMap[p.name] = String(p.value);
  }

  return {
    conditions: { buy, sell, position },
    confidence: "medium" as const,
    params: paramMap,
  };
}
