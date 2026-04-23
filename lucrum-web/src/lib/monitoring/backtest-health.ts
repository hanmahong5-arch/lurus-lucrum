/**
 * Backtest health snapshot — aggregate read-only metrics over a user's recent
 * backtest_history rows. Provides Phase 7.0 operational observability without
 * schema changes or side effects.
 *
 * @module lib/monitoring/backtest-health
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

const DEFAULT_WINDOW_DAYS = 30;
const MIN_WINDOW_DAYS = 1;
const MAX_WINDOW_DAYS = 365;
const MS_PER_DAY = 86_400_000;

export interface BacktestHealthSnapshot {
  readonly userId: string;
  readonly windowDays: number;
  readonly since: string;
  readonly totalRuns: number;
  readonly profitableRuns: number;
  readonly profitableRatio: number | null;
  readonly medianExecutionTimeMs: number | null;
  readonly avgDataCoverage: number | null;
  readonly medianSharpe: number | null;
  readonly medianMaxDrawdown: number | null;
  readonly runsByDay: ReadonlyArray<{ date: string; count: number }>;
  readonly topSymbols: ReadonlyArray<{ symbol: string; count: number }>;
}

function clampWindow(requested: number | undefined): number {
  if (!Number.isFinite(requested)) return DEFAULT_WINDOW_DAYS;
  const n = Math.round(requested as number);
  if (n < MIN_WINDOW_DAYS) return MIN_WINDOW_DAYS;
  if (n > MAX_WINDOW_DAYS) return MAX_WINDOW_DAYS;
  return n;
}

type AggRow = {
  total_runs: string | number;
  profitable_runs: string | number;
  median_exec_time: string | number | null;
  avg_coverage: string | number | null;
  median_sharpe: string | number | null;
  median_drawdown: string | number | null;
};

type DailyRow = { date: string; count: string | number };
type SymbolRow = { symbol: string; count: string | number };

function unwrapRows<T>(raw: unknown): T[] {
  const maybeRowsWrapper = raw as { rows?: T[] } | T[];
  if (Array.isArray(maybeRowsWrapper)) return maybeRowsWrapper;
  return maybeRowsWrapper.rows ?? [];
}

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getBacktestHealthSnapshot(
  userId: string,
  windowDaysRaw?: number,
): Promise<BacktestHealthSnapshot> {
  const windowDays = clampWindow(windowDaysRaw);
  const sinceDate = new Date(Date.now() - windowDays * MS_PER_DAY);
  const since = sinceDate.toISOString();

  const aggRaw = await db.execute<AggRow>(sql`
    SELECT
      COUNT(*)::bigint                                              AS total_runs,
      SUM(CASE WHEN total_return > 0 THEN 1 ELSE 0 END)::bigint     AS profitable_runs,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time)   AS median_exec_time,
      AVG(data_coverage)                                            AS avg_coverage,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sharpe_ratio)     AS median_sharpe,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY max_drawdown)     AS median_drawdown
    FROM backtest_history
    WHERE user_id = ${userId}
      AND created_at >= ${since}
  `);
  const agg = unwrapRows<AggRow>(aggRaw)[0];

  const dailyRaw = await db.execute<DailyRow>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
           COUNT(*)::bigint                                       AS count
    FROM backtest_history
    WHERE user_id = ${userId}
      AND created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  const runsByDay = unwrapRows<DailyRow>(dailyRaw).map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  const symbolRaw = await db.execute<SymbolRow>(sql`
    SELECT symbol, COUNT(*)::bigint AS count
    FROM backtest_history
    WHERE user_id = ${userId}
      AND created_at >= ${since}
    GROUP BY symbol
    ORDER BY count DESC
    LIMIT 10
  `);
  const topSymbols = unwrapRows<SymbolRow>(symbolRaw).map((r) => ({
    symbol: r.symbol,
    count: Number(r.count),
  }));

  const totalRuns = Number(agg?.total_runs ?? 0);
  const profitableRuns = Number(agg?.profitable_runs ?? 0);
  const profitableRatio = totalRuns > 0 ? profitableRuns / totalRuns : null;

  return {
    userId,
    windowDays,
    since,
    totalRuns,
    profitableRuns,
    profitableRatio,
    medianExecutionTimeMs: toNumberOrNull(agg?.median_exec_time ?? null),
    avgDataCoverage: toNumberOrNull(agg?.avg_coverage ?? null),
    medianSharpe: toNumberOrNull(agg?.median_sharpe ?? null),
    medianMaxDrawdown: toNumberOrNull(agg?.median_drawdown ?? null),
    runsByDay,
    topSymbols,
  };
}
