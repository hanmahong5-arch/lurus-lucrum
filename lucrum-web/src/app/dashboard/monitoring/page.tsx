'use client';

/**
 * /dashboard/monitoring — Phase 7.0 backtest system health dashboard.
 *
 * Read-only view of per-user operational metrics derived from backtest_history:
 * daily volume, execution latency, data coverage, profitability ratio, and the
 * most-used symbols.
 *
 * @module app/dashboard/monitoring/page
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

interface DailyPoint {
  readonly date: string;
  readonly count: number;
}

interface SymbolPoint {
  readonly symbol: string;
  readonly count: number;
}

interface HealthSnapshot {
  readonly userId: string;
  readonly windowDays: number;
  readonly since: string;
  readonly totalRuns: number;
  readonly profitableRuns: number;
  readonly profitableRatio: number | null;
  readonly medianExecutionTimeMs: number | null;
  readonly avgDataCoverage: number | null;
  readonly medianSharpe: number | null;
  readonly medianMaxDrawdown: number | null;
  readonly runsByDay: ReadonlyArray<DailyPoint>;
  readonly topSymbols: ReadonlyArray<SymbolPoint>;
}

interface PackRunListItem {
  readonly runId: string;
  readonly packId: string | null;
  readonly packName: string | null;
  readonly asOfDate: string;
  readonly universeKind: string;
  readonly universeSectorCode: string | null;
  readonly status: 'success' | 'error';
  readonly errorStage: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly candidateCount: number;
  readonly createdAt: string;
}

interface PackRunAggregate {
  readonly packId: string | null;
  readonly packName: string | null;
  readonly totalRuns: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly successRate: number | null;
  readonly avgDurationMs: number | null;
  readonly avgCandidateCount: number | null;
  readonly lastRunAt: string;
}

interface PackRunStageRow {
  readonly stageIndex: number;
  readonly stageName: string;
  readonly inputSize: number;
  readonly outputSize: number;
  readonly keepRatio: number;
  readonly durationMs: number;
  readonly warnings: ReadonlyArray<string>;
}

interface StageAggregate {
  readonly stageName: string;
  readonly totalEvals: number;
  readonly avgInputSize: number | null;
  readonly avgOutputSize: number | null;
  readonly avgKeepRatio: number | null;
  readonly avgDurationMs: number | null;
  readonly warnCount: number;
  readonly warnRate: number | null;
}

interface StagesState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly items: ReadonlyArray<PackRunStageRow>;
}

interface PerformanceRow {
  readonly horizonDays: number;
  readonly topN: number;
  readonly requestedCount: number;
  readonly evaluatedCount: number;
  readonly missingCount: number;
  readonly meanReturn: number | null;
  readonly medianReturn: number | null;
  readonly hitRate: number | null;
  readonly bestReturn: number | null;
  readonly worstReturn: number | null;
  readonly benchmarkSymbol: string | null;
  readonly benchmarkReturn: number | null;
  readonly excessMeanReturn: number | null;
  readonly computedAt: string;
}

// Below this evaluated_count, hit_rate / mean are too noisy to act on. UI
// renders a neutral badge; product copy explicitly avoids implying signal.
const MIN_SAMPLE_FOR_SIGNAL = 10;

interface AlphaTrendPoint {
  readonly runId: string;
  readonly asOfDate: string;
  readonly packId: string | null;
  readonly packName: string | null;
  readonly evaluatedCount: number;
  readonly meanReturn: number | null;
  readonly benchmarkReturn: number | null;
  readonly excessMeanReturn: number | null;
  readonly computedAt: string;
}

interface AlphaTrendState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly items: ReadonlyArray<AlphaTrendPoint>;
}

const ALPHA_TREND_HORIZON = 20;
const ALPHA_TREND_TOPN = 10;
const ALPHA_TREND_LIMIT = 20;

interface PerfState {
  readonly loading: boolean;
  readonly computing: boolean;
  readonly error: string | null;
  readonly items: ReadonlyArray<PerformanceRow>;
}

const WINDOW_PRESETS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
];

function formatInteger(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatPercent(ratio: number | null, digits = 1): string {
  if (ratio === null) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

function formatNumber(n: number | null, digits = 2): string {
  if (n === null) return '—';
  return n.toFixed(digits);
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

const PACK_RUN_LIMIT = 20;

export default function MonitoringPage() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [packRuns, setPackRuns] = useState<ReadonlyArray<PackRunListItem>>([]);
  const [packRunsLoading, setPackRunsLoading] = useState(false);
  const [packRunsError, setPackRunsError] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<ReadonlyArray<PackRunAggregate>>(
    [],
  );
  const [aggregatesLoading, setAggregatesLoading] = useState(false);
  const [aggregatesError, setAggregatesError] = useState<string | null>(null);
  const [stageAggregates, setStageAggregates] = useState<
    ReadonlyArray<StageAggregate>
  >([]);
  const [stageAggregatesLoading, setStageAggregatesLoading] = useState(false);
  const [stageAggregatesError, setStageAggregatesError] = useState<
    string | null
  >(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [stagesByRun, setStagesByRun] = useState<Record<string, StagesState>>(
    {},
  );
  const [perfByRun, setPerfByRun] = useState<Record<string, PerfState>>({});
  const [alphaTrend, setAlphaTrend] = useState<AlphaTrendState>({
    loading: false,
    error: null,
    items: [],
  });

  const load = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitoring/backtest-health?windowDays=${days}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as HealthSnapshot;
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPackRuns = useCallback(async () => {
    setPackRunsLoading(true);
    setPackRunsError(null);
    try {
      const res = await fetch(`/api/monitoring/pack-runs?limit=${PACK_RUN_LIMIT}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { items: ReadonlyArray<PackRunListItem> };
      setPackRuns(data.items);
    } catch (err) {
      setPackRunsError(err instanceof Error ? err.message : String(err));
    } finally {
      setPackRunsLoading(false);
    }
  }, []);

  const loadAggregates = useCallback(async () => {
    setAggregatesLoading(true);
    setAggregatesError(null);
    try {
      const res = await fetch('/api/monitoring/pack-aggregates', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        items: ReadonlyArray<PackRunAggregate>;
      };
      setAggregates(data.items);
    } catch (err) {
      setAggregatesError(err instanceof Error ? err.message : String(err));
    } finally {
      setAggregatesLoading(false);
    }
  }, []);

  const loadAlphaTrend = useCallback(async () => {
    setAlphaTrend((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const qs = new URLSearchParams({
        horizon: String(ALPHA_TREND_HORIZON),
        topN: String(ALPHA_TREND_TOPN),
        limit: String(ALPHA_TREND_LIMIT),
      });
      const res = await fetch(`/api/monitoring/alpha-trend?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        items: ReadonlyArray<AlphaTrendPoint>;
      };
      setAlphaTrend({ loading: false, error: null, items: data.items });
    } catch (err) {
      setAlphaTrend((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const loadStageAggregates = useCallback(async () => {
    setStageAggregatesLoading(true);
    setStageAggregatesError(null);
    try {
      const res = await fetch('/api/monitoring/stage-aggregates', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        items: ReadonlyArray<StageAggregate>;
      };
      setStageAggregates(data.items);
    } catch (err) {
      setStageAggregatesError(err instanceof Error ? err.message : String(err));
    } finally {
      setStageAggregatesLoading(false);
    }
  }, []);

  useEffect(() => {
    load(windowDays);
  }, [load, windowDays]);

  useEffect(() => {
    loadPackRuns();
  }, [loadPackRuns]);

  useEffect(() => {
    loadAggregates();
  }, [loadAggregates]);

  useEffect(() => {
    loadStageAggregates();
  }, [loadStageAggregates]);

  useEffect(() => {
    loadAlphaTrend();
  }, [loadAlphaTrend]);

  const loadPerf = useCallback(async (runId: string) => {
    setPerfByRun((prev) => ({
      ...prev,
      [runId]: {
        loading: true,
        computing: false,
        error: null,
        items: prev[runId]?.items ?? [],
      },
    }));
    try {
      const res = await fetch(
        `/api/monitoring/pack-runs/${encodeURIComponent(runId)}/performance`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        items: ReadonlyArray<PerformanceRow>;
      };
      setPerfByRun((prev) => ({
        ...prev,
        [runId]: {
          loading: false,
          computing: false,
          error: null,
          items: data.items,
        },
      }));
    } catch (err) {
      setPerfByRun((prev) => ({
        ...prev,
        [runId]: {
          loading: false,
          computing: false,
          error: err instanceof Error ? err.message : String(err),
          items: prev[runId]?.items ?? [],
        },
      }));
    }
  }, []);

  const computePerf = useCallback(async (runId: string) => {
    setPerfByRun((prev) => ({
      ...prev,
      [runId]: {
        loading: false,
        computing: true,
        error: null,
        items: prev[runId]?.items ?? [],
      },
    }));
    try {
      const res = await fetch(
        `/api/monitoring/pack-runs/${encodeURIComponent(runId)}/performance`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ horizons: [1, 5, 20], topN: 10 }),
          cache: 'no-store',
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        items: ReadonlyArray<PerformanceRow>;
      };
      setPerfByRun((prev) => ({
        ...prev,
        [runId]: {
          loading: false,
          computing: false,
          error: null,
          items: data.items,
        },
      }));
    } catch (err) {
      setPerfByRun((prev) => ({
        ...prev,
        [runId]: {
          loading: false,
          computing: false,
          error: err instanceof Error ? err.message : String(err),
          items: prev[runId]?.items ?? [],
        },
      }));
    }
  }, []);

  const toggleRun = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
      if (!perfByRun[runId]) {
        void loadPerf(runId);
      }
      if (stagesByRun[runId]) return;
      setStagesByRun((prev) => ({
        ...prev,
        [runId]: { loading: true, error: null, items: [] },
      }));
      try {
        const res = await fetch(
          `/api/monitoring/pack-runs/${encodeURIComponent(runId)}/stages`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          items: ReadonlyArray<PackRunStageRow>;
        };
        setStagesByRun((prev) => ({
          ...prev,
          [runId]: { loading: false, error: null, items: data.items },
        }));
      } catch (err) {
        setStagesByRun((prev) => ({
          ...prev,
          [runId]: {
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            items: [],
          },
        }));
      }
    },
    [expandedRunId, stagesByRun, perfByRun, loadPerf],
  );

  const maxDaily = snapshot?.runsByDay.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;
  const maxSymbol = snapshot?.topSymbols.reduce((m, s) => Math.max(m, s.count), 0) ?? 0;

  return (
    <div className="min-h-screen bg-void text-white">
      <DashboardHeader />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">回测健康监控</h1>
            <p className="text-sm text-neutral-400">
              最近 {snapshot?.windowDays ?? windowDays} 天的运行指标。数据来源：个人 backtest_history。
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-surface p-1">
            {WINDOW_PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setWindowDays(p.days)}
                className={`px-3 py-1 text-xs rounded transition ${
                  windowDays === p.days
                    ? 'bg-accent text-void font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => load(windowDays)}
              disabled={loading}
              className="ml-1 px-3 py-1 text-xs rounded text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? '加载中…' : '刷新'}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
            {error}
          </div>
        )}

        {snapshot && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="总运行数" value={formatInteger(snapshot.totalRuns)} />
              <Kpi
                label="盈利占比"
                value={formatPercent(snapshot.profitableRatio)}
                tone={
                  snapshot.profitableRatio !== null && snapshot.profitableRatio >= 0.5
                    ? 'profit'
                    : 'loss'
                }
              />
              <Kpi label="中位执行时长" value={formatMs(snapshot.medianExecutionTimeMs)} />
              <Kpi
                label="平均数据覆盖率"
                value={formatPercent(snapshot.avgDataCoverage)}
              />
              <Kpi label="中位夏普" value={formatNumber(snapshot.medianSharpe)} />
              <Kpi
                label="中位最大回撤"
                value={formatPercent(snapshot.medianMaxDrawdown)}
                tone="loss"
              />
              <Kpi label="盈利次数" value={formatInteger(snapshot.profitableRuns)} />
              <Kpi
                label="开始时间"
                value={snapshot.since.slice(0, 10)}
                muted
              />
            </section>

            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-white mb-3">每日运行量</h2>
              {snapshot.runsByDay.length === 0 ? (
                <p className="text-sm text-neutral-500">窗口内暂无回测记录。</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {snapshot.runsByDay.map((d) => {
                    const height = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center gap-1 group"
                        title={`${d.date}: ${d.count}`}
                      >
                        <div className="text-[10px] font-mono tabular-nums text-white/40 group-hover:text-white/80">
                          {d.count}
                        </div>
                        <div
                          className="w-full bg-accent/60 rounded-t group-hover:bg-accent transition"
                          style={{ height: `${height}%`, minHeight: '2px' }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-white mb-3">最常回测的标的</h2>
              {snapshot.topSymbols.length === 0 ? (
                <p className="text-sm text-neutral-500">暂无数据。</p>
              ) : (
                <ul className="space-y-2">
                  {snapshot.topSymbols.map((s) => {
                    const width = maxSymbol > 0 ? (s.count / maxSymbol) * 100 : 0;
                    return (
                      <li key={s.symbol} className="flex items-center gap-3 text-sm">
                        <span className="font-mono w-20 shrink-0 text-white/70">
                          {s.symbol}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-accent/60 rounded-full"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums w-10 text-right text-white/80">
                          {s.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {!snapshot && !loading && !error && (
          <div className="rounded-md border border-border bg-surface px-4 py-8 text-center text-sm text-neutral-400">
            无数据。
          </div>
        )}

        <AlphaTrendPanel state={alphaTrend} onRefresh={loadAlphaTrend} />

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">按 Pack 聚合</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                每个 Pack 的累计成功率 / 平均耗时 / 平均候选数。
              </p>
            </div>
            <button
              type="button"
              onClick={loadAggregates}
              disabled={aggregatesLoading}
              className="text-xs rounded px-3 py-1 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              {aggregatesLoading ? '加载中…' : '刷新'}
            </button>
          </div>

          {aggregatesError && (
            <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss mb-3">
              {aggregatesError}
            </div>
          )}

          {aggregates.length === 0 && !aggregatesLoading && !aggregatesError ? (
            <p className="text-sm text-neutral-500">暂无聚合数据。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-neutral-500">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-normal">Pack</th>
                    <th className="py-2 pr-3 font-normal text-right">运行数</th>
                    <th className="py-2 pr-3 font-normal text-right">成功率</th>
                    <th className="py-2 pr-3 font-normal text-right">失败</th>
                    <th className="py-2 pr-3 font-normal text-right">平均耗时</th>
                    <th className="py-2 pr-3 font-normal text-right">平均候选</th>
                    <th className="py-2 font-normal">最后运行</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.map((a) => {
                    const key = a.packId ?? '__freeform__';
                    const rate = a.successRate;
                    const rateTone =
                      rate === null
                        ? 'text-white/40'
                        : rate >= 0.9
                          ? 'text-profit'
                          : rate >= 0.7
                            ? 'text-white/80'
                            : 'text-loss';
                    return (
                      <tr
                        key={key}
                        className="border-b border-border/40 hover:bg-white/[0.02]"
                      >
                        <td className="py-2 pr-3 text-white/80">
                          {a.packName ?? a.packId ?? (
                            <span className="text-white/40">(无 Pack)</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/80">
                          {a.totalRuns}
                        </td>
                        <td
                          className={`py-2 pr-3 font-mono tabular-nums text-right ${rateTone}`}
                        >
                          {rate === null ? '—' : `${(rate * 100).toFixed(1)}%`}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/60">
                          {a.errorCount > 0 ? (
                            <span className="text-loss">{a.errorCount}</span>
                          ) : (
                            <span className="text-white/40">0</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/70">
                          {formatMs(a.avgDurationMs)}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/70">
                          {a.avgCandidateCount === null
                            ? '—'
                            : a.avgCandidateCount.toFixed(1)}
                        </td>
                        <td className="py-2 font-mono tabular-nums text-white/60">
                          {formatRelativeTime(a.lastRunAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">按阶段聚合</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                按 stage_name 汇总所有运行 —— 看哪个阶段最耗时、最容易报警。
              </p>
            </div>
            <button
              type="button"
              onClick={loadStageAggregates}
              disabled={stageAggregatesLoading}
              className="text-xs rounded px-3 py-1 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              {stageAggregatesLoading ? '加载中…' : '刷新'}
            </button>
          </div>

          {stageAggregatesError && (
            <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss mb-3">
              {stageAggregatesError}
            </div>
          )}

          {stageAggregates.length === 0 &&
          !stageAggregatesLoading &&
          !stageAggregatesError ? (
            <p className="text-sm text-neutral-500">暂无阶段数据。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-neutral-500">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-normal">阶段</th>
                    <th className="py-2 pr-3 font-normal text-right">评估次数</th>
                    <th className="py-2 pr-3 font-normal text-right">平均输入</th>
                    <th className="py-2 pr-3 font-normal text-right">平均输出</th>
                    <th className="py-2 pr-3 font-normal text-right">平均保留率</th>
                    <th className="py-2 pr-3 font-normal text-right">平均耗时</th>
                    <th className="py-2 font-normal text-right">警告率</th>
                  </tr>
                </thead>
                <tbody>
                  {stageAggregates.map((s) => {
                    const keepPct =
                      s.avgKeepRatio === null ? null : s.avgKeepRatio * 100;
                    const keepTone =
                      keepPct === null
                        ? 'text-white/40'
                        : keepPct >= 50
                          ? 'text-profit/80'
                          : keepPct >= 10
                            ? 'text-white/70'
                            : 'text-loss/80';
                    const warnPct =
                      s.warnRate === null ? null : s.warnRate * 100;
                    const warnTone =
                      warnPct === null
                        ? 'text-white/40'
                        : warnPct === 0
                          ? 'text-white/40'
                          : warnPct < 5
                            ? 'text-amber-400/70'
                            : 'text-loss';
                    return (
                      <tr
                        key={s.stageName}
                        className="border-b border-border/40 hover:bg-white/[0.02]"
                      >
                        <td className="py-2 pr-3 text-white/80">
                          {s.stageName}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/80">
                          {s.totalEvals}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/60">
                          {s.avgInputSize === null
                            ? '—'
                            : s.avgInputSize.toFixed(1)}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/60">
                          {s.avgOutputSize === null
                            ? '—'
                            : s.avgOutputSize.toFixed(1)}
                        </td>
                        <td
                          className={`py-2 pr-3 font-mono tabular-nums text-right ${keepTone}`}
                        >
                          {keepPct === null ? '—' : `${keepPct.toFixed(1)}%`}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/70">
                          {formatMs(s.avgDurationMs)}
                        </td>
                        <td
                          className={`py-2 font-mono tabular-nums text-right ${warnTone}`}
                          title={`${s.warnCount} / ${s.totalEvals}`}
                        >
                          {warnPct === null ? '—' : `${warnPct.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">最近漏斗运行</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Pack / Funnel pipeline 执行记录（最近 {PACK_RUN_LIMIT} 条）。
              </p>
            </div>
            <button
              type="button"
              onClick={loadPackRuns}
              disabled={packRunsLoading}
              className="text-xs rounded px-3 py-1 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              {packRunsLoading ? '加载中…' : '刷新'}
            </button>
          </div>

          {packRunsError && (
            <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss mb-3">
              {packRunsError}
            </div>
          )}

          {packRuns.length === 0 && !packRunsLoading && !packRunsError ? (
            <p className="text-sm text-neutral-500">暂无漏斗运行记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-neutral-500">
                  <tr className="border-b border-border">
                    <th className="py-2 pl-1 pr-2 font-normal w-6" aria-label="展开" />
                    <th className="py-2 pr-3 font-normal">时间</th>
                    <th className="py-2 pr-3 font-normal">Pack</th>
                    <th className="py-2 pr-3 font-normal">Universe</th>
                    <th className="py-2 pr-3 font-normal">As Of</th>
                    <th className="py-2 pr-3 font-normal text-right">候选数</th>
                    <th className="py-2 pr-3 font-normal text-right">耗时</th>
                    <th className="py-2 font-normal">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {packRuns.map((r) => {
                    const isExpanded = expandedRunId === r.runId;
                    const stages = stagesByRun[r.runId];
                    return (
                      <Fragment key={r.runId}>
                        <tr
                          onClick={() => toggleRun(r.runId)}
                          className="border-b border-border/40 hover:bg-white/[0.02] cursor-pointer"
                        >
                          <td className="py-2 pl-1 pr-2 text-white/40 select-none">
                            {isExpanded ? '▾' : '▸'}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-white/70">
                            {formatRelativeTime(r.createdAt)}
                          </td>
                          <td className="py-2 pr-3 text-white/80">
                            {r.packName ?? r.packId ?? (
                              <span className="text-white/40">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-white/70">
                            <span className="font-mono">{r.universeKind}</span>
                            {r.universeSectorCode && (
                              <span className="ml-1 text-white/40">
                                · {r.universeSectorCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-white/60">
                            {r.asOfDate}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/80">
                            {r.candidateCount}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-right text-white/60">
                            {formatMs(r.durationMs)}
                          </td>
                          <td className="py-2">
                            {r.status === 'success' ? (
                              <span className="text-profit">成功</span>
                            ) : (
                              <span
                                className="text-loss"
                                title={r.errorMessage ?? undefined}
                              >
                                失败{r.errorStage ? ` · ${r.errorStage}` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/40 bg-void/40">
                            <td colSpan={8} className="px-3 py-3 space-y-4">
                              <StageDetail state={stages} />
                              <PerformanceDetail
                                runId={r.runId}
                                state={perfByRun[r.runId]}
                                onCompute={() => computePerf(r.runId)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s 前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m 前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h 前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d 前`;
  return iso.slice(0, 10);
}

function StageDetail({ state }: { state: StagesState | undefined }) {
  if (!state || state.loading) {
    return <div className="text-xs text-white/50">加载阶段明细…</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
        {state.error}
      </div>
    );
  }
  if (state.items.length === 0) {
    return <div className="text-xs text-white/40">无阶段数据。</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="text-left text-white/40">
          <tr className="border-b border-border/60">
            <th className="py-1.5 pr-3 font-normal w-8">#</th>
            <th className="py-1.5 pr-3 font-normal">阶段</th>
            <th className="py-1.5 pr-3 font-normal text-right">输入</th>
            <th className="py-1.5 pr-3 font-normal text-right">输出</th>
            <th className="py-1.5 pr-3 font-normal text-right">保留率</th>
            <th className="py-1.5 pr-3 font-normal text-right">耗时</th>
            <th className="py-1.5 font-normal">警告</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((s) => {
            const ratioPct = s.keepRatio * 100;
            const ratioTone =
              ratioPct >= 50
                ? 'text-profit/80'
                : ratioPct >= 10
                  ? 'text-white/70'
                  : 'text-loss/80';
            return (
              <tr key={s.stageIndex} className="border-b border-border/30 last:border-0">
                <td className="py-1.5 pr-3 font-mono tabular-nums text-white/50">
                  {s.stageIndex}
                </td>
                <td className="py-1.5 pr-3 text-white/80">{s.stageName}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right text-white/60">
                  {s.inputSize}
                </td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right text-white/80">
                  {s.outputSize}
                </td>
                <td
                  className={`py-1.5 pr-3 font-mono tabular-nums text-right ${ratioTone}`}
                >
                  {ratioPct.toFixed(1)}%
                </td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right text-white/60">
                  {formatMs(s.durationMs)}
                </td>
                <td className="py-1.5 text-white/70">
                  {s.warnings.length === 0 ? (
                    <span className="text-white/30">—</span>
                  ) : (
                    <span
                      className="text-amber-400 cursor-help"
                      title={s.warnings.join('\n')}
                    >
                      {s.warnings.length} 条
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatReturnPct(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return '—';
  const pct = r * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function returnTone(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return 'text-white/40';
  if (r > 0) return 'text-profit';
  if (r < 0) return 'text-loss';
  return 'text-white/60';
}

function AlphaTrendPanel({
  state,
  onRefresh,
}: {
  state: AlphaTrendState;
  onRefresh: () => void;
}) {
  const { loading, error, items } = state;
  const points = items.filter((p) => p.excessMeanReturn !== null);
  const hasSignal = points.length >= 3;

  // Build sparkline path. Range fixed to [-15%, +15%] excess so visual
  // magnitude is comparable across refreshes; clamp outliers but mark them.
  const W = 320;
  const H = 64;
  const PAD_X = 2;
  const PAD_Y = 4;
  const RANGE = 0.15;
  const xStep =
    points.length > 1 ? (W - 2 * PAD_X) / (points.length - 1) : 0;
  const yFor = (v: number) => {
    const clamped = Math.max(-RANGE, Math.min(RANGE, v));
    const norm = (clamped + RANGE) / (2 * RANGE); // 0..1
    return H - PAD_Y - norm * (H - 2 * PAD_Y);
  };
  const path = points
    .map((p, i) => {
      const x = PAD_X + i * xStep;
      const y = yFor(p.excessMeanReturn ?? 0);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  const lastValue = last?.excessMeanReturn ?? null;

  // Mean of all observed alpha — quick "are we positive on average?" read.
  const avg =
    points.length > 0
      ? points.reduce((s, p) => s + (p.excessMeanReturn ?? 0), 0) /
        points.length
      : null;
  const positiveCount = points.filter(
    (p) => (p.excessMeanReturn ?? 0) > 0,
  ).length;
  const positiveRate =
    points.length > 0 ? positiveCount / points.length : null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Alpha 趋势</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            最近 {ALPHA_TREND_LIMIT} 次 funnel 运行的 {ALPHA_TREND_HORIZON} 日超额收益（vs CSI300，等权 top{ALPHA_TREND_TOPN}）。
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs rounded px-3 py-1 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss mb-3">
          {error}
        </div>
      )}

      {!hasSignal ? (
        <p className="text-xs text-neutral-500">
          暂无足够数据点（已就绪 {points.length} 个，至少需要 3 个 horizon=
          {ALPHA_TREND_HORIZON}d 已结算的运行）。
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-[10px] text-neutral-500">最近 α</div>
              <div
                className={`font-mono tabular-nums text-lg font-semibold ${returnTone(lastValue)}`}
              >
                {formatReturnPct(lastValue)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500">均值 α</div>
              <div
                className={`font-mono tabular-nums text-sm ${returnTone(avg)}`}
              >
                {formatReturnPct(avg)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500">正 α 比例</div>
              <div className="font-mono tabular-nums text-sm text-white/80">
                {positiveRate === null
                  ? '—'
                  : `${(positiveRate * 100).toFixed(0)}% (${positiveCount}/${points.length})`}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="text-accent"
              role="img"
              aria-label="Alpha sparkline"
            >
              {/* zero baseline */}
              <line
                x1={PAD_X}
                y1={yFor(0)}
                x2={W - PAD_X}
                y2={yFor(0)}
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeDasharray="2,2"
              />
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {points.map((p, i) => {
                const x = PAD_X + i * xStep;
                const v = p.excessMeanReturn ?? 0;
                const y = yFor(v);
                const fill =
                  v > 0
                    ? 'var(--profit)'
                    : v < 0
                      ? 'var(--loss)'
                      : 'currentColor';
                return (
                  <circle
                    key={p.runId}
                    cx={x}
                    cy={y}
                    r={2}
                    fill={fill}
                  >
                    <title>
                      {p.asOfDate} · α {formatReturnPct(p.excessMeanReturn)}
                      {p.benchmarkReturn !== null
                        ? ` · 基准 ${formatReturnPct(p.benchmarkReturn)}`
                        : ''}
                      {p.evaluatedCount < MIN_SAMPLE_FOR_SIGNAL
                        ? ` · 样本不足 (n=${p.evaluatedCount})`
                        : ''}
                    </title>
                  </circle>
                );
              })}
            </svg>
          </div>

          <p className="text-[10px] text-neutral-500">
            灰色虚线 = 0；点高度 = α；±15% 之外被压在边界。
          </p>
        </div>
      )}
    </section>
  );
}

