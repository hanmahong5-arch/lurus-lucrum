#!/usr/bin/env bun
/**
 * bulk-backfill-klines.ts — Fetch 5 years of daily OHLCV for every active
 * stock in the `stocks` table and upsert into `kline_daily`. This is the
 * heavy-weight one-time backfill; thereafter the existing 18:00 CST
 * incremental cron in lib/cron/daily-updater.ts keeps the data fresh.
 *
 * Step 2 of the A-share ingest pipeline. Runs AFTER bootstrap-stock-list.
 *
 * Why a dedicated script (not lib/cron/incremental-updater.ts):
 *   incremental-updater.ts uses drizzle (not in pod runtime) and assumes
 *   a small missing-window. This is plain pg + handles 5y per stock with
 *   resumable per-stock progress + concrete data_update_log rows.
 *
 * Resumable: a stock is skipped if it already has >= MIN_RESUME_ROWS
 * rows AND its earliest date is <= 5y ago. To force a full re-fetch,
 * either set FORCE=1 or DELETE FROM kline_daily WHERE stock_id=...
 *
 * Concurrency: CONCURRENCY parallel stocks at a time, BATCH_DELAY_MS
 * between waves. Default keeps EastMoney happy (~5 req/s sustained).
 *
 * Capacity (5y backfill, ~5000 stocks):
 *   - rows ≈ 5000 × 1215 ≈ 6.075M
 *   - PG storage ≈ 800 MB (kline_daily row ≈ 130b + index)
 *   - runtime ≈ 5000 / 8 conc × 0.5s/req + 5000/100 × 1s wave = ~5–8 min
 *     under ideal conditions; budget 30 min for retries / throttling.
 *
 * Usage (locally):
 *   DATABASE_URL=postgresql://... bun run scripts/bulk-backfill-klines.ts
 *   YEARS=5 LIMIT=10 bun run scripts/bulk-backfill-klines.ts   # smoke
 *   FORCE=1 SYMBOLS=600519,000858 bun run scripts/bulk-backfill-klines.ts
 *
 * Usage (prod):
 *   ./scripts/bulk-backfill-klines.sh
 */

import { Pool } from 'pg';

interface StockMeta {
  readonly id: number;
  readonly symbol: string;
  readonly exchange: string | null;
}

interface KLineRow {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly amount: number;
}

interface EastMoneyResponse {
  readonly data?: {
    readonly klines?: ReadonlyArray<string>;
  };
}

const EASTMONEY_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; lucrum-backfill/1.0)',
  'Referer': 'https://quote.eastmoney.com/',
};

const YEARS = Number.parseInt(process.env.YEARS ?? '5', 10);
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY ?? '8', 10);
const BATCH_DELAY_MS = Number.parseInt(process.env.BATCH_DELAY_MS ?? '500', 10);
const MAX_RETRIES = Number.parseInt(process.env.MAX_RETRIES ?? '3', 10);
const UPSERT_BATCH_SIZE = 500;

// Resume threshold: a stock with >= 200 rows AND earliest date <= 5y ago
// is considered "good enough" — likely a recent run that succeeded. Set
// FORCE=1 to bypass.
const MIN_RESUME_ROWS = 200;
const FORCE = process.env.FORCE === '1';

// LIMIT: cap how many stocks to process this run. Useful for smoke tests
// (LIMIT=10) and for pacing across multiple shorter sessions if needed.
const LIMIT = process.env.LIMIT ? Number.parseInt(process.env.LIMIT, 10) : 0;

