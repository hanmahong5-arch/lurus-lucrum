"use client";

/**
 * StrategyCard - Redesigned marketplace strategy card.
 *
 * Layout:
 *  [Grade] Title
 *  ───────────
 *  Annualized  WinRate
 *  MaxDrawdown  Sharpe
 *  ───────────
 *  Sparkline (1yr NAV)
 *  ───────────
 *  Author  Rating (count)
 *  [Try Free] [Details]
 */

import { cn } from "@/lib/utils";
import { Star, TrendingUp, User } from "lucide-react";
import { Sparkline } from "./sparkline";
import {
  LikeButton,
  ShareButton,
  CommentSection,
} from "./strategy-social";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import {
  MarketplaceDecisionBadges,
} from "@/components/ui/decision-badge";

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceStrategy {
  id: number;
  title: string;
  description: string | null;
  priceType: string;
  pricePerRun: number | null;
  priceMonthly: number | null;
  gradeScore: string | null;
  totalRuns: number | null;
  totalSubscribers: number | null;
  publishedAt: string | null;
  authorName: string | null;
  /** Key metrics for card display */
  annualizedReturn?: number | null;
  winRate?: number | null;
  maxDrawdown?: number | null;
  sharpeRatio?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  /** Aggregated rating from strategy_ratings (string-encoded numeric from PG). */
  ratingAvg?: string | number | null;
  forkCount?: number | null;
  school?: string | null;
  authorUserId?: string | null;
  /** Net asset value history for sparkline (last ~60 points) */
  navHistory?: number[];
}

