/**
 * Pack run forward-return tracker (alpha-decay).
 *
 * For a completed pack run, computes the equal-weight forward return of its
 * top-N candidates across one or more trading-day horizons, using kline_daily
 * as the price source. Results are upserted into pack_run_performance so the
 * monitoring drill-down can display cached figures on re-open.
 *
 * Design:
 *   - Owner-scoped: all reads/writes validate that the run belongs to userId
 *     before touching price data (defense against runId enumeration).
 *   - Idempotent: unique (run_id, horizon_days, top_n) — recompute updates in
 *     place via ON CONFLICT DO UPDATE.
 *   - Trading-day semantics: kline_daily contains only trading days, so
 *     horizon H = the H-th row after the anchor (row_number offset H).
 *   - Equal-weight, long-only: forward_return = close(T+H)/close(T) - 1, then
 *     arithmetic mean across candidates with both endpoints present.
 *   - Adjusted prices: close × adj_factor handles splits/dividends so a 1-for-2
 *     split day doesn't appear as -50%.
 *   - Survivorship: filter stocks.status = 'active' so already-delisted symbols
 *     don't poison the basket with stale endpoints.
 *   - Benchmark-relative: CSI 300 (symbol 000300, ingested as a pseudo-stock)
 *     is fetched in parallel; excess_mean_return = mean - benchmark_return.
 *     If the benchmark is not in kline_daily, those columns degrade to NULL
 *     and the UI shows a dash, never a misleading absolute number labelled
 *     "alpha".
 *
 * @module lib/strategy-packs/pack-run-performance
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { packRunPerformance, packRuns } from '@/lib/db/schema';

const DEFAULT_HORIZONS: ReadonlyArray<number> = [1, 5, 20];
const DEFAULT_TOP_N = 10;
const MAX_HORIZON_DAYS = 120;
const MAX_TOP_N = 50;
const MAX_HORIZONS_PER_REQUEST = 6;

// CSI 300 — ingested into kline_daily as a pseudo-stock (symbol = '000300').
// Single benchmark per platform for now; revisit if/when sector funds (CSI500,
// CNI Wind All A) are added. Override via env so we can test alternates without
// touching code.
const BENCHMARK_SYMBOL = process.env.PACK_RUN_BENCHMARK_SYMBOL ?? '000300';

export interface ComputePerformanceInput {
  readonly horizons?: ReadonlyArray<number>;
  readonly topN?: number;
}

export interface PackRunPerformanceRow {
  readonly horizonDays: number;
  readonly topN: number;
  readonly requestedCount: number;
  readonly evaluatedCount: number;
  readonly missingCount: number;
  readonly meanReturn: number | null;
  readonly medianReturn: number | null;
  readonly hitRate: number | null;
  readonly bestReturn: number | null;
  readonly worstReturn: number | null;
  readonly benchmarkSymbol: string | null;
  readonly benchmarkReturn: number | null;
  readonly excessMeanReturn: number | null;
  readonly computedAt: string;
}

interface UpsertPayload {
  readonly runId: string;
  readonly horizonDays: number;
  readonly topN: number;
  readonly requestedCount: number;
  readonly evaluatedCount: number;
  readonly missingCount: number;
  readonly meanReturn: number | null;
  readonly medianReturn: number | null;
  readonly hitRate: number | null;
  readonly bestReturn: number | null;
  readonly worstReturn: number | null;
  readonly benchmarkSymbol: string | null;
  readonly benchmarkReturn: number | null;
  readonly excessMeanReturn: number | null;
}

type PriceRow = {
  symbol: string;
  day_offset: string | number;
  close: string | number;
};

type BenchmarkRow = {
  day_offset: string | number;
  close: string | number;
};

function sanitizeHorizons(raw: ReadonlyArray<number> | undefined): number[] {
  const src =
    raw && raw.length > 0 ? raw : (DEFAULT_HORIZONS as ReadonlyArray<number>);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const h of src) {
    const n = Math.round(Number(h));
    if (!Number.isFinite(n)) continue;
    if (n < 1 || n > MAX_HORIZON_DAYS) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_HORIZONS_PER_REQUEST) break;
  }
  if (out.length === 0) return [...DEFAULT_HORIZONS];
  return out;
}

function sanitizeTopN(raw: number | undefined): number {
  if (raw === undefined || raw === null) return DEFAULT_TOP_N;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_TOP_N;
  if (n < 1) return 1;
  if (n > MAX_TOP_N) return MAX_TOP_N;
  return n;
}

function unwrapRows<T>(raw: unknown): T[] {
  const wrap = raw as { rows?: T[] } | T[];
  if (Array.isArray(wrap)) return wrap;
  return wrap.rows ?? [];
}

function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}

function extractSymbols(topCandidates: unknown, topN: number): string[] {
  if (!Array.isArray(topCandidates)) return [];
  const out: string[] = [];
  for (const c of topCandidates) {
    if (out.length >= topN) break;
    if (c && typeof c === 'object' && 'symbol' in c) {
      const sym = (c as { symbol: unknown }).symbol;
      if (typeof sym === 'string' && sym.length > 0) out.push(sym);
    }
  }
  return out;
}

interface RunHeader {
  readonly asOfDate: string;
  readonly topCandidates: unknown;
}

async function loadOwnedRunHeader(
  userId: string,
  runId: string,
): Promise<RunHeader | null> {
  const rows = await db
    .select({
      asOfDate: packRuns.asOfDate,
      topCandidates: packRuns.topCandidates,
    })
    .from(packRuns)
    .where(and(eq(packRuns.runId, runId), eq(packRuns.userId, userId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;
  return { asOfDate: row.asOfDate, topCandidates: row.topCandidates };
}

/**
 * Single batched query: for the given symbols, return their adjusted close
 * price on the anchor day (first kline_daily row with date >= asOfDate) and
 * on each horizon offset. Already-delisted symbols are dropped via
 * stocks.status filter so they don't poison the basket.
 *
 * Halt days do NOT need explicit exclusion: kline_daily only ingests rows on
 * trading days (daily-updater skips when EastMoney returns no kline), so
 * row_number() naturally counts trading days for that symbol.
 */
