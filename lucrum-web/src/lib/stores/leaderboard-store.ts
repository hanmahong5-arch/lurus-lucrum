/**
 * Leaderboard Store
 *
 * In-memory Zustand store for strategy ranking data.
 * No persistence needed — data refreshes on every visit.
 *
 * Provides:
 * - Filter by ranking dimension (weekly sharpe / monthly return / most backtests)
 * - Demo data until backend API is available
 * - Fork action to copy strategy params into workspace store
 *
 * @module lib/stores/leaderboard-store
 */

import { create } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export type LeaderboardFilter =
  | 'weekly_sharpe'
  | 'monthly_return'
  | 'most_backtests';

export interface LeaderboardEntry {
  /** Display rank (1-based) */
  rank: number;
  /** Anonymized display name */
  username: string;
  /** Strategy display name */
  strategyName: string;
  /** Sharpe ratio (annualized) */
  sharpe: number;
  /** Total return as decimal (e.g. 0.35 = 35%) */
  totalReturn: number;
  /** Number of backtests run */
  backtestCount: number;
  /** Strategy parameters for forking — null if author opted out */
  strategyParams: Record<string, number> | null;
}

interface LeaderboardState {
  /** Current ranking entries */
  entries: LeaderboardEntry[];
  /** Whether data is loading */
  loading: boolean;
  /** Active filter dimension */
  filter: LeaderboardFilter;
}

interface LeaderboardActions {
  /** Fetch leaderboard for the given filter (currently returns demo data) */
  fetchLeaderboard: (filter: LeaderboardFilter) => void;
  /** Set filter and re-fetch */
  setFilter: (filter: LeaderboardFilter) => void;
}

export type LeaderboardStore = LeaderboardState & LeaderboardActions;

// =============================================================================
// Demo Data
// =============================================================================

const ANONYMOUS_NAMES = [
  '\u{1F43C} \u533F\u540D\u6295\u8D44\u8005',   // Panda Anonymous Investor
  '\u{1F98A} \u7B56\u7565\u8FBE\u4EBA',           // Fox Strategy Master
  '\u{1F985} \u9E70\u773C\u730E\u624B',           // Eagle Eye Hunter
  '\u{1F409} \u9F99\u9996\u91CF\u5316',           // Dragon Quant Lead
  '\u{1F431} \u6170\u61D2\u4EA4\u6613\u5458',     // Cat Lazy Trader
  '\u{1F43B} \u7A33\u5065\u718A\u5E02',           // Bear Steady Market
  '\u{1F40A} \u6F5C\u4F0F\u5927\u9C44',           // Croc Lurking
  '\u{1F427} \u51B7\u9759\u5206\u6790\u5E08',     // Penguin Cold Analyst
  '\u{1F994} \u523A\u732C\u5BF9\u51B2',           // Hedgehog Hedge
  '\u{1F99C} \u5B66\u820C\u9E66\u9E49',           // Parrot Copycat
];

const STRATEGY_NAMES = [
  'MACD \u91D1\u53C9\u7A81\u7834',               // MACD Golden Cross Breakout
  '\u53CC\u5747\u7EBF\u52A8\u91CF',               // Dual MA Momentum
  'RSI \u8D85\u5356\u53CD\u5F39',                 // RSI Oversold Bounce
  '\u5E03\u6797\u5E26\u6536\u7F29',               // Bollinger Squeeze
  'KDJ \u4F4E\u4F4D\u91D1\u53C9',                 // KDJ Low Golden Cross
  '\u653E\u91CF\u7A81\u7834\u5E73\u53F0',         // Volume Breakout Platform
  '\u591A\u56E0\u5B50\u8F6E\u52A8',               // Multi-Factor Rotation
  '\u8DA3\u52BF\u8FFD\u8E2A\u7CFB\u7EDF',         // Trend Following System
  '\u5747\u503C\u56DE\u5F52\u7B56\u7565',         // Mean Reversion Strategy
  '\u7F3A\u53E3\u56DE\u8865\u6218\u6CD5',         // Gap Fill Strategy
];

