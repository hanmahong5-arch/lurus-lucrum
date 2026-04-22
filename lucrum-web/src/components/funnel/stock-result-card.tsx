'use client';

/**
 * StockResultCard — final candidate tile.
 *
 * Shows the stock symbol + name, composite score, per-factor
 * contribution bars, and tags (e.g. "leader"). Designed for vertical
 * stacking in the Top-N list; compact on mobile.
 *
 * @module components/funnel/stock-result-card
 */

import { cn } from '@/lib/utils';
import type { FunnelCandidateView } from '@/hooks/use-funnel-stream';

export interface StockResultCardProps {
  readonly rank: number;
  readonly candidate: FunnelCandidateView;
}

function scoreColor(score: number | undefined): string {
  if (score === undefined) return 'text-neutral-500';
  if (score >= 0.9) return 'text-score-s';
  if (score >= 0.75) return 'text-score-a';
  if (score >= 0.5) return 'text-score-b';
  if (score >= 0.25) return 'text-score-c';
  return 'text-score-d';
}

function formatScore(score: number | undefined): string {
  if (score === undefined) return '--';
  return (score * 100).toFixed(1);
}

export function StockResultCard({ rank, candidate }: StockResultCardProps) {
  const topBreakdown = Object.entries(candidate.scoreBreakdown ?? {})
    .filter(([k]) => !k.startsWith('leader_prior'))
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3);

  const isLeader = candidate.tags?.includes('leader');
  const weightNote = candidate.notes?.weight;

  return (
    <div
      className={cn(
        'flex items-stretch gap-3 rounded-lg border border-border bg-surface p-3',
        'transition-colors hover:border-accent/50'
      )}
    >
      <div className="flex flex-col items-center justify-center w-10 shrink-0">
        <span className="text-xs text-neutral-500">#</span>
        <span className="text-lg font-mono tabular-nums text-white">
          {rank}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-white text-base">
            {candidate.symbol}
          </span>
          {candidate.name && (
            <span className="text-sm text-neutral-300 truncate">
              {candidate.name}
            </span>
          )}
          {isLeader && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 shrink-0">
              龙头
            </span>
          )}
        </div>

        {topBreakdown.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
            {topBreakdown.map(([factor, value]) => (
              <span key={factor} className="font-mono tabular-nums">
                {factor} {value >= 0 ? '+' : ''}
                {value.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end justify-center shrink-0 min-w-[4rem]">
        <span className="text-xs text-neutral-500">综合分</span>
        <span
          className={cn(
            'text-lg font-mono tabular-nums font-semibold',
            scoreColor(candidate.score)
          )}
        >
          {formatScore(candidate.score)}
        </span>
        {weightNote && (
          <span className="text-xs font-mono tabular-nums text-neutral-500">
            w {weightNote}
          </span>
        )}
      </div>
    </div>
  );
}
