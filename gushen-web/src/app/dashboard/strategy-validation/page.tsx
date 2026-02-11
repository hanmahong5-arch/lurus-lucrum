"use client";

/**
 * Strategy Validation Page
 * 策略验证页面
 *
 * Allows users to validate trading strategies across industry sectors.
 * Enhanced with request cancellation and duplicate submission prevention.
 *
 * 允许用户在行业板块中验证交易策略
 * 增强版：包含请求取消和防重复提交功能
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StrategyGuideCard } from "@/components/strategy-editor/strategy-guide-card";
import {
  ConfigPanel,
  ValidationConfig,
  StrategyOption,
  SectorOption,
  ResultSummary,
  ValidationSummary,
  ReturnDistribution,
  DistributionBucket,
  SignalTimeline,
  TimelinePoint,
  StockRanking,
  StockRankingItem,
  SignalDetails,
  SignalDetailItem,
} from "@/components/strategy-validation";
import { DataSourceBadge, mapDataSourceString } from "@/components/ui/data-source-badge";
import { SimulatedDataBanner } from "@/components/ui/simulated-data-banner";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface ValidationResult {
  summary: ValidationSummary;
  stockRanking: StockRankingItem[];
  signalDetails: SignalDetailItem[];
  returnDistribution: DistributionBucket[];
  signalTimeline: TimelinePoint[];
  meta: {
    executionTime: number;
    dataSource: string;
    timestamp: string;
  };
}

/** Multi-stock API response shape for a single stock result */
interface MultiStockResult {
  symbol: string;
  name: string;
  signalCount: number;
  avgReturn: number;
  winRate: number;
  totalReturn: number;
  signals: Array<{
    date: string;
    type: string;
    price: number;
    return: number;
  }>;
}

// =============================================================================
// HELPERS / 辅助函数
// =============================================================================

/**
 * Check if any stock in validation used simulated data
 */