/** Generate deterministic demo entries sorted by the given dimension */
function generateDemoEntries(filter: LeaderboardFilter): LeaderboardEntry[] {
  // Base entries with realistic quant metrics
  const baseEntries: Omit<LeaderboardEntry, 'rank'>[] = [
    { username: ANONYMOUS_NAMES[0]!, strategyName: STRATEGY_NAMES[0]!, sharpe: 3.42, totalReturn: 0.78, backtestCount: 47, strategyParams: { fast_window: 5, slow_window: 20, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[1]!, strategyName: STRATEGY_NAMES[1]!, sharpe: 2.85, totalReturn: 0.62, backtestCount: 38, strategyParams: { fast_window: 10, slow_window: 30, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[2]!, strategyName: STRATEGY_NAMES[2]!, sharpe: 2.71, totalReturn: 0.55, backtestCount: 22, strategyParams: { rsi_window: 14, rsi_buy: 25, rsi_sell: 75, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[3]!, strategyName: STRATEGY_NAMES[3]!, sharpe: 2.53, totalReturn: 0.48, backtestCount: 51, strategyParams: { fast_window: 12, slow_window: 26, fixed_size: 2 } },
    { username: ANONYMOUS_NAMES[4]!, strategyName: STRATEGY_NAMES[4]!, sharpe: 2.18, totalReturn: 0.41, backtestCount: 15, strategyParams: null },
    { username: ANONYMOUS_NAMES[5]!, strategyName: STRATEGY_NAMES[5]!, sharpe: 1.95, totalReturn: 0.35, backtestCount: 33, strategyParams: { rsi_window: 9, rsi_buy: 30, rsi_sell: 70, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[6]!, strategyName: STRATEGY_NAMES[6]!, sharpe: 1.72, totalReturn: 0.29, backtestCount: 42, strategyParams: { fast_window: 7, slow_window: 21, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[7]!, strategyName: STRATEGY_NAMES[7]!, sharpe: 1.48, totalReturn: 0.22, backtestCount: 28, strategyParams: { fast_window: 20, slow_window: 60, fixed_size: 1 } },
    { username: ANONYMOUS_NAMES[8]!, strategyName: STRATEGY_NAMES[8]!, sharpe: 1.31, totalReturn: 0.18, backtestCount: 19, strategyParams: null },
    { username: ANONYMOUS_NAMES[9]!, strategyName: STRATEGY_NAMES[9]!, sharpe: 1.15, totalReturn: 0.15, backtestCount: 8, strategyParams: { fast_window: 5, slow_window: 10, fixed_size: 1 } },
  ];

  // Sort by the selected dimension (descending)
  const sorted = [...baseEntries].sort((a, b) => {
    switch (filter) {
      case 'weekly_sharpe':
        return b.sharpe - a.sharpe;
      case 'monthly_return':
        return b.totalReturn - a.totalReturn;
      case 'most_backtests':
        return b.backtestCount - a.backtestCount;
    }
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

// =============================================================================
// Store
// =============================================================================

export const useLeaderboardStore = create<LeaderboardStore>()((set) => ({
  entries: [],
  loading: false,
  filter: 'weekly_sharpe',

  fetchLeaderboard: (filter) => {
    set({ loading: true });

    // Simulate network latency for realistic UX
    // TODO: Replace with real API call when backend endpoint is available
    setTimeout(() => {
      set({
        entries: generateDemoEntries(filter),
        loading: false,
        filter,
      });
    }, 300);
  },

  setFilter: (filter) => {
    set({ filter, loading: true });

    setTimeout(() => {
      set({
        entries: generateDemoEntries(filter),
        loading: false,
      });
    }, 300);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectLeaderboardEntries = (state: LeaderboardStore) => state.entries;
export const selectLeaderboardLoading = (state: LeaderboardStore) => state.loading;
export const selectLeaderboardFilter = (state: LeaderboardStore) => state.filter;
