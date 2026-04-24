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

  const toggleRun = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
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
    [expandedRunId, stagesByRun],
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
                            <td colSpan={8} className="px-3 py-3">
                              <StageDetail state={stages} />
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
