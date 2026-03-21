'use client';

/**
 * LeaderboardCard
 *
 * Mobile-friendly card for a single leaderboard entry.
 * Shows rank (gold/silver/bronze for top 3), anonymous username,
 * strategy name, key metrics, and a Fork button.
 */

import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/lib/stores/leaderboard-store';
import { Copy } from 'lucide-react';

// =============================================================================
// Rank badge styling
// =============================================================================

const RANK_STYLES: Record<number, string> = {
  1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  2: 'bg-gray-300/20 text-gray-300 border-gray-400/40',
  3: 'bg-amber-700/20 text-amber-600 border-amber-700/40',
};

const DEFAULT_RANK_STYLE = 'bg-white/5 text-white/50 border-white/10';

function getRankStyle(rank: number): string {
  return RANK_STYLES[rank] ?? DEFAULT_RANK_STYLE;
}

// =============================================================================
// Component
// =============================================================================

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  onFork: (entry: LeaderboardEntry) => void;
}

export function LeaderboardCard({ entry, onFork }: LeaderboardCardProps) {
  const canFork = entry.strategyParams !== null;

  return (
    <div
      className={cn(
        'glass-panel rounded-xl p-4 border transition-colors',
        entry.rank <= 3 ? 'border-yellow-500/20' : 'border-white/5',
      )}
    >
      {/* Top row: rank + username + strategy name */}
      <div className="flex items-center gap-3 mb-3">
        {/* Rank badge */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold font-mono tabular-nums shrink-0',
            getRankStyle(entry.rank),
          )}
        >
          {entry.rank}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/70 truncate">{entry.username}</p>
          <p className="text-sm font-medium text-white truncate">{entry.strategyName}</p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-xs text-white/40 mb-0.5">Sharpe</p>
          <p className="text-sm font-mono tabular-nums text-accent font-medium">
            {entry.sharpe.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-0.5">{'\u6536\u76CA\u7387'}</p>
          <p
            className={cn(
              'text-sm font-mono tabular-nums font-medium',
              entry.totalReturn >= 0 ? 'text-profit' : 'text-loss',
            )}
          >
            {entry.totalReturn >= 0 ? '+' : ''}
            {(entry.totalReturn * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-0.5">{'\u56DE\u6D4B\u6570'}</p>
          <p className="text-sm font-mono tabular-nums text-white/80">
            {entry.backtestCount}
          </p>
        </div>
      </div>

      {/* Fork button */}
      <button
        type="button"
        disabled={!canFork}
        onClick={() => onFork(entry)}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition btn-tactile',
          canFork
            ? 'bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30'
            : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed',
        )}
      >
        <Copy className="w-3.5 h-3.5" />
        {canFork ? 'Fork \u7B56\u7565' : '\u4F5C\u8005\u672A\u5F00\u653E'}
      </button>
    </div>
  );
}
