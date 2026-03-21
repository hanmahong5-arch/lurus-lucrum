/**
 * Achievement Store
 *
 * Persists user achievement progress and unlocked badges.
 * Tracks stats like total backtests, best sharpe, best return, etc.
 * and automatically checks unlock conditions when stats update.
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:achievements`
 *
 * @module lib/stores/achievement-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Achievement Definitions
// =============================================================================

export interface AchievementDef {
  /** Unique achievement identifier */
  id: string;
  /** Display emoji */
  emoji: string;
  /** Achievement name */
  name: string;
  /** Achievement description (unlock condition) */
  description: string;
  /** Reward text shown on unlock */
  reward: string;
  /** Which stat to check */
  stat: keyof AchievementStats;
  /** Threshold value to trigger unlock */
  threshold: number;
  /** Comparison mode: 'gte' = stat >= threshold, 'gt' = stat > threshold */
  comparison: 'gte' | 'gt';
}

/** All achievement definitions */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_backtest',
    emoji: '\u{1F3C1}',
    name: '\u7B2C\u4E00\u6B65',
    description: '\u5B8C\u6210\u9996\u6B21\u56DE\u6D4B',
    reward: '\u89E3\u9501 5 \u4E2A\u7B56\u7565\u6A21\u677F',
    stat: 'totalBacktests',
    threshold: 1,
    comparison: 'gte',
  },
  {
    id: 'ten_backtests',
    emoji: '\u{1F4CA}',
    name: '\u6570\u636E\u79D1\u5B66\u5BB6',
    description: '\u7D2F\u8BA1\u8FD0\u884C 10 \u6B21\u56DE\u6D4B',
    reward: '\u89E3\u9501 AI \u987E\u95EE',
    stat: 'totalBacktests',
    threshold: 10,
    comparison: 'gte',
  },
  {
    id: 'sharpe_2',
    emoji: '\u{1F3AF}',
    name: '\u795E\u67AA\u624B',
    description: '\u4EFB\u610F\u56DE\u6D4B\u590F\u666E\u6BD4\u7387 > 2.0',
    reward: '\u4E2A\u4EBA\u4E3B\u9875\u5FBD\u7AE0',
    stat: 'bestSharpe',
    threshold: 2.0,
    comparison: 'gt',
  },
  {
    id: 'return_50',
    emoji: '\u{1F4C8}',
    name: '\u725B\u5E02\u8D62\u5BB6',
    description: '\u4EFB\u610F\u56DE\u6D4B\u6536\u76CA\u7387 > 50%',
    reward: '\u6392\u884C\u699C\u5165\u56F4',
    stat: 'bestReturn',
    threshold: 50,
    comparison: 'gt',
  },
  {
    id: 'streak_7',
    emoji: '\u{1F525}',
    name: '\u8FDE\u7EED\u6253\u5361\u5927\u5E08',
    description: '\u8FDE\u7EED\u767B\u5F55 7 \u5929',
    reward: '+3 AI \u8C03\u7528/\u5929',
    stat: 'loginStreak',
    threshold: 7,
    comparison: 'gte',
  },
  {
    id: 'twenty_strategies',
    emoji: '\u{1F9EA}',
    name: '\u75AF\u72C2\u79D1\u5B66\u5BB6',
    description: '\u521B\u5EFA 20 \u4E2A\u7B56\u7565',
    reward: '\u89E3\u9501\u81EA\u5B9A\u4E49\u56E0\u5B50',
    stat: 'totalStrategies',
    threshold: 20,
    comparison: 'gte',
  },
  {
    id: 'ten_stocks',
    emoji: '\u{1F30D}',
    name: '\u5206\u6563\u6295\u8D44\u5BB6',
    description: '\u5728 10+ \u53EA\u80A1\u7968\u4E0A\u9A8C\u8BC1',
    reward: '\u591A\u80A1\u7968 Pro',
    stat: 'stocksValidated',
    threshold: 10,
    comparison: 'gte',
  },
  {
    id: 'share_3',
    emoji: '\u{1F465}',
    name: '\u793E\u4EA4\u8774\u8776',
    description: '\u5206\u4EAB 3 \u6B21\u7B56\u7565',
    reward: '\u63A8\u8350\u5956\u52B1',
    stat: 'sharesCount',
    threshold: 3,
    comparison: 'gte',
  },
];

// =============================================================================
// Types
// =============================================================================

/** Stats tracked for achievement progress */
export interface AchievementStats {
  totalBacktests: number;
  totalStrategies: number;
  bestSharpe: number;
  bestReturn: number;
  loginStreak: number;
  stocksValidated: number;
  sharesCount: number;
  /** ISO date of last login for streak tracking */
  lastLoginDate: string;
  /** Set of unique stock symbols validated */
  validatedStockSymbols: string[];
}

/** Record of unlocked achievements */
export interface UnlockedAchievement {
  /** ISO timestamp when unlocked */
  unlockedAt: string;
}

export interface AchievementState {
  /** Map of achievement ID -> unlock info */
  unlocked: Record<string, UnlockedAchievement>;
  /** Cumulative stats */
  stats: AchievementStats;
  /** Queue of newly unlocked achievement IDs to show toast for */
  pendingToasts: string[];
}

interface AchievementActions {
  /**
   * Record a stat increment and check if any achievements are newly unlocked.
   * For cumulative stats (totalBacktests, totalStrategies, sharesCount), adds `value`.
   * For max stats (bestSharpe, bestReturn), takes the max of current and `value`.
   */
  recordStat: (stat: keyof AchievementStats, value: number) => void;

