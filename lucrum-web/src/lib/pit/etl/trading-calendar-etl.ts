/**
 * Trading Calendar ETL
 *
 * Bootstrap strategy: seed the trading_calendar using a weekday heuristic
 * (Mon-Fri = trading, Sat/Sun = closed). Known CN public holidays should
 * be overridden via `overrides` until we plug in a real source.
 *
 * TODO(phase-0.5+): replace with real source (eastmoney calendar endpoint
 * or akshare tool_trade_date_hist_sina) once we settle on provenance.
 *
 * @module lib/pit/etl/trading-calendar-etl
 */

import type { IPitCalendarRepository, TradingDayInfo } from '../interfaces';
import { getPitCalendarRepository } from '..';

const MS_PER_DAY = 86_400_000;

function iterateDates(startDate: string, endDate: string): string[] {
  const start = Date.parse(startDate + 'T00:00:00Z');
  const end = Date.parse(endDate + 'T00:00:00Z');
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new Error(`Invalid range: ${startDate} → ${endDate}`);
  }
  const out: string[] = [];
  for (let t = start; t <= end; t += MS_PER_DAY) {
    const iso = new Date(t).toISOString().split('T')[0];
    if (iso) out.push(iso);
  }
  return out;
}

export interface SeedTradingCalendarOptions {
  readonly startDate: string;
  readonly endDate: string;
  /** ISO dates that should be marked non-trading despite being weekdays (CN holidays). */
  readonly closedOverrides?: ReadonlyArray<string>;
  /** ISO dates that should be marked trading despite being weekends (rare, e.g. adjusted workdays). */
  readonly openOverrides?: ReadonlyArray<string>;
  /** Optional injection for tests. */
  readonly repo?: IPitCalendarRepository;
}

export interface SeedTradingCalendarResult {
  readonly totalDays: number;
  readonly tradingDays: number;
  readonly closedDays: number;
  readonly startDate: string;
  readonly endDate: string;
}

/**
 * Populate trading_calendar for [startDate, endDate] using a weekday heuristic.
 * Idempotent: existing rows are updated via ON CONFLICT.
 */
export async function seedTradingCalendar(
  options: SeedTradingCalendarOptions
): Promise<SeedTradingCalendarResult> {
  const { startDate, endDate } = options;
  const closedSet = new Set(options.closedOverrides ?? []);
  const openSet = new Set(options.openOverrides ?? []);
  const repo = options.repo ?? getPitCalendarRepository();

  const days: TradingDayInfo[] = iterateDates(startDate, endDate).map((date) => {
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isClosed = closedSet.has(date) || (isWeekend && !openSet.has(date));
    return {
      date,
      isTrading: !isClosed,
      sessionType: isClosed ? 'closed' : 'normal',
    };
  });

  await repo.upsertTradingDays(days);

  return {
    totalDays: days.length,
    tradingDays: days.filter((d) => d.isTrading).length,
    closedDays: days.filter((d) => !d.isTrading).length,
    startDate,
    endDate,
  };
}