// =============================================================================
// GRADE BADGE
// =============================================================================

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  S: { bg: "bg-score-s/20", text: "text-score-s", border: "border-score-s/30", label: "S" },
  A: { bg: "bg-score-a/20", text: "text-score-a", border: "border-score-a/30", label: "A" },
  B: { bg: "bg-score-b/20", text: "text-score-b", border: "border-score-b/30", label: "B" },
  C: { bg: "bg-score-c/20", text: "text-score-c", border: "border-score-c/30", label: "C" },
  D: { bg: "bg-score-d/20", text: "text-score-d", border: "border-score-d/30", label: "D" },
};

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  const letter = grade.charAt(0).toUpperCase();
  const cfg = GRADE_CONFIG[letter];
  if (!cfg) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold rounded border",
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
      aria-label={`Grade ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}

// =============================================================================
// METRIC CELL
// =============================================================================

function MetricCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-white/40 leading-none">{label}</span>
      <span
        className={cn(
          "text-sm font-mono tabular-nums leading-none",
          colorClass ?? "text-white/80",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// =============================================================================
// STAR RATING
// =============================================================================

function StarRating({
  rating,
  count,
}: {
  rating: number;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
      <Star className="w-3 h-3 fill-accent text-accent" />
      <span className="font-mono tabular-nums text-accent/80">
        {rating.toFixed(1)}
      </span>
      <span>({count})</span>
    </span>
  );
}

// =============================================================================
// STRATEGY CARD
// =============================================================================

interface StrategyCardProps {
  strategy: MarketplaceStrategy;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  onSubscribe: (id: number) => void;
  onViewDetail: (strategy: MarketplaceStrategy) => void;
}

export function StrategyCard({
  strategy,
  selected = false,
  onToggleSelect,
  onSubscribe,
  onViewDetail,
}: StrategyCardProps) {
  const annualized = strategy.annualizedReturn ?? null;
  const winRate = strategy.winRate ?? null;
  const maxDD = strategy.maxDrawdown ?? null;
  const sharpe = strategy.sharpeRatio ?? null;
  const isFree = strategy.priceType === "free";

  // Generate mock sparkline data if none provided
  const navData = strategy.navHistory ?? generateMockNav(strategy.id);

  return (
    <div
      className={cn(
        "relative flex flex-col p-4 bg-surface rounded-lg border transition-all duration-200 group",
        selected
          ? "border-accent/50 glow-active-accent"
          : "border-border hover:border-white/20",
      )}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(strategy.id);
          }}
          className={cn(
            "absolute top-3 right-3 w-5 h-5 rounded border flex items-center justify-center transition",
            selected
              ? "bg-accent border-accent text-void"
              : "border-white/20 hover:border-white/40",
          )}
          aria-label={selected ? "Deselect strategy" : "Select strategy for comparison"}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      {/* Hero: 年化数字 (视觉主体, 大字 mono) — 用户决策路径的真正第一信号 */}
      <div className="flex items-baseline justify-between mb-1 pr-6">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-2xl font-mono tabular-nums font-semibold leading-none",
              annualized != null
                ? annualized >= 0
                  ? "text-profit"
                  : "text-loss"
                : "text-white/30",
            )}
          >
            {annualized != null
              ? `${annualized >= 0 ? "+" : ""}${annualized.toFixed(1)}%`
              : "--"}
          </span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            年化
          </span>
        </div>
        <GradeBadge grade={strategy.gradeScore} />
      </div>

      {/* Title (narrative) + 合规 hedging mini-badge */}
      <div className="flex items-center justify-between gap-2 mb-3 pr-6">
        <h3 className="text-sm font-semibold text-white group-hover:text-accent transition line-clamp-1">
          {strategy.title}
        </h3>
        <span
          className="text-[9px] text-white/30 uppercase tracking-wide whitespace-nowrap"
          title="本平台不提供投资建议，所有策略仅用于教育研究与回测验证"
        >
          教育用途
        </span>
      </div>

      {/* Decision badges */}
      <MarketplaceDecisionBadges
        metrics={{
          annualizedReturn: annualized,
          maxDrawdown: maxDD,
          winRate: winRate,
          sharpeRatio: sharpe,
          totalRuns: strategy.totalRuns,
          totalSubscribers: strategy.totalSubscribers,
        }}
        className="mb-2"
      />

      {/* Divider */}
      <div className="h-px bg-white/5 mb-3" />

      {/* Key Metrics Grid (2x2) — 年化已搬到 hero,这里展示辅助指标 + 社交证明 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <SmartTooltip term="winRate">
          <MetricCell
            label="胜率"
            value={winRate != null ? `${winRate.toFixed(0)}%` : "--"}
          />
        </SmartTooltip>
        <SmartTooltip term="maxDrawdown">
          <MetricCell
            label="回撤"
            value={maxDD != null ? `${maxDD.toFixed(1)}%` : "--"}
            colorClass={maxDD != null && maxDD < 0 ? "text-loss" : undefined}
          />
        </SmartTooltip>
        <SmartTooltip term="sharpe">
          <MetricCell
            label="Sharpe"
            value={sharpe != null ? sharpe.toFixed(2) : "--"}
            colorClass={
              sharpe != null
                ? sharpe >= 1.5
                  ? "text-profit"
                  : sharpe >= 1.0
                    ? "text-accent"
                    : undefined
                : undefined
            }
          />
        </SmartTooltip>
        <MetricCell
          label="使用人数"
          value={
            strategy.totalRuns != null
              ? strategy.totalRuns.toLocaleString()
              : "--"
          }
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mb-3" />

      {/* Sparkline */}
      <div className="flex items-center justify-center mb-3">
        <Sparkline
          data={navData}
          width={180}
          height={36}
          positive={annualized != null ? annualized >= 0 : undefined}
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mb-3" />

      {/* Author + Rating + Social */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <User className="w-3 h-3" />
          <span className="max-w-[80px] truncate">
            {strategy.authorName ?? "匿名"}
          </span>
        </div>
        <StarRating
          rating={strategy.rating ?? 4.0}
          count={strategy.ratingCount ?? strategy.totalSubscribers ?? 0}
        />
      </div>

      {/* Social row */}
      <div className="flex items-center gap-4 mb-3">
        <LikeButton strategyId={strategy.id} />
        <CommentSection strategyId={strategy.id} />
        <ShareButton strategyId={strategy.id} title={strategy.title} />
        <span className="ml-auto text-[10px] text-white/30 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span className="font-mono tabular-nums">{strategy.totalRuns ?? 0}</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onSubscribe(strategy.id)}
          className={cn(
            "flex-1 py-2 text-xs rounded-lg font-medium transition btn-tactile",
            isFree
              ? "bg-profit/10 text-profit hover:bg-profit/20 border border-profit/20"
              : "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
          )}
        >
          {isFree ? "免费试用" : `${strategy.priceMonthly ?? strategy.pricePerRun ?? 0} LB`}
        </button>
        <button
          onClick={() => onViewDetail(strategy)}
          className="flex-1 py-2 text-xs rounded-lg font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition btn-tactile"
        >
          查看详情
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MOCK NAV HELPER (deterministic from ID)
// =============================================================================

function generateMockNav(seed: number): number[] {
  const points = 60;
  const result: number[] = [1.0];
  let value = 1.0;
  // Simple seeded PRNG for consistent per-card sparklines
  let s = seed * 9301 + 49297;
  for (let i = 1; i < points; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.48; // slight upward bias
    value = value * (1 + r * 0.03);
    result.push(value);
  }
  return result;
}
