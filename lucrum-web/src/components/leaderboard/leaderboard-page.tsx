'use client';

/**
 * LeaderboardPage
 *
 * Strategy leaderboard — core social validation feature.
 * Displays ranked strategies by 3 dimensions:
 *   - Weekly highest Sharpe
 *   - Monthly highest return
 *   - Most backtests run
 *
 * Fork button copies strategy parameters into workspace store
 * and navigates to the strategy editor.
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { LeaderboardCard } from './leaderboard-card';
import {
  useLeaderboardStore,
  selectLeaderboardEntries,
  selectLeaderboardLoading,
  selectLeaderboardFilter,
  type LeaderboardFilter,
  type LeaderboardEntry,
} from '@/lib/stores/leaderboard-store';
import { useStrategyWorkspaceStore } from '@/lib/stores/strategy-workspace-store';
import { showToast } from '@/lib/toast';
import { Trophy, Copy } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

// =============================================================================
// Filter tabs
// =============================================================================

interface FilterTab {
  key: LeaderboardFilter;
  label: string;
  description: string;
}

const FILTER_TABS: FilterTab[] = [
  {
    key: 'weekly_sharpe',
    label: '\u672C\u5468\u6700\u9AD8 Sharpe',
    description: '\u98CE\u9669\u8C03\u6574\u540E\u6536\u76CA\u6392\u540D',
  },
  {
    key: 'monthly_return',
    label: '\u672C\u6708\u6700\u9AD8\u6536\u76CA',
    description: '\u7EDD\u5BF9\u6536\u76CA\u7387\u6392\u540D',
  },
  {
    key: 'most_backtests',
    label: '\u6700\u591A\u56DE\u6D4B',
    description: '\u56DE\u6D4B\u6B21\u6570\u6392\u540D',
  },
];

// =============================================================================
// Rank display helpers
// =============================================================================

const RANK_STYLES: Record<number, string> = {
  1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  2: 'bg-gray-300/20 text-gray-300 border-gray-400/40',
  3: 'bg-amber-700/20 text-amber-600 border-amber-700/40',
};

const DEFAULT_RANK_STYLE = 'bg-white/5 text-white/50 border-white/10';

function getRankBadge(rank: number) {
  const style = RANK_STYLES[rank] ?? DEFAULT_RANK_STYLE;
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold font-mono tabular-nums',
        style,
      )}
    >
      {rank}
    </div>
  );
}

// =============================================================================
// Fork strategy code template generator
// =============================================================================

function generateForkCode(entry: LeaderboardEntry): string {
  if (!entry.strategyParams) return '';

  const params = entry.strategyParams;
  const paramLines = Object.entries(params)
    .map(([key, value]) => `    ${key} = ${value}`)
    .join('\n');

  return `"""
Forked Strategy: ${entry.strategyName}
Source: Leaderboard #${entry.rank} (Sharpe ${entry.sharpe.toFixed(2)}, Return ${(entry.totalReturn * 100).toFixed(1)}%)

Forked by Lucrum
"""

from vnpy.trader.object import BarData
from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.constant import Interval

class ForkedStrategy(CtaTemplate):
    """Forked from leaderboard: ${entry.strategyName}"""

    author = "Lucrum Fork"

    # Parameters (from original strategy)
${paramLines}

    # Variables
    inited = False
    trading = False
    fast_ma = 0.0
    slow_ma = 0.0

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_bar(self, bar: BarData):
        """Process new bar data"""
        if not self.inited:
            return

        am = self.cta_engine.get_am(self.vt_symbol)
        self.fast_ma = am.sma(self.fast_window if hasattr(self, 'fast_window') else 5)
        self.slow_ma = am.sma(self.slow_window if hasattr(self, 'slow_window') else 20)

        if self.fast_ma > self.slow_ma and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size if hasattr(self, 'fixed_size') else 1)
        elif self.fast_ma < self.slow_ma and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))

        self.put_event()
`;
}

// =============================================================================
// Main Component
// =============================================================================

export function LeaderboardPage() {
  const router = useRouter();
  const entries = useLeaderboardStore(selectLeaderboardEntries);
  const loading = useLeaderboardStore(selectLeaderboardLoading);
  const filter = useLeaderboardStore(selectLeaderboardFilter);
  const { fetchLeaderboard, setFilter } = useLeaderboardStore();

  const {
    updateGeneratedCode,
    updateStrategyInput,
    markAsUnsaved,
  } = useStrategyWorkspaceStore();

  // Fetch on mount
  useEffect(() => {
    fetchLeaderboard(filter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle fork: copy strategy params into workspace and navigate to editor
  const handleFork = useCallback(
    (entry: LeaderboardEntry) => {
      if (!entry.strategyParams) return;

      const code = generateForkCode(entry);
      const prompt = `Fork \u81EA\u6392\u884C\u699C: ${entry.strategyName} (Sharpe ${entry.sharpe.toFixed(2)})`;

      updateStrategyInput(prompt);
      updateGeneratedCode(code);
      markAsUnsaved();

      showToast.success(
        `\u5DF2\u590D\u5236\u300C${entry.strategyName}\u300D\u5230\u5DE5\u4F5C\u53F0`,
      );

      // Navigate to strategy editor
      router.push('/dashboard');
    },
    [updateGeneratedCode, updateStrategyInput, markAsUnsaved, router],
  );

  // Handle filter tab change
  const handleFilterChange = useCallback(
    (newFilter: LeaderboardFilter) => {
      if (newFilter === filter) return;
      setFilter(newFilter);
    },
    [filter, setFilter],
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {'\u7B56\u7565\u6392\u884C\u699C'}
            </h1>
            <p className="text-sm text-white/50">
              {'\u793E\u533A\u9AD8\u624B\u7B56\u7565\u6392\u540D\uFF0CFork \u5230\u81EA\u5DF1\u7684\u5DE5\u4F5C\u53F0'}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleFilterChange(tab.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition btn-tactile',
                filter === tab.key
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white',
              )}
              title={tab.description}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-surface rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Desktop table view */}
        {!loading && entries.length > 0 && (
          <div className="hidden md:block glass-panel rounded-xl overflow-hidden border border-white/5">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-16 text-white/40">#</TableHead>
                  <TableHead className="text-white/40">{'\u7528\u6237'}</TableHead>
                  <TableHead className="text-white/40">{'\u7B56\u7565\u540D\u79F0'}</TableHead>
                  <TableHead className="text-right text-white/40">Sharpe</TableHead>
                  <TableHead className="text-right text-white/40">{'\u6536\u76CA\u7387'}</TableHead>
                  <TableHead className="text-right text-white/40">{'\u56DE\u6D4B\u6570'}</TableHead>
                  <TableHead className="w-28 text-center text-white/40">{'\u64CD\u4F5C'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const canFork = entry.strategyParams !== null;
                  return (
                    <TableRow
                      key={entry.rank}
                      className={cn(
                        'border-white/5 transition-colors',
                        entry.rank <= 3
                          ? 'hover:bg-yellow-500/5'
                          : 'hover:bg-white/5',
                      )}
                    >
                      <TableCell className="py-3">{getRankBadge(entry.rank)}</TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm text-white/70">{entry.username}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-medium text-white">{entry.strategyName}</span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-mono tabular-nums text-sm text-accent font-medium">
                          {entry.sharpe.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span
                          className={cn(
                            'font-mono tabular-nums text-sm font-medium',
                            entry.totalReturn >= 0 ? 'text-profit' : 'text-loss',
                          )}
                        >
                          {entry.totalReturn >= 0 ? '+' : ''}
                          {(entry.totalReturn * 100).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-mono tabular-nums text-sm text-white/70">
                          {entry.backtestCount}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <button
                          type="button"
                          disabled={!canFork}
                          onClick={() => handleFork(entry)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition btn-tactile',
                            canFork
                              ? 'bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30'
                              : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed',
                          )}
                          title={canFork ? '\u590D\u5236\u7B56\u7565\u53C2\u6570\u5230\u5DE5\u4F5C\u53F0' : '\u4F5C\u8005\u672A\u5F00\u653E\u53C2\u6570'}
                        >
                          <Copy className="w-3 h-3" />
                          Fork
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile card view */}
        {!loading && entries.length > 0 && (
          <div className="md:hidden space-y-3">
            {entries.map((entry) => (
              <LeaderboardCard
                key={entry.rank}
                entry={entry}
                onFork={handleFork}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 text-sm">{'\u6682\u65E0\u6392\u884C\u6570\u636E'}</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-loss/5 border border-loss/20 rounded-xl">
          <p className="text-xs text-white/50 leading-relaxed">
            <span className="text-loss font-medium">{'\u514D\u8D23\u58F0\u660E'}</span>
            {' '}
            {'\u6392\u884C\u6570\u636E\u57FA\u4E8E\u7528\u6237\u516C\u5F00\u7684\u56DE\u6D4B\u7ED3\u679C\uFF0C\u4E0D\u6784\u6210\u6295\u8D44\u5EFA\u8BAE\u3002\u5386\u53F2\u56DE\u6D4B\u7ED3\u679C\u4E0D\u4EE3\u8868\u672A\u6765\u6536\u76CA\uFF0C\u91CF\u5316\u4EA4\u6613\u5B58\u5728\u5E02\u573A\u98CE\u9669\u3002'}
          </p>
        </div>
      </main>
    </div>
  );
}
