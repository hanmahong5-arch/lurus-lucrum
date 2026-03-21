"use client";

/**
 * Achievement Panel
 *
 * Displays all achievements in a grid layout. Unlocked achievements show
 * colorful emoji, name, and unlock date. Locked achievements show a lock
 * icon with progress bar toward the goal.
 *
 * @module components/achievements/achievement-panel
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useAchievementStore,
  ACHIEVEMENTS,
  type AchievementDef,
  type AchievementStats,
  type UnlockedAchievement,
} from "@/lib/stores/achievement-store";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get progress value for a given achievement based on current stats.
 * Returns { current, target } for display.
 */
function getProgress(
  achievement: AchievementDef,
  stats: AchievementStats,
): { current: number; target: number; label: string } {
  const current = typeof stats[achievement.stat] === 'number'
    ? (stats[achievement.stat] as number)
    : 0;
  const target = achievement.threshold;

  // Build a human-readable progress label
  let label: string;
  switch (achievement.stat) {
    case 'totalBacktests':
      label = `${current}/${target} \u6B21\u56DE\u6D4B`;
      break;
    case 'totalStrategies':
      label = `${current}/${target} \u4E2A\u7B56\u7565`;
      break;
    case 'bestSharpe':
      label = `\u6700\u9AD8 ${current.toFixed(2)} / ${target}`;
      break;
    case 'bestReturn':
      label = `\u6700\u9AD8 ${current.toFixed(1)}% / ${target}%`;
      break;
    case 'loginStreak':
      label = `${current}/${target} \u5929`;
      break;
    case 'stocksValidated':
      label = `${current}/${target} \u53EA\u80A1\u7968`;
      break;
    case 'sharesCount':
      label = `${current}/${target} \u6B21\u5206\u4EAB`;
      break;
    default:
      label = `${current}/${target}`;
  }

  return { current, target, label };
}

/**
 * Format an ISO date string to a local short date.
 */
function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}\u6708${d.getDate()}\u65E5`;
  } catch {
    return isoStr;
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

interface AchievementCardProps {
  achievement: AchievementDef;
  unlockInfo: UnlockedAchievement | null;
  stats: AchievementStats;
}

function AchievementCard({ achievement, unlockInfo, stats }: AchievementCardProps) {
  const isUnlocked = !!unlockInfo;
  const progress = useMemo(
    () => getProgress(achievement, stats),
    [achievement, stats],
  );
  const progressPct = Math.min((progress.current / progress.target) * 100, 100);

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-300",
        isUnlocked
          ? "bg-gradient-to-br from-accent/10 to-primary/5 border-accent/30 hover:border-accent/50"
          : "bg-surface/50 border-white/5 hover:border-white/10",
      )}
    >
      {/* Badge area */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "text-3xl leading-none flex-shrink-0 transition-all",
            isUnlocked ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "grayscale opacity-40",
          )}
        >
          {isUnlocked ? achievement.emoji : "\u{1F512}"}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-sm font-semibold truncate",
              isUnlocked ? "text-accent" : "text-white/40",
            )}
          >
            {achievement.name}
          </h3>
          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Progress or unlock info */}
      <div className="mt-3">
        {isUnlocked ? (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-accent/80 font-medium">
              {achievement.reward}
            </span>
            <span className="text-[10px] text-white/30 font-mono tabular-nums">
              {formatDate(unlockInfo.unlockedAt)}
            </span>
          </div>
        ) : (
          <div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-white/30 font-mono tabular-nums">
                {progress.label}
              </span>
              <span className="text-[10px] text-white/20 font-mono tabular-nums">
                {Math.round(progressPct)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface AchievementPanelProps {
  className?: string;
}

export function AchievementPanel({ className }: AchievementPanelProps) {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const stats = useAchievementStore((s) => s.stats);

  const unlockedCount = Object.keys(unlocked).length;
  const totalCount = ACHIEVEMENTS.length;

  // Sort: unlocked first, then locked
  const sortedAchievements = useMemo(() => {
    return [...ACHIEVEMENTS].sort((a, b) => {
      const aUnlocked = !!unlocked[a.id];
      const bUnlocked = !!unlocked[b.id];
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;
      return 0;
    });
  }, [unlocked]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            \u6211\u7684\u6210\u5C31
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            \u5B8C\u6210\u6311\u6218\u89E3\u9501\u5956\u52B1\u4E0E\u5FBD\u7AE0
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold font-mono tabular-nums text-accent">
            {unlockedCount}
          </span>
          <span className="text-sm text-white/30">/ {totalCount}</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-700"
          style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sortedAchievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            unlockInfo={unlocked[achievement.id] ?? null}
            stats={stats}
          />
        ))}
      </div>
    </div>
  );
}

export default AchievementPanel;
