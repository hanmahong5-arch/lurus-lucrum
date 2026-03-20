"use client";

/**
 * Strategy Validation Content (extracted from the original page)
 *
 * This is the core content of the strategy validation feature,
 * extracted to be embeddable in the unified Validation hub tabs.
 * It does NOT include DashboardHeader or page-level chrome.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
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
import { BatchProgressBar } from "@/components/strategy-validation/batch-progress-bar";
import { FailureAnalysisPanel } from "@/components/strategy-validation/failure-analysis-panel";
import { useBatchBacktest } from "@/hooks/use-batch-backtest";
import type { BatchBacktestRequest } from "@/lib/backtest/parallel/batch-backtest-types";
import { SimulatedDataBanner } from "@/components/ui/simulated-data-banner";

// =============================================================================
// TYPES
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
// HELPERS
// =============================================================================

function hasSimulatedData(meta: ValidationResult["meta"]): boolean {
  return mapDataSourceString(meta.dataSource) === "simulated";
}

// =============================================================================
// FALLBACK DATA
// =============================================================================

const FALLBACK_STRATEGIES: StrategyOption[] = [
  { id: "macd_golden_cross", name: "MACD金叉", nameEn: "MACD Golden Cross", description: "DIF上穿DEA产生买入信号", type: "builtin" },
  { id: "macd_death_cross", name: "MACD死叉", nameEn: "MACD Death Cross", description: "DIF下穿DEA产生卖出信号", type: "builtin" },
  { id: "rsi_oversold", name: "RSI超卖", nameEn: "RSI Oversold", description: "RSI低于30产生买入信号", type: "builtin" },
  { id: "rsi_overbought", name: "RSI超买", nameEn: "RSI Overbought", description: "RSI高于70产生卖出信号", type: "builtin" },
  { id: "ma_golden_cross", name: "均线金叉", nameEn: "MA Golden Cross", description: "MA5上穿MA20产生买入信号", type: "builtin" },
  { id: "boll_lower_break", name: "布林带下轨", nameEn: "BOLL Lower Break", description: "价格触及下轨产生买入信号", type: "builtin" },
  { id: "volume_breakout", name: "放量突破", nameEn: "Volume Breakout", description: "放量突破20日高点", type: "builtin" },
];

const FALLBACK_SECTORS: SectorOption[] = [
  { code: "BK0420", name: "电力", nameEn: "Electric Power", type: "industry" },
  { code: "BK0437", name: "银行", nameEn: "Banking", type: "industry" },
  { code: "BK0475", name: "房地产", nameEn: "Real Estate", type: "industry" },
  { code: "BK0428", name: "医药生物", nameEn: "Pharmaceutical", type: "industry" },
  { code: "BK0447", name: "计算机", nameEn: "Computer", type: "industry" },
  { code: "BK0448", name: "电子", nameEn: "Electronics", type: "industry" },
  { code: "BK0456", name: "传媒", nameEn: "Media", type: "industry" },
  { code: "BK0427", name: "食品饮料", nameEn: "Food & Beverage", type: "industry" },
  { code: "BK0481", name: "新能源", nameEn: "New Energy", type: "concept" },
  { code: "BK0493", name: "人工智能", nameEn: "AI", type: "concept" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyValidationContent() {
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const batch = useBatchBacktest();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<number>(0);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const response = await fetch("/api/backtest/sector");
        const data = await response.json();
        if (data.success && data.data) {
          const { strategies: strategyData, sectors: sectorData } = data.data;
          const builtinStrategies = (strategyData?.builtin ?? []).map(
            (s: { id: string; name: string; nameEn?: string; description: string }) => ({ ...s, type: "builtin" as const })
          );
          const userStrategies = (strategyData?.user ?? []).map(
            (s: { id: string; name: string; description: string; code?: string; parameters?: Record<string, unknown> }) => ({ ...s, type: "custom" as const })
          );
          setStrategies([...userStrategies, ...builtinStrategies]);
          const { industries = [], concepts = [] } = sectorData ?? {};
          const flatSectors: SectorOption[] = [
            ...industries.map((s: { code: string; name: string; nameEn?: string }) => ({ code: s.code, name: s.name, nameEn: s.nameEn, type: "industry" as const })),
            ...concepts.map((s: { code: string; name: string; nameEn?: string }) => ({ code: s.code, name: s.name, nameEn: s.nameEn, type: "concept" as const })),
          ];
          setSectors(flatSectors);
        } else {
          setError(data.error ?? "Failed to load options");
          setStrategies(FALLBACK_STRATEGIES);
          setSectors(FALLBACK_SECTORS);
        }
      } catch {
        setError("无法加载配置选项，使用默认数据");
        setStrategies(FALLBACK_STRATEGIES);
        setSectors(FALLBACK_SECTORS);
      } finally {
        setIsInitializing(false);
      }
    }
    fetchOptions();
  }, []);

  const handleValidate = useCallback(async (config: ValidationConfig) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (config.selectionMode === "stocks") {
      if (!config.selectedSymbols || config.selectedSymbols.length === 0) {
        setError("请至少选择一只股票");
        return;
      }
    } else {
      if (!config.sectorCode) {
        setError("请选择一个行业板块");
        return;
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++lastRequestIdRef.current;

    setIsLoading(true);
    setError(null);
    setSelectedStock(null);

    try {
      const apiEndpoint = config.selectionMode === "stocks" ? "/api/backtest/multi-stocks" : "/api/backtest/sector";
      const requestBody = config.selectionMode === "stocks"
        ? { symbols: config.selectedSymbols, strategy: config.strategy, startDate: config.startDate, endDate: config.endDate, holdingDays: config.holdingDays, maxStocks: config.maxStocks, includeTransactionCosts: config.includeTransactionCosts, excludeSTStocks: config.excludeSTStocks, deduplicateSignals: config.deduplicateSignals, dataSource: "database" }
        : config;

      const response = await fetch(apiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody), signal: controller.signal });
      if (requestId !== lastRequestIdRef.current) return;
      const data = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
      } else if (data.success && data.stockResults) {
        setResult({
          summary: data.summary,
          stockRanking: data.stockResults.map((s: MultiStockResult) => ({ symbol: s.symbol, name: s.name, signalCount: s.signalCount, avgReturn: s.avgReturn, winRate: s.winRate, totalReturn: s.totalReturn })),
          signalDetails: data.stockResults.flatMap((s: MultiStockResult) => s.signals.map((signal) => ({ symbol: s.symbol, name: s.name, date: signal.date, type: signal.type, price: signal.price, return: signal.return }))),
          returnDistribution: [],
          signalTimeline: [],
          meta: { executionTime: data.executionTime || 0, dataSource: data.dataSource || "unknown", timestamp: data.timestamp || new Date().toISOString() },
        });
      } else {
        setError(data.error ?? "验证失败");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId === lastRequestIdRef.current) setError(err instanceof Error ? err.message : "验证出错");
    } finally {
      if (requestId === lastRequestIdRef.current) setIsLoading(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setError(null);
    }
  }, []);

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  const handleStockClick = useCallback((symbol: string | null) => {
    setSelectedStock(symbol);
    if (symbol) setTimeout(() => { document.getElementById("signal-details-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  }, []);

  const filteredSignalDetails = useMemo(() => {
    if (!result?.signalDetails) return [];
    if (!selectedStock) return result.signalDetails;
    return result.signalDetails.filter((signal) => signal.symbol === selectedStock);
  }, [result?.signalDetails, selectedStock]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const exportData = { generatedAt: new Date().toISOString(), platform: "Lucrum AI Trading - Strategy Validation", ...result };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategy-validation-${result.summary.strategy}-${result.summary.sector}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StrategyGuideCard currentStep="validation" className="mb-6" />

      {error && (
        <div className="mb-6 p-4 bg-loss/10 border border-loss/30 rounded-lg">
          <p className="text-loss text-sm">{error}</p>
        </div>
      )}

      {batch.status !== "idle" && (
        <div className="mb-6">
          <BatchProgressBar status={batch.status} completed={batch.completed} total={batch.total} failed={batch.failed} elapsedMs={batch.elapsedMs} currentItem={batch.currentItem} onCancel={batch.cancelBatch} />
          {batch.result?.isAnomalyMode && batch.result.failureBreakdown.length > 0 && (
            <FailureAnalysisPanel breakdowns={batch.result.failureBreakdown} totalStocks={batch.result.summary.totalStocks} failedStocks={batch.result.summary.failedStocks} className="mt-4" />
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ConfigPanel strategies={strategies} sectors={sectors} onValidate={handleValidate} onCancel={handleCancel} isLoading={isLoading} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {result?.meta && hasSimulatedData(result.meta) && <SimulatedDataBanner visible={true} />}
          <ResultSummary summary={result?.summary ?? null} isLoading={isLoading} />
          {result && result.returnDistribution && result.returnDistribution.length > 0 && (
            <ReturnDistribution data={result.returnDistribution} avgReturn={result.summary.avgReturn} medianReturn={result.summary.medianReturn} />
          )}
          {result && result.signalTimeline && result.signalTimeline.length > 0 && <SignalTimeline data={result.signalTimeline} />}
          {result && result.stockRanking && result.stockRanking.length > 0 && (
            <StockRanking data={result.stockRanking} strategyName={result.summary.strategyName} sectorName={result.summary.sectorName} onStockClick={handleStockClick} selectedStock={selectedStock} />
          )}
          {result && result.signalDetails && result.signalDetails.length > 0 && (
            <div id="signal-details-section">
              <SignalDetails data={filteredSignalDetails} strategyName={result.summary.strategyName} sectorName={result.summary.sectorName} />
            </div>
          )}
          {result && (
            <div className="flex justify-end gap-4">
              <button onClick={handleExport} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition">
                导出JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {result?.meta && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <p className="text-xs text-white/30">执行时间: {(result.meta.executionTime / 1000).toFixed(2)}s | 数据源:</p>
          <DataSourceBadge type={mapDataSourceString(result.meta.dataSource)} />
          <p className="text-xs text-white/30">| 时间戳: {new Date(result.meta.timestamp).toLocaleString("zh-CN")}</p>
        </div>
      )}
    </div>
  );
}
