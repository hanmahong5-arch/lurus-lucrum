/**
 * Paper Trading Engine — Sprint 2 mark-to-market sweep.
 *
 * Runs once after each trading-day close. Pulls the latest close price for
 * every symbol held across every active paper_run, updates positions, and
 * writes today's equity row to paper_equity_curve.
 *
 * Designed as a pure orchestration layer over `paper-trading-service` +
 * `data-service` so the cron HTTP route stays a thin caller. The price
 * fetcher is injected so tests can drive the engine without hitting the
 * live market data sources.
 *
 * Side-effect contract:
 *   - paper_positions.last_price, last_price_at, unrealized_pnl, updated_at
 *   - paper_equity_curve row appended (date, equity, drawdown)
 *   - paper_runs.last_mtm_at touched
 *
 * NOT yet handled (intentional, Sprint 3+):
 *   - corporate actions (splits/dividends) — positions are pure qty × close
 *   - intra-day MTM — daily only, mirrors A-share retail expectation
 *   - currency conversion — Lucrum is single-market today
 *
 * @module lib/services/paper-engine
 */

import { db } from '@/lib/db';
import {
  paperRuns,
  paperPositions,
  paperTrades,
  paperEquityCurve,
} from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getKLineData } from '@/lib/data-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloseSnapshot {
  readonly symbol: string;
  readonly close: number;
  readonly asOf: Date;
}

/**
 * Inject point for tests + future PIT swap. Production callers wire the
 * default implementation that goes through data-service/getKLineData.
 */
export type CloseFetcher = (
  symbols: readonly string[],
) => Promise<ReadonlyMap<string, CloseSnapshot>>;

export interface MtmRunReport {
  readonly runId: number;
  readonly symbolsTouched: number;
  readonly equity: number;
  readonly cash: number;
  readonly drawdown: number;
  /** When a symbol has no close available, it's listed here and skipped. */
  readonly missingPriceSymbols: readonly string[];
}

export interface MtmSweepReport {
  readonly date: string; // YYYY-MM-DD
  readonly activeRuns: number;
  readonly succeeded: number;
  readonly skipped: number;
  readonly failed: number;
  readonly runs: readonly MtmRunReport[];
  readonly errors: readonly { runId: number; message: string }[];
}

// ---------------------------------------------------------------------------
// Production close fetcher — bulk via data-service.
// ---------------------------------------------------------------------------

/**
 * Default fetcher used by the cron route. Fetches the most recent 1d candle
 * per symbol and returns its close. Failures are silently dropped — the
 * caller is responsible for treating "missing close" as skip-not-throw.
 */
export const defaultCloseFetcher: CloseFetcher = async (symbols) => {
  const out = new Map<string, CloseSnapshot>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await getKLineData(symbol, '1d', 2);
        if (!res.success || !res.data || res.data.length === 0) return;
        // Last element is most recent; keep order safety in case sources
        // return ASC or DESC differently.
        const sorted = [...res.data].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
        const latest = sorted[sorted.length - 1];
        if (!latest || !Number.isFinite(latest.close) || latest.close <= 0) return;
        out.set(symbol, {
          symbol,
          close: latest.close,
          asOf: new Date(latest.time),
        });
      } catch {
        // swallow — surfaces as "missing" in the run report
      }
    }),
  );
  return out;
};

// ---------------------------------------------------------------------------
// Pure helpers — unit-testable without DB
// ---------------------------------------------------------------------------

/**
 * Compute cash balance from trade history.
 *   cash = initialCapital
 *        - sum(buys.qty * price + commission)
 *        + sum(sells.qty * price - commission)
 *
 * Slippage is already baked into the executed price by applyStrategySignal,
 * so we don't re-deduct it here.
 */
export function computeCash(
  initialCapital: number,
  trades: ReadonlyArray<{
    side: string;
    qty: number;
    price: number;
    commission: number | null;
  }>,
): number {
  let cash = initialCapital;
  for (const t of trades) {
    const notional = t.qty * t.price;
    const commission = t.commission ?? 0;
    if (t.side === 'buy') {
      cash -= notional + commission;
    } else if (t.side === 'sell') {
      cash += notional - commission;
    }
    // Any other side string is ignored — paper_trades.side is a varchar(4)
    // but our schema only writes 'buy'/'sell'.
  }
  return cash;
}

/**
 * For a set of positions + a price map, compute total mark-to-market equity
 * (positions value + cash). Missing prices fall back to avgCost so a single
 * data-service outage doesn't zero out the user's portfolio.
 */
export function computeEquity(
  cash: number,
  positions: ReadonlyArray<{
    symbol: string;
    qty: number;
    avgCost: number;
    lastPrice: number | null;
  }>,
  prices: ReadonlyMap<string, CloseSnapshot>,
): { equity: number; missing: string[] } {
  let value = 0;
  const missing: string[] = [];
  for (const p of positions) {
    const snap = prices.get(p.symbol);
    const price = snap?.close ?? p.lastPrice ?? p.avgCost;
    if (!snap) missing.push(p.symbol);
    value += p.qty * price;
  }
  return { equity: cash + value, missing };
}

/**
 * Drawdown = (peakEquity - currentEquity) / peakEquity. Clamped to ≥ 0 so a
 * new peak today shows 0% drawdown, never negative.
 */
export function computeDrawdown(currentEquity: number, peakEquity: number): number {
  if (!Number.isFinite(peakEquity) || peakEquity <= 0) return 0;
  const dd = (peakEquity - currentEquity) / peakEquity;
  return dd > 0 ? dd : 0;
}

// ---------------------------------------------------------------------------
// Core engine — `tickAllActiveRuns`
// ---------------------------------------------------------------------------