async function fetchPriceGrid(
  symbols: ReadonlyArray<string>,
  asOfDate: string,
  horizons: ReadonlyArray<number>,
): Promise<Map<string, Map<number, number>>> {
  if (symbols.length === 0) return new Map();
  const offsets = [0, ...horizons];
  const maxOffset = offsets.reduce((m, n) => Math.max(m, n), 0);

  const raw = await db.execute<PriceRow>(sql`
    WITH ranked AS (
      SELECT
        s.symbol,
        k.close * COALESCE(k.adj_factor, 1.0) AS close,
        ROW_NUMBER() OVER (PARTITION BY k.stock_id ORDER BY k.date ASC) - 1 AS day_offset
      FROM kline_daily k
      INNER JOIN stocks s ON s.id = k.stock_id
      WHERE s.symbol = ANY(${sql.raw(`ARRAY[${symbols.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`)})
        AND s.status = 'active'
        AND k.date >= ${asOfDate}
    )
    SELECT symbol, day_offset, close
    FROM ranked
    WHERE day_offset <= ${maxOffset}
      AND day_offset = ANY(${sql.raw(`ARRAY[${offsets.join(',')}]::int[]`)})
  `);

  const grid = new Map<string, Map<number, number>>();
  for (const row of unwrapRows<PriceRow>(raw)) {
    const sym = row.symbol;
    const off = Number(row.day_offset);
    const close = Number(row.close);
    if (!Number.isFinite(off) || !Number.isFinite(close)) continue;
    let inner = grid.get(sym);
    if (!inner) {
      inner = new Map();
      grid.set(sym, inner);
    }
    inner.set(off, close);
  }
  return grid;
}

/**
 * Fetch the benchmark price series at the anchor + each horizon. Bypasses
 * the stocks.status='active' filter (an index is neither active nor
 * delisted) but still applies adj_factor in case a future split adjustment
 * is recorded.
 *
 * Returns an empty map if the benchmark hasn't been ingested yet — callers
 * MUST treat this as "no benchmark data" and return null excess return,
 * never zero (which would imply +5% absolute = +5% alpha, a lie).
 */
async function fetchBenchmarkSeries(
  asOfDate: string,
  horizons: ReadonlyArray<number>,
): Promise<Map<number, number>> {
  const offsets = [0, ...horizons];
  const maxOffset = offsets.reduce((m, n) => Math.max(m, n), 0);

  const raw = await db.execute<BenchmarkRow>(sql`
    WITH ranked AS (
      SELECT
        k.close * COALESCE(k.adj_factor, 1.0) AS close,
        ROW_NUMBER() OVER (PARTITION BY k.stock_id ORDER BY k.date ASC) - 1 AS day_offset
      FROM kline_daily k
      INNER JOIN stocks s ON s.id = k.stock_id
      WHERE s.symbol = ${BENCHMARK_SYMBOL}
        AND k.date >= ${asOfDate}
    )
    SELECT day_offset, close
    FROM ranked
    WHERE day_offset <= ${maxOffset}
      AND day_offset = ANY(${sql.raw(`ARRAY[${offsets.join(',')}]::int[]`)})
  `);

  const series = new Map<number, number>();
  for (const row of unwrapRows<BenchmarkRow>(raw)) {
    const off = Number(row.day_offset);
    const close = Number(row.close);
    if (Number.isFinite(off) && Number.isFinite(close)) series.set(off, close);
  }
  return series;
}

function aggregateReturns(returns: ReadonlyArray<number>): {
  mean: number | null;
  med: number | null;
  hit: number | null;
  best: number | null;
  worst: number | null;
} {
  if (returns.length === 0) {
    return { mean: null, med: null, hit: null, best: null, worst: null };
  }
  let sum = 0;
  let hitCount = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (const r of returns) {
    sum += r;
    if (r > 0) hitCount += 1;
    if (r > best) best = r;
    if (r < worst) worst = r;
  }
  return {
    mean: sum / returns.length,
    med: median(returns),
    hit: hitCount / returns.length,
    best: Number.isFinite(best) ? best : null,
    worst: Number.isFinite(worst) ? worst : null,
  };
}

function computeBenchmarkReturn(
  series: Map<number, number>,
  horizon: number,
): number | null {
  const anchor = series.get(0);
  const future = series.get(horizon);
  if (
    anchor === undefined ||
    future === undefined ||
    !Number.isFinite(anchor) ||
    !Number.isFinite(future) ||
    anchor <= 0
  ) {
    return null;
  }
  return future / anchor - 1;
}

/**
 * Compute and upsert forward-return rollups for a run. Owner-scoped.
 * Returns the upserted rows sorted by horizonDays ASC.
 */
export async function computePackRunPerformance(
  userId: string,
  runId: string,
  input: ComputePerformanceInput = {},
): Promise<ReadonlyArray<PackRunPerformanceRow>> {
  const header = await loadOwnedRunHeader(userId, runId);
  if (!header) return [];

  const horizons = sanitizeHorizons(input.horizons);
  const topN = sanitizeTopN(input.topN);
  const symbols = extractSymbols(header.topCandidates, topN);
  const requestedCount = symbols.length;

  // Benchmark fetched in parallel with basket — both queries hit kline_daily
  // and are bounded by a small offset list, so this is cheap.
  const [grid, bench] = await Promise.all([
    fetchPriceGrid(symbols, header.asOfDate, horizons),
    fetchBenchmarkSeries(header.asOfDate, horizons),
  ]);

  if (requestedCount === 0) {
    // Nothing to compute; still upsert zero-count rows so the UI can render
    // "no candidates" instead of an empty pane indefinitely.
    const rows: UpsertPayload[] = horizons.map((h) => {
      const benchReturn = computeBenchmarkReturn(bench, h);
      return {
        runId,
        horizonDays: h,
        topN,
        requestedCount: 0,
        evaluatedCount: 0,
        missingCount: 0,
        meanReturn: null,
        medianReturn: null,
        hitRate: null,
        bestReturn: null,
        worstReturn: null,
        benchmarkSymbol: benchReturn !== null ? BENCHMARK_SYMBOL : null,
        benchmarkReturn: benchReturn,
        excessMeanReturn: null,
      };
    });
    await upsertRows(rows);
    return (await getPackRunPerformance(userId, runId)).filter(
      (r) => r.topN === topN && horizons.includes(r.horizonDays),
    );
  }

  const outputs: UpsertPayload[] = [];

  for (const h of horizons) {
    const returns: number[] = [];
    let missing = 0;
    for (const sym of symbols) {
      const prices = grid.get(sym);
      const anchor = prices?.get(0);
      const future = prices?.get(h);
      if (
        anchor === undefined ||
        future === undefined ||
        !Number.isFinite(anchor) ||
        !Number.isFinite(future) ||
        anchor <= 0
      ) {
        missing += 1;
        continue;
      }
      returns.push(future / anchor - 1);
    }
    const { mean, med, hit, best, worst } = aggregateReturns(returns);
    const benchReturn = computeBenchmarkReturn(bench, h);
    const excessMean =
      mean !== null && benchReturn !== null ? mean - benchReturn : null;
    outputs.push({
      runId,
      horizonDays: h,
      topN,
      requestedCount,
      evaluatedCount: returns.length,
      missingCount: missing,
      meanReturn: mean,
      medianReturn: med,
      hitRate: hit,
      bestReturn: best,
      worstReturn: worst,
      benchmarkSymbol: benchReturn !== null ? BENCHMARK_SYMBOL : null,
      benchmarkReturn: benchReturn,
      excessMeanReturn: excessMean,
    });
  }

  await upsertRows(outputs);

  const all = await getPackRunPerformance(userId, runId);
  return all.filter(
    (r) => r.topN === topN && horizons.includes(r.horizonDays),
  );
}

async function upsertRows(rows: ReadonlyArray<UpsertPayload>): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(packRunPerformance)
    .values(rows.map((r) => ({ ...r, computedAt: new Date() })))
    .onConflictDoUpdate({
      target: [
        packRunPerformance.runId,
        packRunPerformance.horizonDays,
        packRunPerformance.topN,
      ],
      set: {
        requestedCount: sql`excluded.requested_count`,
        evaluatedCount: sql`excluded.evaluated_count`,
        missingCount: sql`excluded.missing_count`,
        meanReturn: sql`excluded.mean_return`,
        medianReturn: sql`excluded.median_return`,
        hitRate: sql`excluded.hit_rate`,
        bestReturn: sql`excluded.best_return`,
        worstReturn: sql`excluded.worst_return`,
        benchmarkSymbol: sql`excluded.benchmark_symbol`,
        benchmarkReturn: sql`excluded.benchmark_return`,
        excessMeanReturn: sql`excluded.excess_mean_return`,
        computedAt: sql`excluded.computed_at`,
      },
    });
}

/**
 * Read cached performance rows for a run. Owner-scoped. Returns empty array
 * if the run is not owned by userId.
 */
export async function getPackRunPerformance(
  userId: string,
  runId: string,
): Promise<ReadonlyArray<PackRunPerformanceRow>> {
  const header = await loadOwnedRunHeader(userId, runId);
  if (!header) return [];

  const rows = await db
    .select({
      horizonDays: packRunPerformance.horizonDays,
      topN: packRunPerformance.topN,
      requestedCount: packRunPerformance.requestedCount,
      evaluatedCount: packRunPerformance.evaluatedCount,
      missingCount: packRunPerformance.missingCount,
      meanReturn: packRunPerformance.meanReturn,
      medianReturn: packRunPerformance.medianReturn,
      hitRate: packRunPerformance.hitRate,
      bestReturn: packRunPerformance.bestReturn,
      worstReturn: packRunPerformance.worstReturn,
      benchmarkSymbol: packRunPerformance.benchmarkSymbol,
      benchmarkReturn: packRunPerformance.benchmarkReturn,
      excessMeanReturn: packRunPerformance.excessMeanReturn,
      computedAt: packRunPerformance.computedAt,
    })
    .from(packRunPerformance)
    .where(eq(packRunPerformance.runId, runId))
    .orderBy(packRunPerformance.horizonDays, packRunPerformance.topN);

  return rows.map((r) => ({
    horizonDays: r.horizonDays,
    topN: r.topN,
    requestedCount: r.requestedCount,
    evaluatedCount: r.evaluatedCount,
    missingCount: r.missingCount,
    meanReturn: r.meanReturn,
    medianReturn: r.medianReturn,
    hitRate: r.hitRate,
    bestReturn: r.bestReturn,
    worstReturn: r.worstReturn,
    benchmarkSymbol: r.benchmarkSymbol,
    benchmarkReturn: r.benchmarkReturn,
    excessMeanReturn: r.excessMeanReturn,
    computedAt: r.computedAt.toISOString(),
  }));
}
