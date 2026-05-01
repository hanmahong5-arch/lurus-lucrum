#!/usr/bin/env bun
/**
 * ingest-curated.ts — Pull daily K-lines for the curated demo universe
 * (~50 household-name A-shares from `curated-symbols.ts`) so a new user
 * landing on `/dashboard` has real stocks to backtest against.
 *
 * Why curated, not full A-share: the goal is the "magic moment" (NL →
 * strategy → backtest → result < 5s). 50 stocks × 3 years × ~250 days =
 * ~37k rows, finishes in a few minutes vs hours for the full ~5000.
 * Full ingest is `plans/data-ingest-pipeline.md`, gated on a separate
 * decision (sector membership history → see Open Q #6 in that plan).
 *
 * Mirrors `ingest-csi300.ts` patterns: pg-only (drizzle isn't bundled in
 * the production standalone build), idempotent upserts, runs in-pod via
 * the stdin-piped wrapper. Adds:
 *   - bounded concurrency (default 3) to stay under EastMoney's 429 floor
 *   - inter-batch jitter so a fleet of clients can't lock-step
 *   - per-symbol error isolation: one stock failing doesn't kill the run
 *   - skip-on-success: re-running only refetches stocks whose latest
 *     kline_daily date is older than today
 *
 * Idempotent: safe to re-run. ON CONFLICT DO UPDATE on both stocks and
 * kline_daily. Re-runs are also smart — see `shouldRefresh()`.
 *
 * Usage (in-pod via wrapper):
 *   ./scripts/ingest-curated.sh
 *
 * Usage (locally, with DATABASE_URL pointing at the cluster DB):
 *   YEARS=3 CONCURRENCY=3 DATABASE_URL=postgresql://... bun run scripts/ingest-curated.ts
 */

import { Pool } from 'pg';
import { CURATED_SYMBOLS, type CuratedSymbol } from './curated-symbols';

interface KLineRow {
  readonly date: string;       // YYYY-MM-DD
  readonly open: number;
  readonly close: number;
  readonly high: number;
  readonly low: number;
  readonly volume: number;
  readonly amount: number;
}

interface EastMoneyResponse {
  readonly data?: {
    readonly code?: string;
    readonly name?: string;
    readonly klines?: ReadonlyArray<string>;
  };
}

interface IngestResult {
  readonly symbol: string;
  readonly stockId: number | null;
  readonly fetched: number;
  readonly written: number;
  readonly skipped: boolean;
  readonly error: string | null;
}

const EASTMONEY_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; lucrum-ingest/1.0)',
  Referer: 'https://quote.eastmoney.com/',
};

const YEARS = Number.parseInt(process.env.YEARS ?? '3', 10);
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY ?? '3', 10);
const BATCH_SIZE = 500;
const JITTER_MS = 350;
// `today` in UTC — slightly conservative for CN time, but kline_daily entries
// use the trading calendar date so a one-day skew at the boundary is fine.
const TODAY_YMD = new Date().toISOString().slice(0, 10);

function ymd(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

async function jitter(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.random() * JITTER_MS));
}

/**
 * Skip a symbol if our DB already has its latest kline for "today" (or
 * the most recent trading day). Prevents needlessly hammering EastMoney
 * on re-runs. Returns false if the row is missing or stale.
 */
async function shouldRefresh(pool: Pool, symbol: string): Promise<{ refresh: boolean; stockId: number | null }> {
  // kline_daily.date is stored as TEXT in 'YYYY-MM-DD' format, so plain
  // max() returns a sortable string — no need for to_char (which would
  // error: function to_char(text, unknown) does not exist).
  const r = await pool.query<{ id: number; max_date: string | null }>(
    `SELECT s.id,
            (SELECT max(date)
               FROM kline_daily k WHERE k.stock_id = s.id) AS max_date
       FROM stocks s WHERE s.symbol = $1`,
    [symbol],
  );
  const row = r.rows[0];
  if (!row) return { refresh: true, stockId: null };
  if (!row.max_date) return { refresh: true, stockId: row.id };
  // If the latest kline is older than today, refresh. (Equal is "we already
  // have today's bar" → skip.)
  return { refresh: row.max_date < TODAY_YMD, stockId: row.id };
}

async function fetchKLines(secid: string, years: number): Promise<KLineRow[]> {
  const end = new Date();
  const beg = new Date(end);
  beg.setUTCFullYear(beg.getUTCFullYear() - years);

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101', // daily
    fqt: '1', // forward-adjusted
    beg: ymd(beg),
    end: ymd(end),
    lmt: '10000',
    _: Date.now().toString(),
  });

  const url = `${EASTMONEY_URL}?${params.toString()}`;
  const res = await fetch(url, { headers: HTTP_HEADERS });
  if (!res.ok) {
    throw new Error(`EastMoney HTTP ${res.status}`);
  }
  const json = (await res.json()) as EastMoneyResponse;
  const lines = json.data?.klines ?? [];

  const rows: KLineRow[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 7) continue;
    const date = parts[0]!;
    const open = Number.parseFloat(parts[1]!);
    const close = Number.parseFloat(parts[2]!);
    const high = Number.parseFloat(parts[3]!);
    const low = Number.parseFloat(parts[4]!);
    const volume = Number.parseFloat(parts[5]!);
    const amount = Number.parseFloat(parts[6]!);
    if (!date || !Number.isFinite(open) || open <= 0) continue;
    rows.push({ date, open, close, high, low, volume, amount });
  }
  return rows;
}

