'use client';

/**
 * User Action Tracker
 *
 * Tracks the user's recent actions to determine suggestion context.
 * Stored in sessionStorage (not persistent -- per session only).
 *
 * Wire `trackAction` into key user events:
 * - After backtest completes -> trackAction('backtest-complete', { positive })
 * - After strategy generation -> trackAction('strategy-generated')
 * - After watchlist change   -> trackAction('watchlist-changed', { count })
 * - On page load (dashboard) -> determine if returning user
 *
 * @module hooks/use-user-actions
 */

import { useCallback, useMemo } from 'react';
import type { SuggestionContext } from '@/lib/suggestions/next-action';

// =============================================================================
// TYPES
// =============================================================================

/** A single tracked user action */
export interface TrackedAction {
  /** Action identifier */
  action: string;
  /** Additional context data */
  detail?: Record<string, unknown>;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'lucrum:user-actions';

/** Maximum number of actions to retain in sessionStorage */
const MAX_ACTIONS = 50;

/** Idle threshold: if no action for this many ms, consider user idle (2 min) */
const IDLE_THRESHOLD_MS = 120_000;

// =============================================================================
// SESSION STORAGE HELPERS
// =============================================================================

function getStoredActions(): TrackedAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TrackedAction[];
  } catch {
    return [];
  }
}

function setStoredActions(actions: TrackedAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    // sessionStorage full or unavailable -- silently ignore
  }
}

// =============================================================================
// DISMISSAL TRACKING
// =============================================================================

const DISMISSED_KEY = 'lucrum:dismissed-suggestions';

export function isDismissed(suggestionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissed: unknown = JSON.parse(raw);
    if (!Array.isArray(dismissed)) return false;
    return dismissed.includes(suggestionId);
  } catch {
    return false;
  }
}

export function dismissSuggestion(suggestionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    const dismissed: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!dismissed.includes(suggestionId)) {
      dismissed.push(suggestionId);
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    }
  } catch {
    // Silently ignore
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useUserActions() {
  /**
   * Record a user action to the session action log.
   */
  const trackAction = useCallback(
    (action: string, detail?: Record<string, unknown>) => {
      const actions = getStoredActions();
      const entry: TrackedAction = {
        action,
        detail,
        timestamp: Date.now(),
      };
      actions.push(entry);

      // Evict oldest entries beyond the cap
      const trimmed = actions.length > MAX_ACTIONS
        ? actions.slice(actions.length - MAX_ACTIONS)
        : actions;

      setStoredActions(trimmed);
    },
    [],
  );

  /**
   * Get the most recent tracked action, or null if none.
   */
  const getLastAction = useCallback((): TrackedAction | null => {
    const actions = getStoredActions();
    return actions[actions.length - 1] ?? null;
  }, []);

  /**
   * Derive the current suggestion context from tracked actions
   * and the current page path.
   */
  const getContext = useCallback(
    (pathname: string, opts?: { hasCompletedOnboarding?: boolean }): SuggestionContext => {
      // First-time user check
      if (opts?.hasCompletedOnboarding === false) {
        return 'first-time';
      }

      const lastAction = getLastAction();

      // If there is a recent action, derive context from it
      if (lastAction) {
        const age = Date.now() - lastAction.timestamp;

        switch (lastAction.action) {
          case 'backtest-complete':
            if (age < IDLE_THRESHOLD_MS) return 'after-backtest';
            break;
          case 'strategy-generated':
            if (age < IDLE_THRESHOLD_MS) return 'after-generation';
            break;
          case 'watchlist-changed':
            if (age < IDLE_THRESHOLD_MS) return 'watchlist-changed';
            break;
          case 'portfolio-backtest-complete':
            if (age < IDLE_THRESHOLD_MS) return 'after-portfolio';
            break;
          default:
            break;
        }

        // If last action is old, consider the user idle
        if (age > IDLE_THRESHOLD_MS && pathname === '/dashboard') {
          return 'idle-dashboard';
        }
      }

      // Fall back to path-based heuristics
      if (pathname.startsWith('/dashboard/marketplace')) {
        return 'viewing-marketplace';
      }

      // Default: returning user on dashboard
      if (pathname === '/dashboard') {
        return 'returning-user';
      }

      return 'returning-user';
    },
    [getLastAction],
  );

  return useMemo(
    () => ({ trackAction, getLastAction, getContext }),
    [trackAction, getLastAction, getContext],
  );
}