// SYMBOLS: comma-separated whitelist for targeted re-runs.
const SYMBOL_WHITELIST = (process.env.SYMBOLS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

function ymd(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function secid(symbol: string, exchange: string | null): string {
  // EastMoney prefix: 1.=SH, 0.=SZ. We don't know BJ here; default to 0.
  const prefix = exchange === 'SH' ? '1' : '0';
  return `${prefix}.${symbol}`;
}

async function fetchKLines(
  symbol: string,
  exchange: string | null,
  beg: string,
  end: string,
): Promise<KLineRow[] | null> {
  const params = new URLSearchParams({
    secid: secid(symbol, exchange),
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    beg,
    end,
    lmt: '10000',
    _: Date.now().toString(),
  });

  const url = `${EASTMONEY_URL}?${params.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: HTTP_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as EastMoneyResponse;
      const lines = json.data?.klines ?? [];
      // EastMoney returns empty klines for delisted/suspended/never-traded —
      // treat as success-with-no-data so we don't retry forever.
      if (lines.length === 0) return [];

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
        rows.push({ date, open, high, low, close, volume, amount });
      }
      return rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES) {
        console.error(`[backfill] ${symbol}: giving up after ${attempt} attempts (${msg})`);
        return null;
      }
      await delay(Math.pow(2, attempt - 1) * 1000);
    }
  }
  return null;
}

async function upsertKLines(
  pool: Pool,
  stockId: number,
  klines: KLineRow[],
): Promise<number> {
  let written = 0;
  for (let i = 0; i < klines.length; i += UPSERT_BATCH_SIZE) {
    const batch = klines.slice(i, i + UPSERT_BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    for (const k of batch) {
      placeholders.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 1.0)`,
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

interface PerStockResult {
  readonly symbol: string;
  readonly status: 'written' | 'skipped' | 'empty' | 'failed';
  readonly fetched: number;
  readonly written: number;
}

async function processStock(
  pool: Pool,
  meta: StockMeta,
  begDate: string,
  endDate: string,
): Promise<PerStockResult> {
  // Skip-if-fresh check (resume support).
  if (!FORCE) {
    const r = await pool.query<{ count: string; min_date: string | null }>(
      `SELECT count(*)::text AS count, min(date) AS min_date
         FROM kline_daily WHERE stock_id = $1`,
      [meta.id],
    );
    const row = r.rows[0];
    const count = row ? Number.parseInt(row.count, 10) : 0;
    const minDate = row?.min_date ?? null;
    if (count >= MIN_RESUME_ROWS && minDate !== null && minDate <= isoFromYmd(begDate)) {
      return { symbol: meta.symbol, status: 'skipped', fetched: 0, written: 0 };
    }
  }

  const klines = await fetchKLines(meta.symbol, meta.exchange, begDate, endDate);
  if (klines === null) {
    return { symbol: meta.symbol, status: 'failed', fetched: 0, written: 0 };
  }
  if (klines.length === 0) {
    return { symbol: meta.symbol, status: 'empty', fetched: 0, written: 0 };
  }
  const written = await upsertKLines(pool, meta.id, klines);
  return { symbol: meta.symbol, status: 'written', fetched: klines.length, written };
}

function isoFromYmd(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(2);
  }
  if (!Number.isFinite(YEARS) || YEARS <= 0 || YEARS > 25) {
    console.error(`YEARS must be 1..25, got '${process.env.YEARS}'`);
    process.exit(2);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  });

  const startMs = Date.now();
  let logId: number | null = null;

  try {
    // Compute backfill window once.
    const end = new Date();
    const beg = new Date(end);
    beg.setUTCFullYear(beg.getUTCFullYear() - YEARS);
    const begYmd = ymd(beg);
    const endYmd = ymd(end);
    const updateDate = `${end.getUTCFullYear()}-${(end.getUTCMonth() + 1).toString().padStart(2, '0')}-${end.getUTCDate().toString().padStart(2, '0')}`;

    // Fetch target stocks. Excludes the CSI300 pseudo-stock (000300) since
    // it's an index, not a tradable A-share — kline data is owned by
    // ingest-csi300.ts and refetching here would burn quota for nothing.
    const stockQuery = SYMBOL_WHITELIST.length > 0
      ? `SELECT id, symbol, exchange FROM stocks
         WHERE symbol = ANY($1::text[]) AND status = 'active'
         ORDER BY symbol`
      : `SELECT id, symbol, exchange FROM stocks
         WHERE status = 'active' AND symbol <> '000300'
         ORDER BY symbol`;
    const stockArgs = SYMBOL_WHITELIST.length > 0 ? [SYMBOL_WHITELIST] : [];
    const stocksRes = await pool.query<StockMeta>(stockQuery, stockArgs);
    let targets = stocksRes.rows;
    if (LIMIT > 0) targets = targets.slice(0, LIMIT);

    console.log(`[backfill] window: ${begYmd} → ${endYmd} (${YEARS}y)`);
    console.log(`[backfill] targets: ${targets.length} stocks (concurrency=${CONCURRENCY})`);
    if (targets.length === 0) {
      console.log('[backfill] nothing to do — was bootstrap-stock-list.ts run?');
      return;
    }

    // Open a data_update_log row for this run. Best-effort: failure here
    // is non-fatal because the actual data writes are independent.
    try {
      const logRes = await pool.query<{ id: number }>(
        `INSERT INTO data_update_log
           (update_date, update_type, start_time, status)
         VALUES ($1, 'full', NOW(), 'running')
         RETURNING id`,
        [updateDate],
      );
      logId = logRes.rows[0]?.id ?? null;
    } catch (err) {
      console.warn('[backfill] could not open data_update_log row (non-fatal):', err instanceof Error ? err.message : err);
    }

    let totalWritten = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalEmpty = 0;
    const failedSymbols: string[] = [];

    // Process in concurrent waves. Promise.all + slice keeps it simple
    // without pulling in p-limit (not in pod runtime).
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const wave = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        wave.map((s) => processStock(pool, s, begYmd, endYmd)),
      );
      for (const r of results) {
        if (r.status === 'written') totalWritten += r.written;
        else if (r.status === 'failed') {
          totalFailed += 1;
          failedSymbols.push(r.symbol);
        } else if (r.status === 'skipped') totalSkipped += 1;
        else if (r.status === 'empty') totalEmpty += 1;
      }
      const done = Math.min(i + CONCURRENCY, targets.length);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(
        `[backfill] ${done}/${targets.length} (written=${totalWritten} skipped=${totalSkipped} empty=${totalEmpty} failed=${totalFailed}) elapsed=${elapsed}s`,
      );
      if (i + CONCURRENCY < targets.length && BATCH_DELAY_MS > 0) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const durationMs = Date.now() - startMs;
    const success = totalFailed === 0;

    if (logId !== null) {
      try {
        await pool.query(
          `UPDATE data_update_log SET
             end_time = NOW(),
             status = $1,
             records_updated = $2,
             records_failed = $3,
             error_message = $4
           WHERE id = $5`,
          [
            success ? 'success' : 'partial',
            totalWritten,
            totalFailed,
            failedSymbols.length > 0
              ? `Failed: ${failedSymbols.slice(0, 30).join(', ')}${failedSymbols.length > 30 ? '...' : ''}`
              : null,
            logId,
          ],
        );
      } catch (err) {
        console.warn('[backfill] could not close data_update_log row:', err instanceof Error ? err.message : err);
      }
    }

    console.log('=== bulk-backfill-klines summary ===');
    console.log(JSON.stringify(
      {
        years: YEARS,
        window: `${begYmd} → ${endYmd}`,
        targetStocks: targets.length,
        rowsWritten: totalWritten,
        stocksSkipped: totalSkipped,
        stocksEmpty: totalEmpty,
        stocksFailed: totalFailed,
        failedSample: failedSymbols.slice(0, 20),
        durationMs,
      },
      null,
      2,
    ));

    if (!success) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('[backfill] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
