"use client";

/**
 * Public Strategy Detail Page
 * Shows strategy performance details with gated access for full features.
 * Route: /strategy/[id]
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface EquityPoint {
  date: string;
  value: number;
}

interface RecentTrade {
  index: number;
  date: string;
  action: string;
  code: string;
  returnPct: number;
  holdDays: number;
}

interface StrategyDetail {
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
  recentTrades: RecentTrade[];
}

// =============================================================================
// GRADE STYLES
// =============================================================================

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: "bg-score-s/15", text: "text-score-s", border: "border-score-s/30" },
  A: { bg: "bg-score-a/15", text: "text-score-a", border: "border-score-a/30" },
  B: { bg: "bg-score-b/15", text: "text-score-b", border: "border-score-b/30" },
};

// =============================================================================
// FULL EQUITY CHART (SVG)
// =============================================================================

function EquityChart({ data }: { data: EquityPoint[] }) {
  const { pathD, areaD, benchmarkD, width, height } = useMemo(() => {
    const w = 800;
    const h = 240;
    const values = data.map((p) => p.value);
    if (values.length < 2) return { pathD: "", areaD: "", benchmarkD: "", width: w, height: h };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padX = 8;
    const padY = 16;
    const drawW = w - padX * 2;
    const drawH = h - padY * 2;

    const points = values.map((v, i) => {
      const x = padX + (i / (values.length - 1)) * drawW;
      const y = padY + drawH - ((v - min) / range) * drawH;
      return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };
    });

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
    const last = points[points.length - 1];
    const first = points[0];
    const area = last && first ? `${line}L${last.x},${h - 4}L${first.x},${h - 4}Z` : "";

    // Simple benchmark line (linear growth from 1.0 to ~1.2x)
    const benchStart = padY + drawH - ((1.0 - min) / range) * drawH;
    const benchEnd = padY + drawH - ((1.0 + 0.08 * (data.length / 60) - min) / range) * drawH;
    const benchmark = `M${padX},${benchStart.toFixed(1)}L${padX + drawW},${benchEnd.toFixed(1)}`;

    return { pathD: line, areaD: area, benchmarkD: benchmark, width: w, height: h };
  }, [data]);

  if (data.length < 2) return null;

  return (
    <div className="rounded-lg bg-surface/40 border border-white/[0.04] p-4">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-primary rounded-full" />
          <span className="text-xs text-neutral-400">策略净值</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-neutral-600 rounded-full" />
          <span className="text-xs text-neutral-500">沪深300</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        aria-label="Strategy equity curve vs benchmark"
      >
        <defs>
          <linearGradient id="detail-equity-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-profit))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(var(--color-profit))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Benchmark */}
        <path
          d={benchmarkD}
          fill="none"
          stroke="rgb(107 114 128 / 0.4)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* Area fill */}
        <path d={areaD} fill="url(#detail-equity-fade)" />
        {/* Strategy line */}
        <path
          d={pathD}
          fill="none"
          stroke="rgb(var(--color-profit))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// =============================================================================
// METRIC CARD
// =============================================================================

