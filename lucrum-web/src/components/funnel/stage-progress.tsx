'use client';

/**
 * StageProgress — 8-step compact tracker for the funnel run.
 *
 * Each row shows: name, input→output count, keep-ratio %, duration, warnings.
 * Pending stages are dimmed; in-progress has a pulsing dot; done is solid.
 *
 * Click a completed row to expand and reveal the raw `stageEval.metrics`
 * dictionary — that's where stages stash drop-bucket counts ("dropped_status:
 * 12, dropped_listing: 5") and other per-rule statistics that explain why
 * the keep-ratio is what it is. Without this, users see "5/40" and have no
 * way to know which rule did the cutting.
 *
 * Metric keys are translated to Chinese labels via {@link METRIC_LABELS};
 * unknown keys fall back to the raw key so we never silently hide signal.
 *
 * @module components/funnel/stage-progress
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { StageEval } from '@/lib/funnel';

const STAGE_LABELS: Readonly<Record<string, string>> = {
  universe: '1. 定宇宙',
  'hard-filter': '2. 硬过滤',
  'fundamental-health': '3. 基本面',
  signal: '4. 信号',
  'factor-score': '5. 多因子',
  'leader-detection': '6. 龙头',
  'portfolio-construction': '7. 组合',
  'backtest-validation': '8. 验证',
};

/**
 * Human-readable labels for the per-stage `metrics` keys stages emit. New
 * keys can be added without touching the renderer — unknown keys render
 * with the raw key name so we don't accidentally hide useful data.
 */
const METRIC_LABELS: Readonly<Record<string, string>> = {
  // hard-filter
  dropped_status: '被 ST/退市过滤',
  dropped_listing: '上市天数不足',
  dropped_halt: '当日停牌',
  dropped_cap: '市值不达标',
  dropped_total: '总共砍掉',
  // universe
  spec_kind: '候选池类型',
  requested_size: '原始拉取',
  emitted_size: '实际产出',
  // factor-score
  factors_used: '使用因子数',
  factors_skipped: '跳过因子数',
  kline_window: 'K 线窗口（日）',
  // portfolio-construction
  input_size: '候选输入',
  selected: '入选',
  top_score: '最高分',
  bottom_score: '最低分',
};

const TOTAL_STAGES = 8;

function formatMetricValue(v: number | string): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(3);
  }
  return v;
}

export interface StageProgressProps {
  readonly evals: ReadonlyArray<StageEval>;
  readonly running: boolean;
}

export function StageProgress({ evals, running }: StageProgressProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const byName = new Map(evals.map((e) => [e.stageName, e]));
  const completedCount = evals.length;
  const inProgressIdx = running ? completedCount : -1;

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-neutral-400">进度</span>
        <span className="font-mono tabular-nums text-white">
          {completedCount}/{TOTAL_STAGES}
        </span>
        <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${(completedCount / TOTAL_STAGES) * 100}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        {Object.entries(STAGE_LABELS).map(([name, label], i) => {
          const ev = byName.get(name);
          const isInProgress = i === inProgressIdx;
          const warned = ev && ev.warnings.length > 0;
          const isExpanded = expanded.has(name);
          const hasDetail = !!ev && (Object.keys(ev.metrics).length > 0 || warned);
          return (
            <li
              key={name}
              className={cn(
                'text-xs rounded transition-colors',
                ev && !warned && 'text-neutral-200',
                ev && warned && 'text-accent',
                isInProgress && 'bg-surface text-white',
                !ev && !isInProgress && 'text-neutral-600'
              )}
            >
              <button
                type="button"
                onClick={() => hasDetail && toggleExpand(name)}
                disabled={!hasDetail}
                aria-expanded={isExpanded}
                className={cn(
                  'w-full text-left px-2 py-1 rounded',
                  hasDetail && 'cursor-pointer hover:bg-white/5',
                  !hasDetail && 'cursor-default'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'inline-block w-2 h-2 rounded-full flex-shrink-0',
                        ev
                          ? warned
                            ? 'bg-accent'
                            : 'bg-profit'
                          : isInProgress
                            ? 'bg-accent animate-pulse'
                            : 'bg-neutral-700'
                      )}
                    />
                    <span className="truncate">{label}</span>
                    {hasDetail && (
                      <span
                        className={cn(
                          'text-[10px] text-neutral-500 transition-transform flex-shrink-0',
                          isExpanded && 'rotate-90'
                        )}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    )}
                  </span>
                  {ev && (
                    <span className="flex items-center gap-3 font-mono tabular-nums flex-shrink-0">
                      <span>
                        {ev.inputSize}→{ev.outputSize}
                      </span>
                      <span className="text-neutral-500">
                        {(ev.keepRatio * 100).toFixed(0)}%
                      </span>
                      <span className="text-neutral-500">{ev.durationMs}ms</span>
                    </span>
                  )}
                </div>
              </button>

              {/* Inline warnings — visible even when collapsed (these are the
                  thing the user most needs to see). */}
              {warned && !isExpanded && (
                <ul className="ml-6 pb-1 space-y-0.5 text-[11px] text-accent/80">
                  {ev!.warnings.map((w, j) => (
                    <li key={j} className="leading-snug">
                      ⚠ {w}
                    </li>
                  ))}
                </ul>
              )}

              {/* Expanded detail panel: metrics table + warnings */}
              {isExpanded && ev && (
                <div className="ml-6 mr-2 mb-2 p-2 bg-void/40 border border-border rounded space-y-2">
                  {Object.keys(ev.metrics).length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
                        细节指标
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                        {Object.entries(ev.metrics).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <dt className="text-neutral-400 truncate" title={k}>
                              {METRIC_LABELS[k] ?? k}
                            </dt>
                            <dd className="font-mono tabular-nums text-neutral-200 flex-shrink-0">
                              {formatMetricValue(v)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {warned && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-accent/70 mb-1">
                        警告
                      </div>
                      <ul className="space-y-0.5 text-[11px] text-accent/80">
                        {ev.warnings.map((w, j) => (
                          <li key={j} className="leading-snug">
                            ⚠ {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
