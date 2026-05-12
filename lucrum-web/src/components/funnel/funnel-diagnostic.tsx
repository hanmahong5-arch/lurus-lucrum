'use client';

/**
 * FunnelDiagnostic — explains a 0-candidate run and offers a concrete next
 * action.
 *
 * Triaging logic:
 *   1. If the universe stage emitted a warning AND output=0, the underlying
 *      data is missing (PIT snapshot not loaded). Suggest the "fallback to
 *      market-cap top-200" path rather than a strictness change — loosening
 *      filters can't conjure stocks out of an empty bucket.
 *   2. Otherwise find the stage with the biggest absolute drop (input-output).
 *      For hard-filter, inspect its `dropped_*` metric breakdown so we can
 *      name the actual rule (listing-age vs ST vs market-cap) rather than
 *      just say "stage 2 was strict".
 *   3. If everything looked healthy upstream but portfolio-construction took
 *      0 candidates, the gating happened mid-pipe and the user's preset is
 *      already as loose as it can be — point them to "Force" or to changing
 *      the universe.
 *
 * The "build my next attempt" callback receives the suggested action so the
 * parent can act on it without the diagnostic component knowing how to run
 * the funnel.
 *
 * @module components/funnel/funnel-diagnostic
 */

import { cn } from '@/lib/utils';
import { nextLooser, type StrictnessLevel } from '@/lib/funnel/strictness';
import type { StageEval } from '@/lib/funnel';

export type DiagnosticAction =
  | { readonly kind: 'relax-strictness'; readonly to: StrictnessLevel; readonly reason: string }
  | { readonly kind: 'universe-fallback'; readonly reason: string }
  | { readonly kind: 'change-universe'; readonly reason: string }
  | { readonly kind: 'manual'; readonly reason: string };

export interface FunnelDiagnosticProps {
  readonly evals: ReadonlyArray<StageEval>;
  readonly currentLevel: StrictnessLevel;
  readonly onAct: (action: DiagnosticAction) => void;
}

interface KillerInfo {
  readonly stageName: string;
  readonly inputSize: number;
  readonly dropped: number;
  readonly dominantReason: string | null;
}

/** Map hard-filter's drop-bucket metric keys to human labels. */
const HARD_FILTER_DROP_LABELS: Readonly<Record<string, string>> = {
  dropped_status: 'ST / 退市',
  dropped_listing: '上市天数不足',
  dropped_halt: '当日停牌',
  dropped_cap: '市值低于阈值',
};

function findKiller(evals: ReadonlyArray<StageEval>): KillerInfo | null {
  let worst: KillerInfo | null = null;
  for (const ev of evals) {
    const dropped = ev.inputSize - ev.outputSize;
    if (dropped <= 0) continue;
    let dominantReason: string | null = null;
    if (ev.stageName === 'hard-filter') {
      let topKey: string | null = null;
      let topVal = -1;
      for (const [k, v] of Object.entries(ev.metrics)) {
        if (typeof v === 'number' && k.startsWith('dropped_') && k !== 'dropped_total') {
          if (v > topVal) {
            topVal = v;
            topKey = k;
          }
        }
      }
      if (topKey && topVal > 0) {
        dominantReason = HARD_FILTER_DROP_LABELS[topKey] ?? topKey;
      }
    }
    if (!worst || dropped > worst.dropped) {
      worst = {
        stageName: ev.stageName,
        inputSize: ev.inputSize,
        dropped,
        dominantReason,
      };
    }
  }
  return worst;
}

function diagnose(
  evals: ReadonlyArray<StageEval>,
  currentLevel: StrictnessLevel
): { action: DiagnosticAction; killer: KillerInfo | null } {
  const universeEval = evals.find((e) => e.stageName === 'universe');

  // Case 1: universe data missing
  if (universeEval && universeEval.outputSize === 0 && universeEval.warnings.length > 0) {
    return {
      action: {
        kind: 'universe-fallback',
        reason: '板块历史快照未载入，把候选池切换到「按市值取最大 200 只」',
      },
      killer: {
        stageName: 'universe',
        inputSize: 0,
        dropped: 0,
        dominantReason: '历史数据缺失',
      },
    };
  }

  const killer = findKiller(evals);
  const next = nextLooser(currentLevel);

  // Case 2: a downstream stage zeroed out — relax strictness if we can
  if (killer && next) {
    const reasonSuffix = killer.dominantReason
      ? `（主要原因：${killer.dominantReason}）`
      : '';
    return {
      action: {
        kind: 'relax-strictness',
        to: next,
        reason: `${killer.stageName} 砍掉了 ${killer.dropped} 只${reasonSuffix} — 试试更宽松的档位`,
      },
      killer,
    };
  }

  // Case 3: already at "force" but still 0 — universe itself is the problem
  if (killer && !next) {
    return {
      action: {
        kind: 'change-universe',
        reason: '已经放到最宽，依然没货 — 换个板块或切到「按市值」候选池',
      },
      killer,
    };
  }

  // Case 4: no evals at all (or all 0 input). Generic.
  return {
    action: {
      kind: 'manual',
      reason: '没有可分析的 stage 数据 — 请检查网络或重试',
    },
    killer: null,
  };
}

export function FunnelDiagnostic({ evals, currentLevel, onAct }: FunnelDiagnosticProps) {
  const { action, killer } = diagnose(evals, currentLevel);

  const ctaLabel =
    action.kind === 'relax-strictness'
      ? `放宽到「${action.to}」重试`
      : action.kind === 'universe-fallback'
        ? '切到市值 Top 200 重试'
        : action.kind === 'change-universe'
          ? '换板块'
          : '重新尝试';

  return (
    <div
      role="region"
      aria-label="选股诊断"
      className={cn(
        'rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3',
        'text-sm'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-accent text-base leading-none">⚠</span>
        <div className="flex-1 space-y-1">
          <h4 className="font-medium text-white">没选出股 — 这里是原因</h4>
          {killer && (
            <p className="text-neutral-300 leading-relaxed">
              卡在 <span className="text-accent font-mono">{killer.stageName}</span>
              {killer.inputSize > 0 && (
                <>
                  ：<span className="font-mono tabular-nums">{killer.inputSize}</span> 只进，
                  <span className="font-mono tabular-nums">0</span> 只出
                </>
              )}
              {killer.dominantReason && (
                <>
                  ，主要原因是 <span className="text-white">{killer.dominantReason}</span>
                </>
              )}
              。
            </p>
          )}
          <p className="text-neutral-400 text-xs leading-relaxed">
            建议：{action.reason}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAct(action)}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 rounded-md',
            'text-xs font-medium transition-colors btn-tactile',
            'bg-accent text-void hover:bg-accent/90',
            'focus:outline-none focus:ring-2 focus:ring-accent/50'
          )}
        >
          {ctaLabel}
        </button>
        <span className="text-[11px] text-neutral-500">
          或者展开下方 stage 看每一步具体砍了多少
        </span>
      </div>
    </div>
  );
}
