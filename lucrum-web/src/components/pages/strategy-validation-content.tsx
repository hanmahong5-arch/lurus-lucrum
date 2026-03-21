"use client";

/**
 * Strategy Validation Content (v2 - Deep UX Improvement)
 *
 * Restructured layout:
 * 1. Mode Selector (single / multi / sector) - prominent top bar
 * 2. Target Selection (varies by mode)
 * 3. Strategy picker + Compact Config Bar
 * 4. Progressive Results:
 *    - L1: Summary Banner (grade + key metrics)
 *    - L2: Stock Ranking Table (expandable rows)
 *    - L3: Deep Analysis (collapsed by default)
 * 5. Batch Progress Bar (for multi/sector runs)
 *
 * Wired to validation-store for cross-navigation persistence.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  StrategyOption,
  SectorOption,
  ValidationConfig,
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
  ModeSelector,
  SectorPanel,
  ConfigBar,
  SummaryBanner,
} from "@/components/strategy-validation";
import { StrategySelector } from "@/components/strategy-validation/config-panel";
import { StockMultiSelector } from "@/components/strategy-validation/stock-multi-selector";
import { DataSourceBadge, mapDataSourceString } from "@/components/ui/data-source-badge";
import { BatchProgressBar } from "@/components/strategy-validation/batch-progress-bar";
import { FailureAnalysisPanel } from "@/components/strategy-validation/failure-analysis-panel";
import { useBatchBacktest } from "@/hooks/use-batch-backtest";
import { useOperationGuard } from "@/hooks/use-operation-guard";
import type { BatchBacktestRequest } from "@/lib/backtest/parallel/batch-backtest-types";
import { SimulatedDataBanner } from "@/components/ui/simulated-data-banner";
import { useValidationStore } from "@/lib/stores/validation-store";
import { useUserPreferencesStore } from "@/lib/stores/user-preferences-store";
import { useMarketDataStore } from "@/lib/stores/market-data-store";
import type { ValidationMode, BacktestConfig as StoreBacktestConfig } from "@/lib/stores/validation-store";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { ContextualHelp, CONTEXTUAL_HELP_CONTENT } from "@/components/ui/contextual-help";
import { ErrorCard } from "@/components/ui/error-card";
import { ErrorCatalog } from "@/lib/errors/error-catalog";
import { toAppError, parseApiError, type AppError } from "@/lib/errors/error-types";
import { useFeatureUsage } from "@/hooks/use-feature-usage";
import { getLimitsForPlan } from "@/lib/config/plan-limits";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";

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

function getDefaultDates(days: number = 365): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0] ?? "",
    endDate: end.toISOString().split("T")[0] ?? "",
  };
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
  // ---------------------------------------------------------------------------
  // Stores
  // ---------------------------------------------------------------------------
  const vStore = useValidationStore();
  const prefs = useUserPreferencesStore();
  const marketStore = useMarketDataStore();

  // ---------------------------------------------------------------------------
  // API data
  // ---------------------------------------------------------------------------
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // ---------------------------------------------------------------------------
  // Local transient state
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false);

  // Single stock search
  const [singleSearchQuery, setSingleSearchQuery] = useState("");
  const [singleSearchResults, setSingleSearchResults] = useState<Array<{ symbol: string; name: string; displayName: string; isST: boolean; exchange: string }>>([]);
  const [isSingleSearching, setIsSingleSearching] = useState(false);
  const [showSingleResults, setShowSingleResults] = useState(false);

  const batch = useBatchBacktest();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<number>(0);

  // Operation guard: prevents concurrent validations and confirms mode switches
  const validationGuard = useOperationGuard();

  // ---------------------------------------------------------------------------
  // Paywall: multi-stock limit based on plan
  // ---------------------------------------------------------------------------
  const { plan: userPlan } = useFeatureUsage();
  const planLimits = useMemo(() => getLimitsForPlan(userPlan), [userPlan]);
  const effectiveMaxStocks = useMemo(() => {
    const planMax = planLimits.maxMultiStocks;
    // 0 means feature not available; fall back to 3 for display
    return planMax <= 0 ? 3 : planMax;
  }, [planLimits]);
  const [multistockUpgradeOpen, setMultistockUpgradeOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived from store
  // ---------------------------------------------------------------------------
  const mode = vStore.mode;
  const storeConfig = vStore.config;
  const targets = vStore.targets;
  const sector = vStore.sector;

  // Initialize config from store or user preferences on mount
  useEffect(() => {
    if (!storeConfig.startDate || !storeConfig.endDate) {
      const defaults = getDefaultDates(365);
      vStore.updateConfig({
        startDate: defaults.startDate,
        endDate: defaults.endDate,
        capital: prefs.defaultCapital || 1000000,
        commission: prefs.defaultCommission || 0.0003,
      });
    }
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch strategies and sectors
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchOptions() {
      try {
        const response = await fetch("/api/backtest/sector");
        const data = await response.json();
        if (data.success && data.data) {
          const { strategies: strategyData, sectors: sectorData } = data.data;
          const builtinStrategies = (strategyData?.builtin ?? []).map(
            (s: { id: string; name: string; nameEn?: string; description: string }) => ({ ...s, type: "builtin" as const }),
          );
          const userStrategies = (strategyData?.user ?? []).map(
            (s: { id: string; name: string; description: string; code?: string; parameters?: Record<string, unknown> }) => ({ ...s, type: "custom" as const }),
          );
          setStrategies([...userStrategies, ...builtinStrategies]);
          const { industries = [], concepts = [] } = sectorData ?? {};
          const flatSectors: SectorOption[] = [
            ...industries.map((s: { code: string; name: string; nameEn?: string }) => ({ code: s.code, name: s.name, nameEn: s.nameEn, type: "industry" as const })),
            ...concepts.map((s: { code: string; name: string; nameEn?: string }) => ({ code: s.code, name: s.name, nameEn: s.nameEn, type: "concept" as const })),
          ];
          setSectors(flatSectors);
        } else {
          setStrategies(FALLBACK_STRATEGIES);
          setSectors(FALLBACK_SECTORS);
        }
      } catch {
        setStrategies(FALLBACK_STRATEGIES);
        setSectors(FALLBACK_SECTORS);
      } finally {
        setIsInitializing(false);
      }
    }
    fetchOptions();
  }, []);

  // ---------------------------------------------------------------------------
  // Single stock search
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (singleSearchQuery.length < 2) {
      setSingleSearchResults([]);
      setShowSingleResults(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSingleSearching(true);
      fetch(`/api/stocks/search?q=${encodeURIComponent(singleSearchQuery)}&limit=10`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.results) {
            setSingleSearchResults(data.results);
            setShowSingleResults(true);
          }
        })
        .catch(() => setSingleSearchResults([]))
        .finally(() => setIsSingleSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [singleSearchQuery]);

  // (click-outside for single stock search is handled inside SingleStockSelector)

  // ---------------------------------------------------------------------------
  // Validate handler
  // ---------------------------------------------------------------------------
  const handleValidate = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    // Validate targets per mode
    if (mode === "single") {
      if (targets.length === 0) {
        setError({
          code: 'VALIDATION_NO_TARGET',
          title: '未选择验证目标',
          description: '请先选择一只股票再开始验证',
          severity: 'warning',
          recoveryActions: [{ type: 'custom', label: '选择股票' }],
        });
        return;
      }
    } else if (mode === "multi") {
      if (targets.length === 0) {
        setError({
          code: 'VALIDATION_NO_TARGET',
          title: '未选择验证目标',
          description: '请至少选择一只股票再开始验证',
          severity: 'warning',
          recoveryActions: [{ type: 'custom', label: '选择股票' }],
        });
        return;
      }
    } else {
      if (!sector) {
        setError({
          code: 'VALIDATION_NO_SECTOR',
          title: '未选择板块',
          description: '请先选择一个行业板块再开始验证',
          severity: 'warning',
          recoveryActions: [{ type: 'custom', label: '选择板块' }],
        });
        return;
      }
    }

    if (!storeConfig.startDate || !storeConfig.endDate) {
      setError({
        code: 'VALIDATION_NO_DATE',
        title: '日期未设置',
        description: '请设置验证日期区间后再开始',
        severity: 'warning',
        recoveryActions: [{ type: 'custom', label: '设置日期' }],
      });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++lastRequestIdRef.current;

    setIsLoading(true);
    setError(null);
    setSelectedStock(null);
    setShowDeepAnalysis(false);
    vStore.setRunning(true);

    try {
      const symbols = targets.map((t) => t.symbol);
      const isSectorMode = mode === "sector";

      const apiEndpoint = isSectorMode ? "/api/backtest/sector" : "/api/backtest/multi-stocks";

      const requestBody = isSectorMode
        ? {
            strategy: storeConfig.strategyId,
            sectorCode: sector?.code,
            startDate: storeConfig.startDate,
            endDate: storeConfig.endDate,
            holdingDays: storeConfig.holdingDays,
            maxStocks: storeConfig.maxStocks,
            includeTransactionCosts: true,
            commissionRate: storeConfig.commission,
            excludeSTStocks: storeConfig.excludeST,
            excludeNewStocks: storeConfig.excludeNewStocks,
            deduplicateSignals: true,
            minMarketCap: storeConfig.minMarketCap,
            dataSource: "database",
            selectionMode: "sector",
          }
        : {
            symbols,
            strategy: storeConfig.strategyId,
            startDate: storeConfig.startDate,
            endDate: storeConfig.endDate,
            holdingDays: storeConfig.holdingDays,
            maxStocks: storeConfig.maxStocks,
            includeTransactionCosts: true,
            commissionRate: storeConfig.commission,
            excludeSTStocks: storeConfig.excludeST,
            deduplicateSignals: true,
            dataSource: "database",
          };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (requestId !== lastRequestIdRef.current) return;
      const data = await response.json();

      if (data.success && data.data) {
        setResult(data.data);
      } else if (data.success && data.stockResults) {
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
            })),
          ),
          returnDistribution: [],
          signalTimeline: [],
          meta: {
            executionTime: data.executionTime || 0,
            dataSource: data.dataSource || "unknown",
            timestamp: data.timestamp || new Date().toISOString(),
          },
        });
      } else {
        // Parse structured error from API response
        if (data.error && typeof data.error === 'object' && data.error.code) {
          setError({
            code: data.error.code,
            title: data.error.title ?? '验证失败',
            description: data.error.description ?? '未知错误',
            severity: data.error.severity ?? 'error',
            recoveryActions: data.error.recoveryActions ?? [{ type: 'retry', label: '重试' }],
          });
        } else {
          setError(ErrorCatalog.dataLoadFailed('验证结果'));
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId === lastRequestIdRef.current) {
        setError(toAppError(err, 'VALIDATION_ERROR'));
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setIsLoading(false);
        vStore.setRunning(false);
      }
    }
  }, [mode, targets, sector, storeConfig, vStore]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      vStore.setRunning(false);
      setError(null);
    }
  }, [vStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Signal filtering
  // ---------------------------------------------------------------------------
  const handleStockClick = useCallback((symbol: string | null) => {
    setSelectedStock(symbol);
    if (symbol) {
      setTimeout(() => {
        document.getElementById("signal-details-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  const filteredSignalDetails = useMemo(() => {
    if (!result?.signalDetails) return [];
    if (!selectedStock) return result.signalDetails;
    return result.signalDetails.filter((signal) => signal.symbol === selectedStock);
  }, [result?.signalDetails, selectedStock]);

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  const handleExport = useCallback(() => {
    if (!result) return;
    const exportData = {
      generatedAt: new Date().toISOString(),
      platform: "Lucrum AI Trading - Strategy Validation",
      ...result,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategy-validation-${result.summary.strategy}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  // ---------------------------------------------------------------------------
  // Favorites import for multi mode
  // ---------------------------------------------------------------------------
  const handleImportFavorites = useCallback(() => {
    const favs = marketStore.favorites;
    if (favs.length === 0) return;
    const newTargets = favs.map((f) => ({ symbol: f.symbol, name: f.name }));
    vStore.setTargets(newTargets);
  }, [marketStore.favorites, vStore]);

  // ---------------------------------------------------------------------------
  // Mode change
  // ---------------------------------------------------------------------------
  const handleModeChange = useCallback(
    (newMode: ValidationMode) => {
      // If validation is running, confirm before switching
      if (isLoading) {
        if (!validationGuard.confirmInterrupt("当前验证正在进行，切换模式将取消验证。确定？")) {
          return;
        }
        // Cancel the running validation
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setIsLoading(false);
        vStore.setRunning(false);
        validationGuard.finish();
      }
      vStore.setMode(newMode);
      setError(null);
    },
    [vStore, isLoading, validationGuard],
  );

  // ---------------------------------------------------------------------------
  // Config check: is start button disabled?
  // ---------------------------------------------------------------------------
  const isStartDisabled = useMemo(() => {
    if (isLoading) return true;
    if (!storeConfig.startDate || !storeConfig.endDate) return true;
    if (storeConfig.endDate < storeConfig.startDate) return true;
    if (mode === "single" && targets.length === 0) return true;
    if (mode === "multi" && targets.length === 0) return true;
    if (mode === "sector" && !sector) return true;
    return false;
  }, [isLoading, storeConfig, mode, targets, sector]);

  const startDisabledReason = useMemo(() => {
    if (isLoading) return '正在验证中...';
    if (!storeConfig.startDate || !storeConfig.endDate) return '请设置验证日期区间';
    if (storeConfig.endDate < storeConfig.startDate) return '结束日期必须晚于开始日期';
    if (mode === "single" && targets.length === 0) return '请先选择一只股票';
    if (mode === "multi" && targets.length === 0) return '请至少选择一只股票';
    if (mode === "sector" && !sector) return '请先选择一个行业板块';
    return undefined;
  }, [isLoading, storeConfig, mode, targets, sector]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

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
    <div className="space-y-5">
      {/* Page header with contextual help */}
      <div className="flex items-center justify-between">
        <div />
        <ContextualHelp
          sections={CONTEXTUAL_HELP_CONTENT.validation ?? []}
          title="策略验证帮助"
        />
      </div>

      {/* Error banner */}
      {error && (
        <ErrorCard
          error={error}
          compact
          onAction={(action) => {
            if (action.type === 'retry') {
              setError(null);
              void handleValidate();
            } else if (action.type === 'dismiss' || action.label === '关闭') {
              setError(null);
            } else {
              setError(null);
            }
          }}
        />
      )}

      {/* ================================================================= */}
      {/* 1. MODE SELECTOR                                                   */}
      {/* ================================================================= */}
      <ModeSelector
        mode={mode}
        onModeChange={handleModeChange}
        targetCount={targets.length}
        sectorName={sector?.name}
      />

      {/* ================================================================= */}
      {/* 2. TARGET SELECTION + STRATEGY                                     */}
      {/* ================================================================= */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Target selection */}
        <div className={`lg:col-span-2 ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
          <div className="rounded-xl border border-white/10 bg-surface/50 p-4">
            {/* Strategy selector (shared across modes) — disabled during validation */}
            <div className="mb-4">
              <StrategySelector
                strategies={strategies}
                selectedStrategy={storeConfig.strategyId}
                onStrategyChange={(id) => vStore.updateConfig({ strategyId: id })}
              />
            </div>

            {/* Target selector per mode */}
            {mode === "single" && (
              <SingleStockSelector
                targets={targets}
                searchQuery={singleSearchQuery}
                setSearchQuery={setSingleSearchQuery}
                searchResults={singleSearchResults}
                showResults={showSingleResults}
                setShowResults={setShowSingleResults}
                isSearching={isSingleSearching}
                recentSearches={marketStore.recentSearches}
                onSelect={(symbol, name) => {
                  vStore.setTargets([{ symbol, name }]);
                  setSingleSearchQuery("");
                  setShowSingleResults(false);
                  marketStore.addRecentSearch({ query: symbol, symbol, name });
                }}
                onClear={() => vStore.clearTargets()}
              />
            )}

            {mode === "multi" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">已选</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-mono tabular-nums">
                      {targets.length} 只股票
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleImportFavorites}
                      disabled={marketStore.favorites.length === 0}
                      className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      从收藏导入 ({marketStore.favorites.length})
                    </button>
                  </div>
                </div>
                <StockMultiSelector
                  selectedSymbols={targets.map((t) => t.symbol)}
                  onSelectionChange={(symbols) => {
                    // Paywall: if attempting to add beyond plan limit, show upgrade dialog
                    if (symbols.length > effectiveMaxStocks) {
                      setMultistockUpgradeOpen(true);
                      return;
                    }
                    // Preserve names for known targets, use symbol as fallback
                    const existing = new Map(targets.map((t) => [t.symbol, t.name]));
                    vStore.setTargets(symbols.map((s) => ({ symbol: s, name: existing.get(s) ?? s })));
                  }}
                  maxStocks={effectiveMaxStocks}
                  excludeST={storeConfig.excludeST}
                />
              </div>
            )}

            {mode === "sector" && (
              <SectorPanel
                sectors={sectors}
                selectedCode={sector?.code ?? ""}
                onSelect={(code, name, type) => vStore.setSector({ code, name, type })}
                excludeST={storeConfig.excludeST}
                onExcludeSTChange={(v) => vStore.updateConfig({ excludeST: v })}
                excludeNew={storeConfig.excludeNewStocks}
                onExcludeNewChange={(v) => vStore.updateConfig({ excludeNewStocks: v })}
                minMarketCap={storeConfig.minMarketCap}
                onMinMarketCapChange={(v) => vStore.updateConfig({ minMarketCap: v })}
              />
            )}
          </div>
        </div>

        {/* Right: Config summary */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-white/10 bg-surface/50 p-4 space-y-4 sticky top-4">
            <div className="text-sm font-medium text-white/80 mb-2">验证配置</div>

            {/* Holding days */}
            <div>
              <div className="text-xs text-white/40 mb-1.5">持有天数</div>
              <div className="flex gap-1.5">
                {[1, 3, 5, 10, 20].map((d) => (
                  <button
                    key={d}
                    onClick={() => vStore.updateConfig({ holdingDays: d })}
                    className={
                      storeConfig.holdingDays === d
                        ? "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/30"
                        : "flex-1 px-2 py-1.5 rounded-lg text-xs text-white/50 bg-white/5 hover:bg-white/10 border border-transparent"
                    }
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>

            {/* Config summary card */}
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2 text-xs">
              <SummaryRow label="策略" value={strategies.find((s) => s.id === storeConfig.strategyId)?.name ?? storeConfig.strategyId} />
              <SummaryRow
                label="目标"
                value={
                  mode === "single"
                    ? targets[0]?.name ?? "未选择"
                    : mode === "multi"
                      ? `${targets.length} 只股票`
                      : sector?.name ?? "未选择"
                }
              />
              <SummaryRow label="区间" value={storeConfig.startDate && storeConfig.endDate ? `${storeConfig.startDate} ~ ${storeConfig.endDate}` : "未设置"} />
              <SummaryRow label="持有" value={`${storeConfig.holdingDays} 天`} />
              <SummaryRow label="资金" value={`${(storeConfig.capital / 10000).toFixed(0)}万`} />
              <SummaryRow label="佣金" value={`万${(storeConfig.commission * 10000).toFixed(0)}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. CONFIG BAR                                                      */}
      {/* ================================================================= */}
      <ConfigBar
        config={storeConfig}
        onConfigChange={(patch) => vStore.updateConfig(patch)}
        onStart={handleValidate}
        onCancel={handleCancel}
        isRunning={isLoading}
        disabled={isStartDisabled}
        disabledReason={startDisabledReason}
      />

      {/* ================================================================= */}
      {/* BATCH PROGRESS                                                     */}
      {/* ================================================================= */}
      {batch.status !== "idle" && (
        <div>
          <BatchProgressBar
            status={batch.status}
            completed={batch.completed}
            total={batch.total}
            failed={batch.failed}
            elapsedMs={batch.elapsedMs}
            currentItem={batch.currentItem}
            onCancel={batch.cancelBatch}
          />
          {batch.result?.isAnomalyMode && batch.result.failureBreakdown.length > 0 && (
            <FailureAnalysisPanel
              breakdowns={batch.result.failureBreakdown}
              totalStocks={batch.result.summary.totalStocks}
              failedStocks={batch.result.summary.failedStocks}
              className="mt-3"
            />
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. RESULTS - PROGRESSIVE DISCLOSURE                                */}
      {/* ================================================================= */}

      {/* Loading state */}
      {isLoading && !result && (
        <div className="rounded-xl border border-white/10 bg-surface/50 p-12 text-center">
          <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">正在验证策略...</p>
          <p className="text-white/30 text-xs mt-1">
            {mode === "sector" ? `扫描 ${sector?.name ?? ""} 板块成分股` : `验证 ${targets.length} 只股票`}
          </p>
        </div>
      )}

      {/* Simulated data warning */}
      {result?.meta && hasSimulatedData(result.meta) && <SimulatedDataBanner visible={true} />}

      {/* L1: Summary Banner */}
      {result?.summary && (
        <SummaryBanner
          summary={result.summary}
          onExport={handleExport}
          onSave={() => {
            // Save results to store for cross-navigation persistence
            vStore.setResults(
              result.stockRanking.map((s, i) => ({
                symbol: s.symbol,
                name: s.stockName,
                totalReturn: s.totalReturn / 100,
                maxDrawdown: s.minReturn / 100,
                sharpeRatio: s.sharpeRatio ?? 0,
                winRate: s.winRate / 100,
                tradeCount: s.signalCount,
                score: Math.round(s.winRate * 0.4 + Math.min(s.avgReturn + 10, 20) * 3),
                grade: s.winRate >= 70 ? "S" : s.winRate >= 55 ? "A" : s.winRate >= 45 ? "B" : s.winRate >= 35 ? "C" : "D",
              })),
            );
          }}
        />
      )}

      {/* L2: Stock Ranking Table */}
      {result && result.stockRanking && result.stockRanking.length > 0 && (
        <StockRanking
          data={result.stockRanking}
          strategyName={result.summary.strategyName}
          sectorName={result.summary.sectorName}
          onStockClick={handleStockClick}
          selectedStock={selectedStock}
        />
      )}

      {/* L3: Deep Analysis (collapsed by default) */}
      {result && (result.returnDistribution?.length > 0 || result.signalTimeline?.length > 0 || result.signalDetails?.length > 0) && (
        <div>
          <button
            onClick={() => setShowDeepAnalysis((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-white/10 bg-surface/30 text-sm text-white/60 hover:text-white/80 hover:bg-surface/50 transition"
          >
            {showDeepAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>深度分析</span>
            <span className="text-xs text-white/30">
              ({[
                result.returnDistribution?.length > 0 && "收益分布",
                result.signalTimeline?.length > 0 && "信号时间线",
                result.signalDetails?.length > 0 && `${result.signalDetails.length}条信号明细`,
              ].filter(Boolean).join(" / ")})
            </span>
          </button>

          {showDeepAnalysis && (
            <div className="mt-4 space-y-5">
              {/* Return distribution histogram */}
              {result.returnDistribution && result.returnDistribution.length > 0 && (
                <ReturnDistribution
                  data={result.returnDistribution}
                  avgReturn={result.summary.avgReturn}
                  medianReturn={result.summary.medianReturn}
                />
              )}

              {/* Signal timeline */}
              {result.signalTimeline && result.signalTimeline.length > 0 && (
                <SignalTimeline data={result.signalTimeline} />
              )}

              {/* Signal details */}
              {result.signalDetails && result.signalDetails.length > 0 && (
                <div id="signal-details-section">
                  <SignalDetails
                    data={filteredSignalDetails}
                    strategyName={result.summary.strategyName}
                    sectorName={result.summary.sectorName}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Meta footer */}
      {result?.meta && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <p className="text-xs text-white/30">
            执行时间: {(result.meta.executionTime / 1000).toFixed(2)}s | 数据源:
          </p>
          <DataSourceBadge type={mapDataSourceString(result.meta.dataSource)} />
          <p className="text-xs text-white/30">
            | {new Date(result.meta.timestamp).toLocaleString("zh-CN")}
          </p>
        </div>
      )}

      {/* Multi-stock paywall upgrade dialog */}
      <UpgradeDialog
        open={multistockUpgradeOpen}
        onOpenChange={setMultistockUpgradeOpen}
        variant="multistock"
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Summary row for config card
 */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-medium">{value}</span>
    </div>
  );
}

/**
 * Single stock search + selection
 */
function SingleStockSelector({
  targets,
  searchQuery,
  setSearchQuery,
  searchResults,
  showResults,
  setShowResults,
  isSearching,
  recentSearches,
  onSelect,
  onClear,
}: {
  targets: Array<{ symbol: string; name: string }>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Array<{ symbol: string; name: string; displayName: string; isST: boolean; exchange: string }>;
  showResults: boolean;
  setShowResults: (v: boolean) => void;
  isSearching: boolean;
  recentSearches: Array<{ query: string; symbol?: string; name?: string; searchedAt: number }>;
  onSelect: (symbol: string, name: string) => void;
  onClear: () => void;
}) {
  const selected = targets[0];
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowResults]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-white/40">选择股票</div>

      {/* Show selected stock */}
      {selected ? (
        <div className="flex items-center justify-between p-3 rounded-lg border border-accent/20 bg-accent/5">
          <div>
            <span className="text-white font-medium">{selected.name}</span>
            <span className="text-white/40 text-sm ml-2 font-mono tabular-nums">{selected.symbol}</span>
          </div>
          <button
            onClick={onClear}
            className="text-xs text-white/40 hover:text-loss transition px-2 py-1"
          >
            更换
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="relative" ref={wrapperRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入股票代码或名称..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition text-sm"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => onSelect(stock.symbol, stock.name)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/5 transition border-b border-white/5 last:border-b-0"
                >
                  <span className="text-white font-medium text-sm">{stock.displayName}</span>
                  {stock.isST && (
                    <span className="text-xs px-1.5 py-0.5 bg-loss/20 text-loss rounded">ST</span>
                  )}
                  <span className="text-xs text-white/30 ml-auto">{stock.exchange}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {!showResults && recentSearches.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-white/30 mb-1.5">最近搜索</div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.slice(0, 8).map((r) => (
                  <button
                    key={r.query}
                    onClick={() => {
                      if (r.symbol && r.name) {
                        onSelect(r.symbol, r.name);
                      } else {
                        setSearchQuery(r.query);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition"
                  >
                    {r.name ? `${r.symbol} ${r.name}` : r.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
