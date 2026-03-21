/**
 * Daily Streak Store
 *
 * Tracks consecutive daily activity for the Lucrum product.
 * Uses the shared createPersistedStore factory for consistent
 * localStorage persistence with hydration tracking.
 *
 * Streak logic:
 * - Same day activity: no change
 * - Consecutive day: streak increments
 * - Gap > 1 day: streak resets to 1
 * - Milestones at 7 and 30 days add reward entries
 *
 * @module lib/stores/streak-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Constants
// =============================================================================

const MILESTONE_THRESHOLDS = [7, 30] as const;

// =============================================================================
// Types
// =============================================================================

interface StreakState {
  /** Current consecutive streak count */
  currentStreak: number;
  /** ISO date string (YYYY-MM-DD) of last recorded activity */
  lastActiveDate: string;
  /** All-time longest streak */
  longestStreak: number;
  /** Milestone reward descriptions */
  rewards: string[];
}

interface StreakActions {
  /**
   * Record user activity for today.
   * Call on dashboard mount — idempotent within the same calendar day.
   */
  recordActivity: () => void;
}

export type StreakStore = StreakState & StreakActions;

// =============================================================================
// Helpers
// =============================================================================

/** Return today's date as YYYY-MM-DD in local timezone */
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Check if dateB is exactly 1 calendar day after dateA (YYYY-MM-DD strings) */
function isConsecutiveDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  const diffMs = b.getTime() - a.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return diffDays === 1;
}

// =============================================================================
// Store
// =============================================================================

export const useStreakStore = createPersistedStore<StreakStore>(
  'streak',
  (set) => ({
    currentStreak: 0,
    lastActiveDate: '',
    longestStreak: 0,
    rewards: [] as string[],
    _hasHydrated: false,
    _setHasHydrated: () => {},

    recordActivity: () => {
      set((state) => {
        const today = getLocalDateString();

        // Already recorded today — no-op
        if (state.lastActiveDate === today) return;

        if (isConsecutiveDay(state.lastActiveDate, today)) {
          // Consecutive day — increment
          state.currentStreak += 1;
        } else {
          // Gap or first activity — reset to 1
          state.currentStreak = 1;
        }

        state.lastActiveDate = today;

        // Update longest streak
        if (state.currentStreak > state.longestStreak) {
          state.longestStreak = state.currentStreak;
        }

        // Check milestones
        for (const threshold of MILESTONE_THRESHOLDS) {
          if (state.currentStreak === threshold) {
            const label = threshold === 7
              ? `7 天连续签到达成 (${today})`
              : `30 天连续签到达成 (${today})`;
            if (!state.rewards.includes(label)) {
              state.rewards.push(label);
            }
          }
        }
      });
    },
  }),
  {
    version: 1,
    partialize: (state) => ({
      currentStreak: state.currentStreak,
      lastActiveDate: state.lastActiveDate,
      longestStreak: state.longestStreak,
      rewards: state.rewards,
    }),
  },
);

// =============================================================================
// Selectors
// =============================================================================

type FullStreakStore = StreakStore & HydrationState;

export const selectCurrentStreak = (s: FullStreakStore) => s.currentStreak;
export const selectLongestStreak = (s: FullStreakStore) => s.longestStreak;
export const selectLastActiveDate = (s: FullStreakStore) => s.lastActiveDate;
export const selectRewards = (s: FullStreakStore) => s.rewards;