function PerformanceDetail({
  runId,
  state,
  onCompute,
}: {
  runId: string;
  state: PerfState | undefined;
  onCompute: () => void;
}) {
  void runId;
  const items = state?.items ?? [];
  const hasData = items.length > 0;
  const computing = state?.computing ?? false;
  const loading = state?.loading ?? false;
  const error = state?.error ?? null;
  const latestComputedAt = hasData
    ? items.reduce((acc, r) =>
        Date.parse(r.computedAt) > Date.parse(acc.computedAt) ? r : acc,
      ).computedAt
    : null;

  return (
    <div className="rounded border border-border/60 bg-void/60 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-xs font-semibold text-white">前向表现</h3>
          <p className="text-[10px] text-white/40 mt-0.5">
            等权 top10 · 以 as_of 当日为锚 · 复权后收益 · α 相对 CSI300
          </p>
        </div>
        <div className="flex items-center gap-2">
          {latestComputedAt && (
            <span className="text-[10px] text-white/40 font-mono">
              {formatRelativeTime(latestComputedAt)} 计算
            </span>
          )}
          <button
            type="button"
            onClick={onCompute}
            disabled={computing || loading}
            className="text-[11px] rounded px-2 py-1 bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"
          >
            {computing ? '计算中…' : hasData ? '重新计算' : '计算前向表现'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss mb-2">
          {error}
        </div>
      )}

      {!hasData && !loading && !computing && !error && (
        <p className="text-[11px] text-white/40">
          尚未计算。点击右侧按钮触发 1/5/20 日前向收益估算。
        </p>
      )}

      {loading && !hasData && (
        <p className="text-[11px] text-white/40">加载缓存…</p>
      )}

      {hasData && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-left text-white/40">
              <tr className="border-b border-border/60">
                <th className="py-1.5 pr-3 font-normal">Horizon</th>
                <th className="py-1.5 pr-3 font-normal text-right">评估/请求</th>
                <th className="py-1.5 pr-3 font-normal text-right">平均</th>
                <th className="py-1.5 pr-3 font-normal text-right">基准</th>
                <th className="py-1.5 pr-3 font-normal text-right">α (超额)</th>
                <th className="py-1.5 pr-3 font-normal text-right">中位数</th>
                <th className="py-1.5 pr-3 font-normal text-right">胜率</th>
                <th className="py-1.5 pr-3 font-normal text-right">最佳</th>
                <th className="py-1.5 font-normal text-right">最差</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const lowSample =
                  r.evaluatedCount > 0 &&
                  r.evaluatedCount < MIN_SAMPLE_FOR_SIGNAL;
                return (
                  <tr
                    key={`${r.horizonDays}-${r.topN}`}
                    className={`border-b border-border/30 last:border-0 ${lowSample ? 'opacity-60' : ''}`}
                  >
                    <td className="py-1.5 pr-3 text-white/80 font-mono">
                      {r.horizonDays}d · top{r.topN}
                    </td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-right text-white/60">
                      {r.evaluatedCount}/{r.requestedCount}
                      {r.missingCount > 0 && (
                        <span
                          className="ml-1 text-amber-400/70"
                          title={`${r.missingCount} 个标的无前向数据`}
                        >
                          (-{r.missingCount})
                        </span>
                      )}
                      {lowSample && (
                        <span
                          className="ml-1 inline-block rounded bg-white/5 px-1 text-white/50 font-sans text-[9px]"
                          title="样本不足，统计意义弱，不建议据此决策"
                        >
                          n&lt;{MIN_SAMPLE_FOR_SIGNAL}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${returnTone(r.meanReturn)}`}
                    >
                      {formatReturnPct(r.meanReturn)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${returnTone(r.benchmarkReturn)}`}
                      title={
                        r.benchmarkSymbol
                          ? `基准 ${r.benchmarkSymbol} 同 horizon 收益`
                          : '基准未就绪'
                      }
                    >
                      {formatReturnPct(r.benchmarkReturn)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${returnTone(r.excessMeanReturn)}`}
                      title="超额收益 = 平均 - 基准；为负代表跑输大盘"
                    >
                      {formatReturnPct(r.excessMeanReturn)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${returnTone(r.medianReturn)}`}
                    >
                      {formatReturnPct(r.medianReturn)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${
                        r.hitRate === null
                          ? 'text-white/40'
                          : r.hitRate >= 0.5
                            ? 'text-profit/80'
                            : 'text-loss/80'
                      }`}
                    >
                      {r.hitRate === null
                        ? '—'
                        : `${(r.hitRate * 100).toFixed(0)}%`}
                    </td>
                    <td
                      className={`py-1.5 pr-3 font-mono tabular-nums text-right ${returnTone(r.bestReturn)}`}
                    >
                      {formatReturnPct(r.bestReturn)}
                    </td>
                    <td
                      className={`py-1.5 font-mono tabular-nums text-right ${returnTone(r.worstReturn)}`}
                    >
                      {formatReturnPct(r.worstReturn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
  muted?: boolean;
}) {
  const valueClass = tone === 'profit'
    ? 'text-profit'
    : tone === 'loss'
      ? 'text-loss'
      : muted
        ? 'text-white/60'
        : 'text-white';
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
