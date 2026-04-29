#!/usr/bin/env bun
/**
 * ingest-csi300.ts — Pull CSI300 (沪深300, symbol 000300) daily K-lines from
 * EastMoney and upsert them into the lucrum DB so that pack_run_performance
 * can compute benchmark_return / excess_mean_return.
 *
 * Without this row, fetchBenchmarkSeries() in pack-run-performance.ts returns
 * an empty map → benchmark_return is NULL → excess_mean_return is NULL →
 * the monitoring page's alpha column shows "—" everywhere. See lucrum-monitoring
 * skill §5 for the full playbook.
 *
 * Why a dedicated script (not import-initial-data.ts):
 *   import-initial-data.ts fetches the EastMoney *stock list* (filters
 *   m:1+t:2 etc.) which doesn't include indices. CSI300 is a pseudo-stock —
 *   it has K-line data but isn't on the listed-companies list. A purpose-built
 *   tool also makes the operational flow obvious: alpha column empty → run
 *   ingest-csi300.sh.
 *
 * Why pg-only (no drizzle):
 *   The production standalone Next.js bundle ships only runtime deps, not
 *   drizzle-orm. This script must run in-pod (where DATABASE_URL is reachable),
 *   so it sticks to `pg` which is bundled.
 *
 * Idempotent: safe to re-run. Stocks row uses ON CONFLICT DO UPDATE; klines
 * use ON CONFLICT (stock_id, date) DO UPDATE.
 *
 * Usage (locally, with DATABASE_URL pointing at the cluster DB):
 *   DATABASE_URL=postgresql://... bun run scripts/ingest-csi300.ts
 *
 * Usage (prod, recommended) — pipe into the running pod:
 *   ./scripts/ingest-csi300.sh
 */

import { Pool } from 'pg';

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

const SYMBOL = '000300';
const NAME = '沪深300';
const EXCHANGE = 'SH';
const SECID = '1.000300';
const EASTMONEY_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; lucrum-ingest/1.0)',
  'Referer': 'https://quote.eastmoney.com/',
};

const YEARS = Number.parseInt(process.env.YEARS ?? '3', 10);
const BATCH_SIZE = 500;

function ymd(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

async function fetchKLines(years: number): Promise<KLineRow[]> {
  const end = new Date();
  const beg = new Date(end);
  beg.setUTCFullYear(beg.getUTCFullYear() - years);

  const params = new URLSearchParams({
    secid: SECID,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',         // daily
    fqt: '1',           // forward-adjusted
    beg: ymd(beg),
    end: ymd(end),
    lmt: '10000',
    _: Date.now().toString(),
  });

  const url = `${EASTMONEY_URL}?${params.toString()}`;
  console.log(`[ingest-csi300] GET ${url}`);

  const res = await fetch(url, { headers: HTTP_HEADERS });
  if (!res.ok) {
    throw new Error(`EastMoney HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as EastMoneyResponse;
  const lines = json.data?.klines ?? [];
  if (lines.length === 0) {
    throw new Error('EastMoney returned no klines — secid wrong, throttled, or API changed');
  }

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
  console.log(`[ingest-csi300] parsed ${rows.length} rows (${rows[0]?.date} → ${rows.at(-1)?.date})`);
  return rows;
}

async function upsertStock(pool: Pool): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO stocks (symbol, name, exchange, status, listing_date, is_st)
     VALUES ($1, $2, $3, 'active', '2005-04-08', false)
     ON CONFLICT (symbol) DO UPDATE
        SET name = EXCLUDED.name,
            exchange = EXCLUDED.exchange,
            status = 'active',
            updated_at = NOW()
     RETURNING id`,
    [SYMBOL, NAME, EXCHANGE],
  );
  const id = r.rows[0]?.id;
  if (typeof id !== 'number') throw new Error('upsert stocks did not return id');
  console.log(`[ingest-csi300] stocks row id=${id} (${SYMBOL} ${NAME})`);
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
    console.log(`[ingest-csi300] upsert batch ${i + 1}-${i + batch.length} (cumulative=${written})`);
  }
  return written;
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

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  });

  try {
    const klines = await fetchKLines(YEARS);
    const stockId = await upsertStock(pool);
    const written = await upsertKLines(pool, stockId, klines);

    const verify = await pool.query<{ count: string; min: string; max: string }>(
      `SELECT count(*)::text AS count, min(date) AS min, max(date) AS max
         FROM kline_daily WHERE stock_id = $1`,
      [stockId],
    );
    const v = verify.rows[0];
    console.log('=== ingest-csi300 summary ===');
    console.log(JSON.stringify(
      {
        symbol: SYMBOL,
        stockId,
        fetched: klines.length,
        written,
        dbCount: v?.count,
        dbDateRange: v ? `${v.min} → ${v.max}` : null,
      },
      null,
      2,
    ));
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('[ingest-csi300] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
