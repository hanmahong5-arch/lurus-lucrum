/**
 * Streak Badge Component
 *
 * Displays a fire icon + consecutive day count in the dashboard header.
 * Hover shows a tooltip with streak details and milestone progress.
 * CSS-only bounce animation on milestone achievement (7/30 days).
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useStreakStore,
  selectCurrentStreak,
  selectLongestStreak,
} from '@/lib/stores/streak-store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// Constants
// =============================================================================

const MILESTONE_7 = 7;
const MILESTONE_30 = 30;

/** Duration in ms for the milestone celebration animation */
const CELEBRATION_DURATION_MS = 1500;

// =============================================================================
// Component
// =============================================================================

export function StreakBadge() {
  const streak = useStreakStore(selectCurrentStreak);
  const longest = useStreakStore(selectLongestStreak);
  const { recordActivity } = useStreakStore();

  const [celebrating, setCelebrating] = useState(false);
  const prevStreakRef = useRef<number>(streak);

  // Record activity on mount
  useEffect(() => {
    recordActivity();
  }, [recordActivity]);

  // Detect milestone achievement and trigger celebration
  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak;

    if (
      streak !== prev &&
      (streak === MILESTONE_7 || streak === MILESTONE_30)
    ) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), CELEBRATION_DURATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [streak]);

  const getProgressMessage = useCallback(() => {
    if (streak < MILESTONE_7) {
      const remaining = MILESTONE_7 - streak;
      return `\u518D\u575A\u6301 ${remaining} \u5929\u89E3\u9501 7 \u5929\u6210\u5C31`;
    }
    if (streak < MILESTONE_30) {
      const remaining = MILESTONE_30 - streak;
      return `\u518D\u575A\u6301 ${remaining} \u5929\u89E3\u9501 30 \u5929\u5927\u5956`;
    }
    return '\u5DF2\u89E3\u9501\u5168\u90E8\u91CC\u7A0B\u7891';
  }, [streak]);

  // Don't render if no streak recorded yet
  if (streak <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            className={`relative flex items-center gap-1 px-2 py-1 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition ${celebrating ? 'streak-celebrate' : ''}`}
            aria-label={`\u8FDE\u7EED\u7B7E\u5230 ${streak} \u5929`}
          >
            <span className="text-sm" role="img" aria-hidden="true">
              {'\uD83D\uDD25'}
            </span>
            <span className="text-xs font-mono tabular-nums font-medium">
              {streak}
            </span>

            {/* Confetti particles — CSS only, shown during celebration */}
            {celebrating && (
              <span className="streak-confetti" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent
          side="bottom"
          className="max-w-[220px] p-3 bg-surface border border-border text-sm"
        >
          <div className="space-y-1.5">
            <p className="font-medium text-white">
              {'\uD83D\uDD25'} {'\u8FDE\u7EED\u7B7E\u5230'} {streak} {'\u5929'}
            </p>
            <p className="text-white/50 text-xs">
              {getProgressMessage()}
            </p>
            {longest > streak && (
              <p className="text-white/40 text-xs">
                {'\u5386\u53F2\u6700\u957F'}: {longest} {'\u5929'}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
