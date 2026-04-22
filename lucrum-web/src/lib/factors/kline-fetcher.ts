/**
 * Batched kline fetcher for factor calculation.
 *
 * Many factors need the same kline window for the same symbol set. This
 * helper fetches once and memoises per-symbol so downstream factors share
 * the data. Enforces the PIT anchor by filtering rows > asOfDate.
 *
 * @module lib/factors/kline-fetcher
 */

import { getKlineRepository } from '@/lib/repositories';
import type { FactorKlineBar } from './types';

export interface BuildKlineFetcherArgs {
  readonly symbols: ReadonlyArray<string>;
  readonly asOfDate: string;
  /** Lookback in trading days (actual fetch adds a buffer for calendar days). */
  readonly klineWindow: number;
}

export interface KlineFetcher {
  (symbol: string): Promise<ReadonlyArray<FactorKlineBar>>;
}

const CALENDAR_BUFFER_RATIO = 1.5; // convert trading days to approx calendar days

function subtractCalendarDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0] ?? '';
}

/**
 * Build a memoised fetcher. First call triggers a single batch query; later
 * calls resolve from the in-memory cache.
 */
export function buildKlineFetcher(args: BuildKlineFetcherArgs): KlineFetcher {
  const { symbols, asOfDate, klineWindow } = args;
  const startDate = subtractCalendarDays(
    asOfDate,
    Math.ceil(klineWindow * CALENDAR_BUFFER_RATIO)
  );

  let bootstrap: Promise<Map<string, ReadonlyArray<FactorKlineBar>>> | null = null;

  const ensure = () => {
    if (bootstrap) return bootstrap;
    bootstrap = (async () => {
      const repo = getKlineRepository();
      const raw = await repo.getBatch([...symbols], startDate, asOfDate);
      const out = new Map<string, ReadonlyArray<FactorKlineBar>>();
      raw.forEach((rows, symbol) => {
        const bars: FactorKlineBar[] = rows
          .filter((r) => r.date <= asOfDate)
          .map((r) => ({
            date: r.date,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            volume: r.volume,
            amount: r.amount,
            adjFactor: r.adjFactor,
          }));
        // Ensure ascending date order (repo already sorts, but defend against restatements).
        bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        out.set(symbol, bars);
      });
      for (const s of symbols) {
        if (!out.has(s)) out.set(s, []);
      }
      return out;
    })();
    return bootstrap;
  };

  return async (symbol: string) => {
    const map = await ensure();
    return map.get(symbol) ?? [];
  };
}