  /**
   * Record a stock symbol as validated (for stocksValidated achievement).
   */
  recordStockValidated: (symbol: string) => void;

  /**
   * Update login streak. Call on each dashboard visit.
   * Increments streak if last login was yesterday, resets if gap > 1 day.
   */
  recordLogin: () => void;

  /**
   * Consume one pending toast (oldest first). Returns the achievement ID or null.
   */
  consumeToast: () => string | null;

  /**
   * Reset all achievements and stats (for testing/debug).
   */
  reset: () => void;
}

export type AchievementStore = AchievementState & AchievementActions & HydrationState;

// =============================================================================
// Initial State
// =============================================================================

const INITIAL_STATS: AchievementStats = {
  totalBacktests: 0,
  totalStrategies: 0,
  bestSharpe: 0,
  bestReturn: 0,
  loginStreak: 0,
  stocksValidated: 0,
  sharesCount: 0,
  lastLoginDate: '',
  validatedStockSymbols: [],
};

const INITIAL_STATE: AchievementState = {
  unlocked: {},
  stats: { ...INITIAL_STATS },
  pendingToasts: [],
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check all achievements against current stats and return newly unlocked IDs.
 */
function checkUnlocks(
  stats: AchievementStats,
  alreadyUnlocked: Record<string, UnlockedAchievement>,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (alreadyUnlocked[achievement.id]) continue;
    const statValue = stats[achievement.stat];
    if (typeof statValue !== 'number') continue;
    const met =
      achievement.comparison === 'gte'
        ? statValue >= achievement.threshold
        : statValue > achievement.threshold;
    if (met) {
      newlyUnlocked.push(achievement.id);
    }
  }
  return newlyUnlocked;
}

/**
 * Get today's date as YYYY-MM-DD string (local timezone).
 */
function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if dateA is exactly one day before dateB (both YYYY-MM-DD).
 */
function isYesterday(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  const diffMs = b.getTime() - a.getTime();
  const oneDay = 86_400_000;
  return diffMs === oneDay;
}

// =============================================================================
// Store
// =============================================================================

export const useAchievementStore = createPersistedStore<AchievementStore>(
  'achievements',
  (set, get) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    recordStat: (stat, value) =>
      set((state) => {
        // Update the stat
        switch (stat) {
          case 'totalBacktests':
          case 'totalStrategies':
          case 'sharesCount':
            (state.stats[stat] as number) += value;
            break;
          case 'bestSharpe':
          case 'bestReturn':
            if (value > (state.stats[stat] as number)) {
              (state.stats[stat] as number) = value;
            }
            break;
          case 'loginStreak':
          case 'stocksValidated':
            // These are managed by dedicated methods
            break;
          default:
            break;
        }

        // Check for new unlocks
        const newUnlocks = checkUnlocks(state.stats, state.unlocked);
        for (const id of newUnlocks) {
          state.unlocked[id] = { unlockedAt: new Date().toISOString() };
          state.pendingToasts.push(id);
        }
      }),

    recordStockValidated: (symbol) =>
      set((state) => {
        if (!state.stats.validatedStockSymbols.includes(symbol)) {
          state.stats.validatedStockSymbols.push(symbol);
          state.stats.stocksValidated = state.stats.validatedStockSymbols.length;

          // Check for new unlocks
          const newUnlocks = checkUnlocks(state.stats, state.unlocked);
          for (const id of newUnlocks) {
            state.unlocked[id] = { unlockedAt: new Date().toISOString() };
            state.pendingToasts.push(id);
          }
        }
      }),

    recordLogin: () =>
      set((state) => {
        const today = getTodayDateStr();
        if (state.stats.lastLoginDate === today) return;

        if (isYesterday(state.stats.lastLoginDate, today)) {
          state.stats.loginStreak += 1;
        } else if (state.stats.lastLoginDate !== today) {
          // Gap of more than 1 day or first login -> reset streak to 1
          state.stats.loginStreak = 1;
        }
        state.stats.lastLoginDate = today;

        // Check for new unlocks
        const newUnlocks = checkUnlocks(state.stats, state.unlocked);
        for (const id of newUnlocks) {
          state.unlocked[id] = { unlockedAt: new Date().toISOString() };
          state.pendingToasts.push(id);
        }
      }),

    consumeToast: () => {
      const current = get();
      if (current.pendingToasts.length === 0) return null;
      const id = current.pendingToasts[0]!;
      set((state) => {
        state.pendingToasts.shift();
      });
      return id;
    },

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
        state.stats = { ...INITIAL_STATS };
      }),
  }),
  {
    version: 1,
    partialize: (state) =>
      ({
        unlocked: state.unlocked,
        stats: state.stats,
        // pendingToasts are transient but we persist them so toasts survive refresh
        pendingToasts: state.pendingToasts,
      }) as typeof state,
  },
);

// =============================================================================
// Selectors
// =============================================================================

export const selectUnlocked = (state: AchievementStore) => state.unlocked;
export const selectStats = (state: AchievementStore) => state.stats;
export const selectPendingToasts = (state: AchievementStore) => state.pendingToasts;
export const selectUnlockedCount = (state: AchievementStore) =>
  Object.keys(state.unlocked).length;
export const selectTotalAchievements = () => ACHIEVEMENTS.length;
