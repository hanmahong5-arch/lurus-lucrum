/**
 * SmartStrategyPicker — Reverse matching: sector/stock -> best strategy
 *
 * Three-step flow:
 * 1. Select a sector (reuses sector list from backtest API)
 * 2. Set holding period
 * 3. View ranked strategy recommendations
 *
 * @module components/strategy-validation/smart-strategy-picker
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { AsyncButton } from "@/components/ui/async-button";
import type { AppError } from "@/lib/errors/error-types";
import type { ScoreGrade } from "@/lib/backtest/score/types";

// =============================================================================
// TYPES
// =============================================================================

interface SectorItem {
  code: string;
  name: string;
  nameEn?: string;
  type: "industry" | "concept";
}

interface ExampleTrade {
  symbol: string;
  name: string;
  entryDate: string;
  exitDate: string;
  returnPct: number;
}

interface Recommendation {
  strategyId: string;
  name: string;
  nameEn: string;
  description: string;
  compositeScore: number;
  grade: ScoreGrade;
  gradeLabel: string;
  winRate: number;
  avgReturn: number;
  totalSignals: number;
  stocksWithSignals: number;
  signalDensity: number;
  consistency: number;
  exampleTrades: ExampleTrade[];
  explanation: string;
}

interface RecommendResponse {
  success: boolean;
  data?: {
    recommendations: Recommendation[];
    meta: {
      stockCount: number;
      totalStocksRequested: number;
      holdingDays: number;
      dataRange: string;
      missingStocks: number;
    };
  };
  error?: AppError;
  cached?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HOLDING_DAYS_OPTIONS = [3, 5, 10, 15, 20, 30];

const HOT_SECTORS: SectorItem[] = [
  { code: "BK0420", name: "电力", type: "industry" },
  { code: "BK0437", name: "银行", type: "industry" },
  { code: "BK0447", name: "计算机", type: "industry" },
  { code: "BK0428", name: "医药", type: "industry" },
  { code: "BK0481", name: "新能源", type: "industry" },
  { code: "BK0493", name: "AI概念", type: "concept" },
  { code: "BK0448", name: "电子", type: "industry" },
  { code: "BK0427", name: "食品饮料", type: "industry" },
];

const GRADE_COLORS: Record<ScoreGrade, string> = {
  S: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  A: "text-profit bg-profit/10 border-profit/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-neutral-400 bg-neutral-400/10 border-neutral-400/30",
  D: "text-loss bg-loss/10 border-loss/30",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function SmartStrategyPicker() {
  // Step state
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);
  const [holdingDays, setHoldingDays] = useState(10);
  const [sectors, setSectors] = useState<SectorItem[]>(HOT_SECTORS);

  // Results
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [meta, setMeta] = useState<RecommendResponse["data"]>();
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch full sector list on mount
  useEffect(() => {
    async function fetchSectors() {
      try {
        const resp = await fetch("/api/backtest/sector");
        const data = await resp.json();
        if (data.success && data.data?.sectors) {
          const { industries = [], concepts = [] } = data.data.sectors;
          const all: SectorItem[] = [
            ...industries.map((s: { code: string; name: string; nameEn?: string }) => ({
              code: s.code, name: s.name, nameEn: s.nameEn, type: "industry" as const,
            })),
            ...concepts.map((s: { code: string; name: string; nameEn?: string }) => ({
              code: s.code, name: s.name, nameEn: s.nameEn, type: "concept" as const,
            })),
          ];
          if (all.length > 0) setSectors(all);
        }
      } catch {
        // Keep HOT_SECTORS as fallback
      }
    }
    void fetchSectors();
  }, []);

  // Run recommendation
  const handleRecommend = useCallback(async () => {
    if (!selectedSector) return;

    setIsLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const resp = await fetch("/api/strategy/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorCode: selectedSector.code,
          holdingDays,
        }),
      });

      const data: RecommendResponse = await resp.json();

      if (data.success && data.data) {
        setRecommendations(data.data.recommendations);
        setMeta(data.data);
      } else if (resp.status === 429) {
        // Rate limited or concurrency limit
        const retryAfter = resp.headers.get('Retry-After');
        setError({
          code: data.error?.code ?? 'RATE_LIMITED',
          title: data.error?.title ?? '请求过于频繁',
          description: data.error?.description
            ?? (retryAfter ? `请等待${retryAfter}秒后再试` : '请求过于频繁，请稍后再试'),
          severity: 'warning',
          recoveryActions: [{ type: 'dismiss', label: '知道了' }],
        });
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError({
        code: "NETWORK_ERROR",
        title: "网络错误",
        description: "无法连接到推荐服务，请检查网络",
        severity: "error",
        recoveryActions: [{ type: "retry", label: "重试" }],
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedSector, holdingDays]);

  return (
    <div className="space-y-6">
      {/* Step 1: Select Sector */}
      <div className="glass-panel rounded-xl p-5">
        <StepHeader step={1} title="选择板块" subtitle="选择一个行业或概念板块" />
        <div className="mt-4 flex flex-wrap gap-2">
          {sectors.slice(0, 24).map((sector) => (
            <button
              key={sector.code}
              onClick={() => {
                setSelectedSector(sector);
                setRecommendations([]);
                setError(null);
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-all btn-tactile",
                selectedSector?.code === sector.code
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-surface border-white/5 text-neutral-300 hover:border-white/15 hover:bg-surface-hover",
              )}
            >
              {sector.name}
            </button>
          ))}
        </div>
        {selectedSector && (
          <p className="mt-3 text-xs text-neutral-400">
            已选择: <span className="text-primary">{selectedSector.name}</span>
            <span className="text-neutral-500 ml-1">({selectedSector.code})</span>
          </p>
        )}
      </div>

      {/* Step 2: Set Holding Period */}
      <div className="glass-panel rounded-xl p-5">
        <StepHeader step={2} title="设置持仓周期" subtitle="信号触发后持有多少个交易日" />
        <div className="mt-4 flex flex-wrap gap-2">
          {HOLDING_DAYS_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => {
                setHoldingDays(days);
                setRecommendations([]);
              }}
              className={cn(
                "px-4 py-2 text-sm rounded-lg border transition-all btn-tactile font-mono tabular-nums",
                holdingDays === days
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-surface border-white/5 text-neutral-300 hover:border-white/15 hover:bg-surface-hover",
              )}
            >
              {days}天
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <AsyncButton
          onClick={handleRecommend}
          disabled={!selectedSector}
          loadingText="正在扫描所有策略..."
          successText="推荐完成"
          variant="primary"
          className="px-8 py-3 text-base"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          开始智能选策
        </AsyncButton>
      </div>

      {/* Error */}
      {error && (
        <ErrorCard
          error={error}
          onAction={(action) => {
            if (action.label === "重试") {
              void handleRecommend();
            }
          }}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">
            正在扫描 9 种策略在「{selectedSector?.name}」板块中的表现...
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            首次扫描可能需要 10-30 秒，后续将命中缓存
          </p>
        </div>
      )}

      {/* Step 3: Results */}
      {recommendations.length > 0 && meta && (
        <div className="space-y-4">
          {/* Meta info */}
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="text-sm font-medium text-neutral-200">策略排名</h3>
            </div>
            <p className="text-xs text-neutral-500">
              基于 {meta.meta.stockCount} 只股票 · 持仓 {meta.meta.holdingDays} 天 · 数据范围 {meta.meta.dataRange}
            </p>
          </div>

          {/* Recommendation cards */}
          {recommendations.map((rec, idx) => (
            <RecommendationCard key={rec.strategyId} rec={rec} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {step}
      </div>
      <div>
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        {/* Rank */}
        <span className="text-lg font-bold text-neutral-500 font-mono tabular-nums w-6 shrink-0">
          {rank}
        </span>

        {/* Grade badge */}
        <div
          className={cn(
            "px-2 py-0.5 rounded-md border text-sm font-bold shrink-0",
            GRADE_COLORS[rec.grade],
          )}
        >
          {rec.grade}
        </div>

        {/* Strategy name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-100">{rec.name}</span>
            <span className="text-xs text-neutral-500">{rec.nameEn}</span>
          </div>
          <p className="text-xs text-neutral-500 truncate mt-0.5">
            {rec.description}
          </p>
        </div>

        {/* Key metrics */}
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <MetricBadge
            label="胜率"
            value={`${rec.winRate.toFixed(0)}%`}
            colored={rec.winRate >= 50}
          />
          <MetricBadge
            label="收益"
            value={`${rec.avgReturn >= 0 ? "+" : ""}${rec.avgReturn.toFixed(1)}%`}
            colored={rec.avgReturn > 0}
            negative={rec.avgReturn < 0}
          />
          <MetricBadge
            label="信号"
            value={String(rec.totalSignals)}
          />
        </div>

        {/* Expand chevron */}
        <svg
          className={cn(
            "w-4 h-4 text-neutral-500 transition-transform shrink-0",
            expanded && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          {/* Explanation */}
          <p className="text-sm text-neutral-300 leading-relaxed">
            {rec.explanation}
          </p>

          {/* Detailed metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricTile label="综合评分" value={rec.compositeScore.toFixed(1)} />
            <MetricTile label="覆盖股票" value={`${rec.stocksWithSignals}只`} />
            <MetricTile label="信号密度" value={`${rec.signalDensity.toFixed(1)}/只`} />
            <MetricTile label="一致性" value={rec.consistency < 10 ? "高" : rec.consistency < 20 ? "中" : "低"} />
          </div>

          {/* Example trades */}
          {rec.exampleTrades.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 mb-2">最佳交易示例</p>
              <div className="space-y-1.5">
                {rec.exampleTrades.map((trade, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-surface/50 rounded-lg px-3 py-2"
                  >
                    <span className="text-neutral-300">
                      {trade.name}
                      <span className="text-neutral-500 ml-1">({trade.symbol})</span>
                    </span>
                    <span className="text-neutral-500">
                      {trade.entryDate} ~ {trade.exitDate}
                    </span>
                    <span
                      className={cn(
                        "font-mono tabular-nums font-medium",
                        trade.returnPct > 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {trade.returnPct > 0 ? "+" : ""}{trade.returnPct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricBadge({
  label,
  value,
  colored = false,
  negative = false,
}: {
  label: string;
  value: string;
  colored?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "text-sm font-mono tabular-nums font-medium",
          colored ? "text-profit" : negative ? "text-loss" : "text-neutral-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface/50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm text-neutral-200 font-medium">{value}</p>
    </div>
  );
}
