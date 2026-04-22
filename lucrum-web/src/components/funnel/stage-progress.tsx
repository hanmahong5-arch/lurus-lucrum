'use client';

/**
 * StageProgress — 8-step compact tracker for the funnel run.
 *
 * Each stage shows: name, keep-ratio (% kept), duration, warnings.
 * Pending stages are dimmed; in-progress has a pulsing dot; done is solid.
 *
 * @module components/funnel/stage-progress
 */

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

const TOTAL_STAGES = 8;

export interface StageProgressProps {
  readonly evals: ReadonlyArray<StageEval>;
  readonly running: boolean;
}

export function StageProgress({ evals, running }: StageProgressProps) {
  const byName = new Map(evals.map((e) => [e.stageName, e]));
  const completedCount = evals.length;
  const inProgressIdx = running ? completedCount : -1;

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
          return (
            <li
              key={name}
              className={cn(
                'flex items-center justify-between text-xs px-2 py-1 rounded',
                ev && !warned && 'text-neutral-200',
                ev && warned && 'text-accent',
                isInProgress && 'bg-surface text-white',
                !ev && !isInProgress && 'text-neutral-600'
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block w-2 h-2 rounded-full',
                    ev
                      ? warned
                        ? 'bg-accent'
                        : 'bg-profit'
                      : isInProgress
                      ? 'bg-accent animate-pulse'
                      : 'bg-neutral-700'
                  )}
                />
                {label}
              </span>
              {ev && (
                <span className="flex items-center gap-3 font-mono tabular-nums">
                  <span>{ev.inputSize}→{ev.outputSize}</span>
                  <span className="text-neutral-500">
                    {(ev.keepRatio * 100).toFixed(0)}%
                  </span>
                  <span className="text-neutral-500">{ev.durationMs}ms</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