function MetricCell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className={cn("text-xl sm:text-2xl font-mono tabular-nums font-semibold", className)}>
        {value}
      </div>
      <div className="text-xs text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function StrategyDetailPage() {
  const params = useParams();
  const strategyId = typeof params.id === "string" ? params.id : "";
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStrategy() {
      try {
        const res = await fetch("/api/strategies/featured");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.strategies)) {
          const found = data.strategies.find((s: StrategyDetail) => s.id === strategyId);
          if (found) setStrategy(found);
        }
      } catch {
        // Fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStrategy();
    return () => { cancelled = true; };
  }, [strategyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-400">策略未找到</p>
        <Link href="/" className="text-sm text-primary hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  const gradeStyle = GRADE_STYLES[strategy.grade] ?? GRADE_STYLES.B;

  // Split recent trades: show first 3, blur the rest
  const visibleTrades = strategy.recentTrades.slice(0, 3);
  const blurredTrades = strategy.recentTrades.slice(3);

  return (
    <div className="min-h-screen bg-void">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-void/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </Link>
          <span className="text-xs text-neutral-600">策略详情</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Title section */}
        <div className="flex items-start gap-4 mb-8">
          <span
            className={cn(
              "inline-flex items-center justify-center w-10 h-10 rounded-xl text-base font-bold border flex-shrink-0",
              gradeStyle?.bg,
              gradeStyle?.text,
              gradeStyle?.border,
            )}
          >
            {strategy.grade}
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {strategy.name}
            </h1>
            <p className="text-neutral-400 mt-2 text-base leading-relaxed">
              {strategy.description}
            </p>
          </div>
        </div>

        {/* Indicator tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="text-xs text-neutral-500 mr-1 leading-6">使用指标:</span>
          {strategy.indicators.map((ind) => (
            <span
              key={ind}
              className="px-2.5 py-0.5 text-xs rounded-md bg-surface/80 border border-white/[0.06] text-neutral-300"
            >
              {ind}
            </span>
          ))}
        </div>

        {/* Equity chart */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-neutral-400 mb-3">
            历史净值曲线
          </h2>
          <EquityChart data={strategy.equityCurve} />
        </div>

        {/* Key metrics grid */}
        <div className="rounded-xl bg-surface/40 border border-white/[0.04] p-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <MetricCell
              label="年化收益"
              value={`+${strategy.annualReturn}%`}
              className="text-profit"
            />
            <MetricCell
              label="最大回撤"
              value={`${strategy.maxDrawdown}%`}
              className="text-neutral-300"
            />
            <MetricCell
              label="夏普比率"
              value={strategy.sharpe.toFixed(2)}
              className="text-white"
            />
            <MetricCell
              label="胜率"
              value={`${strategy.winRate}%`}
              className="text-white"
            />
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-sm">
              <span className="text-neutral-500">回测期: </span>
              <span className="text-neutral-300 font-mono tabular-nums text-xs">
                {strategy.backtestPeriod}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-neutral-500">交易次数: </span>
              <span className="text-neutral-300 font-mono tabular-nums">
                {strategy.tradeCount}次
              </span>
            </div>
            <div className="text-sm">
              <span className="text-neutral-500">平均持仓: </span>
              <span className="text-neutral-300 font-mono tabular-nums">
                {strategy.avgHoldDays}天
              </span>
            </div>
          </div>
        </div>

        {/* Recent trades */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-neutral-400 mb-3">
            近期交易记录
          </h2>
          <div className="rounded-xl bg-surface/40 border border-white/[0.04] overflow-hidden">
            {/* Visible trades */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs text-neutral-500">
                  <th className="text-left px-4 py-2.5 font-medium">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">日期</th>
                  <th className="text-left px-4 py-2.5 font-medium">操作</th>
                  <th className="text-left px-4 py-2.5 font-medium">代码</th>
                  <th className="text-right px-4 py-2.5 font-medium">收益</th>
                  <th className="text-right px-4 py-2.5 font-medium">持仓</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((trade) => (
                  <tr
                    key={trade.index}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-neutral-500 text-xs">
                      {trade.index}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-neutral-300 text-xs">
                      {trade.date}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-300">
                      {trade.action}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-neutral-300 text-xs">
                      {trade.code}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono tabular-nums text-xs",
                        trade.returnPct >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {trade.returnPct >= 0 ? "+" : ""}{trade.returnPct}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-neutral-400 text-xs">
                      {trade.holdDays}天
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Blurred / locked trades */}
            {blurredTrades.length > 0 && (
              <div className="relative">
                <div className="blur-[3px] pointer-events-none select-none opacity-40">
                  <table className="w-full text-sm">
                    <tbody>
                      {blurredTrades.map((trade) => (
                        <tr key={trade.index} className="border-b border-white/[0.02]">
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">{trade.index}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-300">{trade.date}</td>
                          <td className="px-4 py-2.5 text-neutral-300">{trade.action}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-300">{trade.code}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-300">
                            {trade.returnPct >= 0 ? "+" : ""}{trade.returnPct}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-400">
                            {trade.holdDays}天
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm text-neutral-400">
                    更多交易记录...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Registration gate */}
        <div className="rounded-xl bg-gradient-to-br from-surface/60 to-surface/40 border border-white/[0.06] p-8 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">
            想要用你的股票回测这个策略？
          </h3>
          <p className="text-sm text-neutral-400 mb-6">
            注册后可自选股票池，运行完整回测，生成详细报告
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-600 rounded-lg transition-colors btn-tactile"
            >
              免费注册并试用
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-neutral-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors"
            >
              已有账号？登录
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-neutral-700 mt-8">
          以上为历史回测数据，不构成投资建议。过往表现不代表未来收益。
        </p>
      </main>
    </div>
  );
}