async function upsertStock(pool: Pool, sym: CuratedSymbol): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO stocks (symbol, name, exchange, status, listing_date, is_st)
     VALUES ($1, $2, $3, 'active', '2000-01-01', false)
     ON CONFLICT (symbol) DO UPDATE
        SET name = EXCLUDED.name,
            exchange = EXCLUDED.exchange,
            status = 'active',
            updated_at = NOW()
     RETURNING id`,
    [sym.symbol, sym.name, sym.market],
  );
  const id = r.rows[0]?.id;
  if (typeof id !== 'number') throw new Error(`upsert stocks did not return id for ${sym.symbol}`);
  return id;
}

async function upsertKLines(pool: Pool, stockId: number, klines: KLineRow[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < klines.length; i += BATCH_SIZE) {
    const batch = klines.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];
    let pIdx = 1;
    for (const k of batch) {
      placeholders.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 1.0)`,
      );
      values.push(stockId, k.date, k.open, k.high, k.low, k.close, k.volume, k.amount);
    }
    const sql = `
      INSERT INTO kline_daily
        (stock_id, date, open, high, low, close, volume, amount, adj_factor)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (stock_id, date) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        amount = EXCLUDED.amount
    `;
    const r = await pool.query(sql, values);
    written += r.rowCount ?? batch.length;
  }
  return written;
}

async function ingestOne(pool: Pool, sym: CuratedSymbol): Promise<IngestResult> {
  try {
    const { refresh, stockId: existingId } = await shouldRefresh(pool, sym.symbol);
    if (!refresh && existingId !== null) {
      return { symbol: sym.symbol, stockId: existingId, fetched: 0, written: 0, skipped: true, error: null };
    }

    await jitter();
    const klines = await fetchKLines(sym.secid, YEARS);
    if (klines.length === 0) {
      return {
        symbol: sym.symbol,
        stockId: existingId,
        fetched: 0,
        written: 0,
        skipped: false,
        error: 'EastMoney returned no klines (suspended? secid wrong?)',
      };
    }

    const stockId = await upsertStock(pool, sym);
    const written = await upsertKLines(pool, stockId, klines);
    return { symbol: sym.symbol, stockId, fetched: klines.length, written, skipped: false, error: null };
  } catch (err) {
    return {
      symbol: sym.symbol,
      stockId: null,
      fetched: 0,
      written: 0,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Concurrency-bounded runner. Same pattern as scanner-agent.runWithConcurrency.
 */
async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
  onComplete?: (idx: number, result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      const item = items[idx]!;
      const r = await fn(item, idx);
      results[idx] = r;
      onComplete?.(idx, r);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(2);
  }
  if (!Number.isFinite(YEARS) || YEARS <= 0 || YEARS > 25) {
    console.error(`YEARS env must be 1..25, got '${process.env.YEARS}'`);
    process.exit(2);
  }
  if (!Number.isFinite(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 10) {
    console.error(`CONCURRENCY env must be 1..10, got '${process.env.CONCURRENCY}'`);
    process.exit(2);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Math.max(4, CONCURRENCY + 1),
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  });

  console.log(`[ingest-curated] universe=${CURATED_SYMBOLS.length} years=${YEARS} concurrency=${CONCURRENCY}`);

  const start = Date.now();
  try {
    const results = await runWithConcurrency(
      CURATED_SYMBOLS,
      CONCURRENCY,
      (sym) => ingestOne(pool, sym),
      (idx, r) => {
        const sym = CURATED_SYMBOLS[idx]!;
        const status =
          r.error ? '❌' :
          r.skipped ? '⏭️ ' :
          '✅';
        console.log(
          `[${idx + 1}/${CURATED_SYMBOLS.length}] ${status} ${sym.symbol} ${sym.name.padEnd(8)} ` +
            (r.error
              ? `error=${r.error}`
              : r.skipped
                ? 'already current'
                : `wrote ${r.written} rows (id=${r.stockId})`),
        );
      },
    );

    const ok = results.filter((r) => !r.error && !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    const failed = results.filter((r) => r.error !== null);
    const totalRows = ok.reduce((s, r) => s + r.written, 0);

    // Final DB state for sanity.
    const verify = await pool.query<{ stocks: string; klines: string }>(
      `SELECT (SELECT count(*)::text FROM stocks) AS stocks,
              (SELECT count(*)::text FROM kline_daily) AS klines`,
    );

    console.log('=== ingest-curated summary ===');
    console.log(JSON.stringify(
      {
        durationSec: Math.round((Date.now() - start) / 1000),
        universe: CURATED_SYMBOLS.length,
        succeeded: ok.length,
        skipped: skipped.length,
        failed: failed.length,
        rowsWritten: totalRows,
        dbStocksCount: verify.rows[0]?.stocks,
        dbKlinesCount: verify.rows[0]?.klines,
        failures: failed.map((r) => ({ symbol: r.symbol, error: r.error })),
      },
      null,
      2,
    ));

    // Non-zero exit if more than 20% failed — partial success below this
    // is normal (1-2 stocks may be suspended/halted), but a quarter+ failing
    // means EastMoney is rate-limiting us or the secid format changed.
    if (failed.length > Math.ceil(CURATED_SYMBOLS.length * 0.2)) {
      console.error(`[ingest-curated] failure rate ${failed.length}/${CURATED_SYMBOLS.length} exceeds 20% threshold`);
      process.exit(3);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('[ingest-curated] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