/**
 * MTM sweep entry point. Runs once per trading-day close.
 *
 * @param now           Injected clock — defaults to real now. Used so tests
 *                      can pin the equity-curve date.
 * @param fetchCloses   Injected price source. Defaults to the real
 *                      data-service-backed fetcher.
 */
export async function tickAllActiveRuns(
  options?: {
    now?: Date;
    fetchCloses?: CloseFetcher;
  },
): Promise<MtmSweepReport> {
  const now = options?.now ?? new Date();
  const fetcher = options?.fetchCloses ?? defaultCloseFetcher;
  const dateStr = formatYmd(now);

  const activeRuns = await db
    .select()
    .from(paperRuns)
    .where(eq(paperRuns.status, 'active'));

  if (activeRuns.length === 0) {
    return {
      date: dateStr,
      activeRuns: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      runs: [],
      errors: [],
    };
  }

  const runIds = activeRuns.map((r) => r.id);

  // Bulk-load positions across all active runs in one round trip.
  const allPositions = await db
    .select()
    .from(paperPositions)
    .where(inArray(paperPositions.runId, runIds));

  // Bulk-load trades so we can compute cash per run.
  const allTrades = await db
    .select({
      runId: paperTrades.runId,
      side: paperTrades.side,
      qty: paperTrades.qty,
      price: paperTrades.price,
      commission: paperTrades.commission,
    })
    .from(paperTrades)
    .where(inArray(paperTrades.runId, runIds));

  const tradesByRun = new Map<number, typeof allTrades>();
  for (const t of allTrades) {
    const list = tradesByRun.get(t.runId) ?? [];
    list.push(t);
    tradesByRun.set(t.runId, list);
  }

  const positionsByRun = new Map<number, typeof allPositions>();
  for (const p of allPositions) {
    const list = positionsByRun.get(p.runId) ?? [];
    list.push(p);
    positionsByRun.set(p.runId, list);
  }

  // Deduplicated symbol list — single fetch fans out to all runs.
  const symbols = Array.from(new Set(allPositions.map((p) => p.symbol)));
  const prices = symbols.length > 0 ? await fetcher(symbols) : new Map<string, CloseSnapshot>();

  // Bulk-load peak equity per run (max of historical paper_equity_curve).
  const peaksRaw = await db
    .select({
      runId: paperEquityCurve.runId,
      peak: sql<number>`MAX(${paperEquityCurve.equity})`,
    })
    .from(paperEquityCurve)
    .where(inArray(paperEquityCurve.runId, runIds))
    .groupBy(paperEquityCurve.runId);
  const peakByRun = new Map(peaksRaw.map((r) => [r.runId, Number(r.peak)]));

  const runReports: MtmRunReport[] = [];
  const errors: { runId: number; message: string }[] = [];
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const run of activeRuns) {
    try {
      const positions = positionsByRun.get(run.id) ?? [];
      const trades = tradesByRun.get(run.id) ?? [];

      if (positions.length === 0 && trades.length === 0) {
        // Brand new run with no seed + no trades. Equity == initialCapital,
        // no drawdown yet. We still write today's row to anchor the curve.
        const equity = run.initialCapital;
        await writeEquityRow(run.id, dateStr, equity, 0);
        await touchLastMtm(run.id, now);
        runReports.push({
          runId: run.id,
          symbolsTouched: 0,
          equity,
          cash: equity,
          drawdown: 0,
          missingPriceSymbols: [],
        });
        skipped++;
        continue;
      }

      const cash = computeCash(run.initialCapital, trades);
      const { equity, missing } = computeEquity(cash, positions, prices);
      const priorPeak = peakByRun.get(run.id) ?? run.initialCapital;
      const newPeak = Math.max(priorPeak, equity);
      const drawdown = computeDrawdown(equity, newPeak);

      // Update each position's last_price / unrealized_pnl when we have a fresh quote.
      for (const p of positions) {
        const snap = prices.get(p.symbol);
        if (!snap) continue;
        const unrealizedPnl = (snap.close - p.avgCost) * p.qty;
        await db
          .update(paperPositions)
          .set({
            lastPrice: snap.close,
            lastPriceAt: snap.asOf,
            unrealizedPnl,
            updatedAt: now,
          })
          .where(
            and(
              eq(paperPositions.runId, run.id),
              eq(paperPositions.symbol, p.symbol),
            ),
          );
      }

      await writeEquityRow(run.id, dateStr, equity, drawdown);
      await touchLastMtm(run.id, now);

      runReports.push({
        runId: run.id,
        symbolsTouched: positions.length - missing.length,
        equity,
        cash,
        drawdown,
        missingPriceSymbols: missing,
      });
      succeeded++;
    } catch (err) {
      failed++;
      errors.push({
        runId: run.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    date: dateStr,
    activeRuns: activeRuns.length,
    succeeded,
    skipped,
    failed,
    runs: runReports,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal — DB writes isolated so test fixtures only need to stub these
// ---------------------------------------------------------------------------

async function writeEquityRow(
  runId: number,
  dateStr: string,
  equity: number,
  drawdown: number,
): Promise<void> {
  // INSERT ... ON CONFLICT (run_id, date) DO UPDATE — daily idempotent.
  await db
    .insert(paperEquityCurve)
    .values({
      runId,
      date: dateStr,
      equity,
      drawdown,
    })
    .onConflictDoUpdate({
      target: [paperEquityCurve.runId, paperEquityCurve.date],
      set: { equity, drawdown },
    });
}

async function touchLastMtm(runId: number, now: Date): Promise<void> {
  await db
    .update(paperRuns)
    .set({ lastMtmAt: now })
    .where(eq(paperRuns.id, runId));
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
