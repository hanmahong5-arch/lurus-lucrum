/**
 * Team Leaderboard Service
 * 团队排行榜服务
 *
 * Calculates and caches team member rankings based on backtest performance.
 * Composite score = 0.4 * normalizedReturn + 0.3 * normalizedSharpe + 0.3 * consistency
 */

import { db } from '@/lib/db';
import {
  teamLeaderboardSnapshots,
  backtestHistory,
  tenantMembers,
  type TeamLeaderboardSnapshot,
} from '@/lib/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  avatar: string | null;
  totalReturn: number;
  sharpeRatio: number;
  score: number;
  rank: number;
  backtestCount: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  period: string;
  periodKey: string;
  updatedAt: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get or compute team leaderboard for a given period.
 * Checks for cached snapshot first, computes fresh if stale.
 */
export async function getTeamLeaderboard(
  tenantId: number,
  period: 'weekly' | 'monthly' | 'all_time' = 'weekly'
): Promise<LeaderboardResult> {
  const periodKey = getPeriodKey(period);

  // Check for cached snapshot
  const cached = await db
    .select()
    .from(teamLeaderboardSnapshots)
    .where(
      and(
        eq(teamLeaderboardSnapshots.tenantId, tenantId),
        eq(teamLeaderboardSnapshots.period, period),
        eq(teamLeaderboardSnapshots.periodKey, periodKey)
      )
    )
    .orderBy(teamLeaderboardSnapshots.rank)
    .limit(50);

  if (cached.length > 0) {
    // Enrich with user info
    return enrichLeaderboard(cached, period, periodKey);
  }

  // Compute fresh leaderboard
  return computeAndCacheLeaderboard(tenantId, period, periodKey);
}

/**
 * Compute leaderboard from backtest history and cache the result.
 */
async function computeAndCacheLeaderboard(
  tenantId: number,
  period: string,
  periodKey: string
): Promise<LeaderboardResult> {
  const dateFilter = getDateFilter(period);

  // Get all member backtests within the period
  const memberStats = await db
    .select({
      userId: backtestHistory.userId,
      avgReturn: sql<number>`avg(${backtestHistory.totalReturn})::real`,
      avgSharpe: sql<number>`avg(${backtestHistory.sharpeRatio})::real`,
      count: sql<number>`count(*)::int`,
    })
    .from(backtestHistory)
    .innerJoin(tenantMembers, and(
      eq(tenantMembers.userId, backtestHistory.userId),
      eq(tenantMembers.tenantId, tenantId)
    ))
    .where(
      and(
        eq(backtestHistory.tenantId, tenantId),
        dateFilter ? gte(backtestHistory.createdAt, dateFilter) : undefined
      )
    )
    .groupBy(backtestHistory.userId);

  if (memberStats.length === 0) {
    return { entries: [], period, periodKey, updatedAt: new Date().toISOString() };
  }

  // Calculate composite scores
  const maxReturn = Math.max(...memberStats.map((s) => Math.abs(s.avgReturn ?? 0)), 0.01);
  const maxSharpe = Math.max(...memberStats.map((s) => Math.abs(s.avgSharpe ?? 0)), 0.01);

  const scored = memberStats.map((s) => ({
    userId: s.userId,
    totalReturn: s.avgReturn ?? 0,
    sharpeRatio: s.avgSharpe ?? 0,
    backtestCount: s.count,
    score: calculateScore(s.avgReturn ?? 0, s.avgSharpe ?? 0, s.count, maxReturn, maxSharpe),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Assign ranks and cache
  const snapshots = scored.map((s, idx) => ({
    tenantId,
    userId: s.userId,
    period,
    periodKey,
    totalReturn: s.totalReturn,
    sharpeRatio: s.sharpeRatio,
    score: s.score,
    rank: idx + 1,
  }));

  if (snapshots.length > 0) {
    // Upsert snapshots
    for (const snap of snapshots) {
      await db.insert(teamLeaderboardSnapshots).values(snap);
    }
  }

  return enrichLeaderboard(
    snapshots.map((s) => ({ ...s, id: 0, createdAt: new Date() })),
    period,
    periodKey
  );
}

/**
 * Composite score: weighted combination of return, sharpe, and activity.
 */
function calculateScore(
  avgReturn: number,
  avgSharpe: number,
  count: number,
  maxReturn: number,
  maxSharpe: number
): number {
  const normReturn = avgReturn / maxReturn; // [-1, 1]
  const normSharpe = avgSharpe / maxSharpe; // [-1, 1]
  const consistency = Math.min(count / 20, 1); // caps at 20 backtests = full score

  return Math.round((0.4 * normReturn + 0.3 * normSharpe + 0.3 * consistency) * 1000) / 10;
}

/**
 * Enrich leaderboard entries with user info (name, avatar).
 */
async function enrichLeaderboard(
  snapshots: Array<{ userId: string; totalReturn: number; sharpeRatio: number; score: number; rank: number }>,
  period: string,
  periodKey: string
): Promise<LeaderboardResult> {
  if (snapshots.length === 0) {
    return { entries: [], period, periodKey, updatedAt: new Date().toISOString() };
  }

  // User display info lives in Zitadel — leave null here; callers can enrich.
  const entries: LeaderboardEntry[] = snapshots.map((s) => {
    return {
      userId: s.userId,
      userName: null,
      avatar: null,
      totalReturn: s.totalReturn,
      sharpeRatio: s.sharpeRatio,
      score: s.score,
      rank: s.rank,
      backtestCount: 0, // Would need re-query for cached data
    };
  });

  return { entries, period, periodKey, updatedAt: new Date().toISOString() };
}

// ============================================================================
// Helpers
// ============================================================================

function getPeriodKey(period: string): string {
  const now = new Date();
  switch (period) {
    case 'weekly': {
      const y = now.getFullYear();
      const w = getWeekNumber(now);
      return `${y}-W${String(w).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'all_time':
      return 'all';
    default:
      return 'all';
  }
}

function getDateFilter(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'weekly': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'monthly': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case 'all_time':
      return null;
    default:
      return null;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
