"use client";

/**
 * StrategyShowcase - Landing page hook section.
 * Displays top featured strategies with sparklines, metrics, and grade badges.
 * Fetches from /api/strategies/featured (public, no auth).
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface EquityPoint {
  date: string;
  value: number;
}

interface FeaturedStrategy {
  id: string;
  name: string;
  grade: "S" | "A" | "B";
  description: string;
  annualReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpe: number;
  backtestPeriod: string;
  tradeCount: number;
  avgHoldDays: number;
  indicators: string[];
  equityCurve: EquityPoint[];
}

// =============================================================================
// GRADE CONFIG
// =============================================================================

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  S: {
    bg: "bg-score-s/15",
    text: "text-score-s",
    border: "border-score-s/30",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.15)]",
  },
  A: {
    bg: "bg-score-a/15",
    text: "text-score-a",
    border: "border-score-a/30",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.1)]",
  },
  B: {
    bg: "bg-score-b/15",
    text: "text-score-b",
    border: "border-score-b/30",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]",
  },
};

// =============================================================================
// SPARKLINE (inline, self-contained for landing page)
// =============================================================================

function EquitySparkline({
  data,
  width = 280,
  height = 80,
}: {
  data: EquityPoint[];
  width?: number;
  height?: number;
}) {
  const { pathD, areaD, isPositive } = useMemo(() => {
    const values = data.map((p) => p.value);
    if (values.length < 2) return { pathD: "", areaD: "", isPositive: true };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = 4;
    const drawW = width - pad * 2;
    const drawH = height - pad * 2;

    const points = values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * drawW;
      const y = pad + drawH - ((v - min) / range) * drawH;
      return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };
    });

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const area = lastPoint && firstPoint
      ? `${line}L${lastPoint.x},${height}L${firstPoint.x},${height}Z`
      : "";

    const lastVal = values[values.length - 1] ?? 0;
    const firstVal = values[0] ?? 0;

    return { pathD: line, areaD: area, isPositive: lastVal >= firstVal };
  }, [data, width, height]);

  if (data.length < 2) return null;

  const strokeColor = isPositive
    ? "rgb(var(--color-profit))"
    : "rgb(var(--color-loss))";
  const fillColor = isPositive
    ? "rgb(var(--color-profit) / 0.08)"
    : "rgb(var(--color-loss) / 0.08)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      aria-label="Strategy equity curve"
    >
      <defs>
        <linearGradient id="equity-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#equity-fade)" />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// =============================================================================
// STRATEGY CARD
// =============================================================================

function StrategyCard({ strategy }: { strategy: FeaturedStrategy }) {
  const gradeStyle = GRADE_STYLES[strategy.grade] ?? GRADE_STYLES.B;

  return (
    <Link
      href={`/strategy/${strategy.id}`}
      className={cn(
        "group relative flex flex-col rounded-xl border transition-all duration-300",
        "bg-surface/60 backdrop-blur-sm hover:bg-surface/80",
        "border-white/[0.06] hover:border-white/[0.12]",
        "hover:scale-[1.02] hover:-translate-y-1",
        gradeStyle?.glow ? `hover:${gradeStyle.glow}` : "",
      )}
    >
      {/* Gradient border overlay on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative p-5 flex flex-col gap-4">
        {/* Header: grade + title */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border",
              gradeStyle?.bg,
              gradeStyle?.text,
              gradeStyle?.border,
            )}
          >
            {strategy.grade}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate">
              {strategy.name}
            </h3>
            <p className="text-sm text-neutral-400 mt-0.5 line-clamp-1">
              {strategy.description}
            </p>
          </div>
        </div>

        {/* Equity curve */}
        <div className="rounded-lg bg-void/40 p-2 -mx-1">
          <EquitySparkline data={strategy.equityCurve} height={72} />
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-mono tabular-nums font-semibold text-profit">
              +{strategy.annualReturn}%
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">年化收益</div>
          </div>
          <div>
            <div className="text-lg font-mono tabular-nums font-semibold text-white">
              {strategy.sharpe}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">夏普比率</div>
          </div>
          <div>
            <div className="text-lg font-mono tabular-nums font-semibold text-white">
              {strategy.backtestPeriod.includes("~")
                ? `${Math.round(
                    (new Date(strategy.backtestPeriod.split("~")[1]?.trim() ?? "").getTime() -
                      new Date(strategy.backtestPeriod.split("~")[0]?.trim() ?? "").getTime()) /
                      (365.25 * 24 * 60 * 60 * 1000),
                  )}年`
                : strategy.backtestPeriod}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">回测周期</div>
          </div>
        </div>

        {/* CTA hint */}
        <div className="flex items-center justify-end text-sm text-neutral-500 group-hover:text-primary transition-colors">
          <span>深入了解</span>
          <svg
            className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// =============================================================================
// SHOWCASE SECTION
// =============================================================================

export function StrategyShowcase() {
  const [strategies, setStrategies] = useState<FeaturedStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchFeatured() {
      try {
        const res = await fetch("/api/strategies/featured");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.strategies)) {
          setStrategies(data.strategies);
        }
      } catch {
        // Silent fail on landing page - strategies are supplementary
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeatured();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-surface/50 rounded mx-auto animate-pulse" />
            <div className="h-5 w-72 bg-surface/30 rounded mx-auto mt-3 animate-pulse" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-surface/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (strategies.length === 0) return null;

  // Show top 3 on the grid, use first 3 items
  const displayStrategies = strategies.slice(0, 3);

  return (
    <section className="py-20 relative">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/20 to-transparent pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">
            精选验证策略
          </h2>
          <p className="text-neutral-400 mt-3 max-w-lg mx-auto">
            经过历史数据回测验证的量化策略，点击了解完整回测报告
          </p>
        </div>

        {/* Strategy cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayStrategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      </div>
    </section>
  );
}