function hasSimulatedData(meta: ValidationResult["meta"]): boolean {
  return mapDataSourceString(meta.dataSource) === "simulated";
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export default function StrategyValidationPage() {
  // Data state
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);

  // Validation state
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);

  // Stock selection state for filtering signal details
  // 股票选择状态，用于过滤信号详情
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  // AbortController ref for request cancellation
  // 用于请求取消的AbortController引用
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<number>(0);

  /**
   * Fetch available strategies and sectors on mount
   * 组件挂载时获取可用策略和行业
   *
   * API response format (from /api/backtest/sector GET):
   * {
   *   success: true,
   *   data: {
   *     strategies: [...],
   *     sectors: { industries: [...], concepts: [...] }
   *   }
   * }
   */
  useEffect(() => {
    async function fetchOptions() {
      try {
        const response = await fetch("/api/backtest/sector");
        const data = await response.json();

        if (data.success && data.data) {
          // Handle new grouped strategy format (builtin + user)
          // 处理新的分组策略格式（预定义 + 用户）
          const { strategies: strategyData, sectors: sectorData } = data.data;

          // Flatten builtin and user strategies into a single array
          // 将预定义和用户策略合并为单一数组
          const builtinStrategies = (strategyData?.builtin ?? []).map(
            (s: { id: string; name: string; nameEn?: string; description: string }) => ({
              ...s,
              type: 'builtin' as const,
            })
          );
          const userStrategies = (strategyData?.user ?? []).map(
            (s: { id: string; name: string; description: string; code?: string; parameters?: Record<string, unknown> }) => ({
              ...s,
              type: 'custom' as const,
            })
          );

          // User strategies first, then builtin
          setStrategies([...userStrategies, ...builtinStrategies]);

          // Flatten industries and concepts into a single sectors array
          // 将行业和概念板块合并为单一数组
          const { industries = [], concepts = [] } = sectorData ?? {};
          const flatSectors: SectorOption[] = [
            ...industries.map((s: { code: string; name: string; nameEn?: string }) => ({
              code: s.code,
              name: s.name,
              nameEn: s.nameEn,
              type: "industry" as const,
            })),
            ...concepts.map((s: { code: string; name: string; nameEn?: string }) => ({
              code: s.code,
              name: s.name,
              nameEn: s.nameEn,
              type: "concept" as const,
            })),
          ];
          setSectors(flatSectors);
        } else {
          setError(data.error ?? "Failed to load options");
          // Use fallback data
          setStrategies(FALLBACK_STRATEGIES);
          setSectors(FALLBACK_SECTORS);
        }
      } catch {
        setError("无法加载配置选项，使用默认数据");
        // Use fallback data
        setStrategies(FALLBACK_STRATEGIES);
        setSectors(FALLBACK_SECTORS);
      } finally {
        setIsInitializing(false);
      }
    }

    fetchOptions();
  }, []);

  /**
   * Handle validation request with cancellation support
   * 处理验证请求，支持取消
   */
  const handleValidate = useCallback(async (config: ValidationConfig) => {
    // Cancel previous request if still pending
    // 如果之前的请求仍在进行中，取消它
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Validate configuration based on selection mode
    // 根据选择模式验证配置
    if (config.selectionMode === 'stocks') {
      if (!config.selectedSymbols || config.selectedSymbols.length === 0) {
        setError('请至少选择一只股票 / Please select at least one stock');
        return;
      }
    } else {
      if (!config.sectorCode) {
        setError('请选择一个行业板块 / Please select a sector');
        return;
      }
    }

    // Create new AbortController for this request
    // 为此次请求创建新的AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Track request ID to handle race conditions
    // 跟踪请求ID以处理竞态条件
    const requestId = ++lastRequestIdRef.current;

    setIsLoading(true);
    setError(null);
    setSelectedStock(null); // Clear stock selection on new validation

    try {
      // Determine API endpoint based on selection mode
      // 根据选择模式确定API端点
      const apiEndpoint = config.selectionMode === 'stocks'
        ? '/api/backtest/multi-stocks'
        : '/api/backtest/sector';

      // Prepare request body based on mode
      // 根据模式准备请求体
      const requestBody = config.selectionMode === 'stocks'
        ? {
            symbols: config.selectedSymbols,
            strategy: config.strategy,
            startDate: config.startDate,
            endDate: config.endDate,
            holdingDays: config.holdingDays,
            maxStocks: config.maxStocks,
            includeTransactionCosts: config.includeTransactionCosts,
            excludeSTStocks: config.excludeSTStocks,
            deduplicateSignals: config.deduplicateSignals,
            dataSource: 'database', // Prefer database for performance
          }
        : config;

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      // Check if this is still the latest request
      // 检查这是否仍是最新的请求
      if (requestId !== lastRequestIdRef.current) {
        return; // Ignore outdated response / 忽略过时的响应
      }

      const data = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
      } else if (data.success && data.stockResults) {
        // Handle multi-stocks API response format
        // 处理多股API的响应格式
        setResult({
          summary: data.summary,
          stockRanking: data.stockResults.map((s: MultiStockResult) => ({
            symbol: s.symbol,
            name: s.name,
            signalCount: s.signalCount,
            avgReturn: s.avgReturn,
            winRate: s.winRate,
            totalReturn: s.totalReturn,
          })),
          signalDetails: data.stockResults.flatMap((s: MultiStockResult) =>
            s.signals.map((signal) => ({
              symbol: s.symbol,
              name: s.name,
              date: signal.date,
              type: signal.type,
              price: signal.price,
              return: signal.return,
            }))
          ),
          returnDistribution: [], // Will be calculated client-side if needed
          signalTimeline: [], // Will be calculated client-side if needed
          meta: {
            executionTime: data.executionTime || 0,
            dataSource: data.dataSource || 'unknown',
            timestamp: data.timestamp || new Date().toISOString(),
          },
        });
      } else {
        setError(data.error ?? "验证失败 / Validation failed");
      }
    } catch (err) {
      // Ignore abort errors (user cancelled)
      // 忽略中止错误(用户取消)
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      // Only show error if this is the latest request
      // 只有当这是最新请求时才显示错误
      if (requestId === lastRequestIdRef.current) {
        setError(
          err instanceof Error ? err.message : "验证出错 / Validation error",
        );
      }
    } finally {
      // Only update loading state if this is the latest request
      // 只有当这是最新请求时才更新加载状态
      if (requestId === lastRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Cancel current validation request
   * 取消当前验证请求
   */
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setError(null);
    }
  }, []);

  /**
   * Cleanup on unmount
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Handle stock selection from StockRanking
   * 处理来自股票排行榜的股票选择
   */
  const handleStockClick = useCallback((symbol: string | null) => {
    setSelectedStock(symbol);
    // If a stock is selected, scroll to signal details section
    if (symbol) {
      setTimeout(() => {
        document.getElementById("signal-details-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, []);

  /**
   * Filtered signal details based on selected stock
   * 根据选中的股票过滤信号详情
   */
  const filteredSignalDetails = useMemo(() => {
    if (!result?.signalDetails) return [];
    if (!selectedStock) return result.signalDetails;
    return result.signalDetails.filter((signal) => signal.symbol === selectedStock);
  }, [result?.signalDetails, selectedStock]);

  /**
   * Export results to JSON
   * 导出结果为JSON
   */
  const handleExport = useCallback(() => {
    if (!result) return;

    const exportData = {
      generatedAt: new Date().toISOString(),
      platform: "GuShen AI Trading - Strategy Validation",
      ...result,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategy-validation-${result.summary.strategy}-${result.summary.sector}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  // Loading initial data
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50">加载中... / Loading...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="text-white/40 hover:text-white/60 text-sm"
            >
              策略编辑器
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-accent text-sm">策略验证</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            策略验证系统
            <span className="text-base font-normal text-white/50 ml-2">
              / Strategy Validation System
            </span>
          </h1>
          <p className="text-white/60">
            验证交易策略在不同行业板块的历史表现，了解策略的胜率和收益分布
          </p>
        </div>

        {/* Strategy Guide Card (Phase 4 UX enhancement) */}
        <StrategyGuideCard currentStep="validation" className="mb-6" />

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg">
            <p className="text-loss text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-1">
            <ConfigPanel
              strategies={strategies}
              sectors={sectors}
              onValidate={handleValidate}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Simulated Data Warning Banner (AC-5) */}
            {result?.meta && hasSimulatedData(result.meta) && (
              <SimulatedDataBanner visible={true} />
            )}

            {/* Result Summary */}
            <ResultSummary
              summary={result?.summary ?? null}
              isLoading={isLoading}
            />

            {/* Return Distribution */}
            {result &&
              result.returnDistribution &&
              result.returnDistribution.length > 0 && (
                <ReturnDistribution
                  data={result.returnDistribution}
                  avgReturn={result.summary.avgReturn}
                  medianReturn={result.summary.medianReturn}
                />
              )}

            {/* Signal Timeline */}
            {result &&
              result.signalTimeline &&
              result.signalTimeline.length > 0 && (
                <SignalTimeline data={result.signalTimeline} />
              )}

            {/* Stock Ranking */}
            {result &&
              result.stockRanking &&
              result.stockRanking.length > 0 && (
                <StockRanking
                  data={result.stockRanking}
                  strategyName={result.summary.strategyName}
                  sectorName={result.summary.sectorName}
                  onStockClick={handleStockClick}
                  selectedStock={selectedStock}
                />
              )}

            {/* Signal Details */}
            {result &&
              result.signalDetails &&
              result.signalDetails.length > 0 && (
                <div id="signal-details-section">
                  <SignalDetails
                    data={filteredSignalDetails}
                    strategyName={result.summary.strategyName}
                    sectorName={result.summary.sectorName}
                  />
                </div>
              )}

            {/* Export Button */}
            {result && (
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition"
                >
                  📥 导出JSON
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl">
          <h3 className="text-sm font-medium text-accent mb-2">
            💡 使用提示 / Usage Tips
          </h3>
          <ul className="text-sm text-white/60 space-y-1">
            <li>• 选择不同的策略和行业组合，发现最佳匹配</li>
            <li>• 持有天数影响收益计算，短期策略建议1-5天</li>
            <li>• 胜率和平均收益都要关注，避免单一指标陷阱</li>
            <li>• 超额收益反映策略相对于行业指数的表现</li>
            <li>
              • Try different strategy-sector combinations to find the best
              match
            </li>
          </ul>
        </div>

        {/* Execution Info */}
        {result?.meta && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <p className="text-xs text-white/30">
              执行时间: {(result.meta.executionTime / 1000).toFixed(2)}s |
              数据源:
            </p>
            <DataSourceBadge type={mapDataSourceString(result.meta.dataSource)} />
            <p className="text-xs text-white/30">
              | 时间戳:{" "}
              {new Date(result.meta.timestamp).toLocaleString("zh-CN")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// FALLBACK DATA / 后备数据
// =============================================================================

const FALLBACK_STRATEGIES: StrategyOption[] = [
  {
    id: "macd_golden_cross",
    name: "MACD金叉",
    nameEn: "MACD Golden Cross",
    description: "DIF上穿DEA产生买入信号",
    type: "builtin",
  },
  {
    id: "macd_death_cross",
    name: "MACD死叉",
    nameEn: "MACD Death Cross",
    description: "DIF下穿DEA产生卖出信号",
    type: "builtin",
  },
  {
    id: "rsi_oversold",
    name: "RSI超卖",
    nameEn: "RSI Oversold",
    description: "RSI低于30产生买入信号",
    type: "builtin",
  },
  {
    id: "rsi_overbought",
    name: "RSI超买",
    nameEn: "RSI Overbought",
    description: "RSI高于70产生卖出信号",
    type: "builtin",
  },
  {
    id: "ma_golden_cross",
    name: "均线金叉",
    nameEn: "MA Golden Cross",
    description: "MA5上穿MA20产生买入信号",
    type: "builtin",
  },
  {
    id: "boll_lower_break",
    name: "布林带下轨",
    nameEn: "BOLL Lower Break",
    description: "价格触及下轨产生买入信号",
    type: "builtin",
  },
  {
    id: "volume_breakout",
    name: "放量突破",
    nameEn: "Volume Breakout",
    description: "放量突破20日高点",
    type: "builtin",
  },
];

const FALLBACK_SECTORS: SectorOption[] = [
  { code: "BK0420", name: "电力", nameEn: "Electric Power", type: "industry" },
  { code: "BK0437", name: "银行", nameEn: "Banking", type: "industry" },
  { code: "BK0475", name: "房地产", nameEn: "Real Estate", type: "industry" },
  {
    code: "BK0428",
    name: "医药生物",
    nameEn: "Pharmaceutical",
    type: "industry",
  },
  { code: "BK0447", name: "计算机", nameEn: "Computer", type: "industry" },
  { code: "BK0448", name: "电子", nameEn: "Electronics", type: "industry" },
  { code: "BK0456", name: "传媒", nameEn: "Media", type: "industry" },
  {
    code: "BK0427",
    name: "食品饮料",
    nameEn: "Food & Beverage",
    type: "industry",
  },
  { code: "BK0481", name: "新能源", nameEn: "New Energy", type: "concept" },
  { code: "BK0493", name: "人工智能", nameEn: "AI", type: "concept" },
];
