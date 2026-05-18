#!/usr/bin/env bun
/**
 * bootstrap-stock-list.ts — Pull the full A-share stock universe (SH + SZ)
 * from EastMoney's clist/get endpoint and upsert each row into the lucrum
 * `stocks` table. Sister script to bulk-backfill-klines.ts; this one only
 * populates metadata (symbol/name/exchange/industry/marketCap/isST), no
 * K-line data.
 *
 * Why a dedicated script (not import-initial-data.ts):
 *   import-initial-data.ts fetches stocks AND klines in one pass via
 *   drizzle. Production pod has no drizzle runtime — only `pg` is bundled.
 *   This script ports just the stock-list portion to plain `pg`, and we
 *   intentionally split the kline backfill into its own script so failures
 *   in one phase don't roll back the other (Open Q #2: 5-year window is
 *   long enough that batching matters).
 *
 * Symbol format: BARE per project_lucrum_phase7.md. EastMoney f12 already
 * returns bare ("600519" not "600519.SH"). Venue stored in stocks.exchange.
 *
 * Idempotent: ON CONFLICT (symbol) DO UPDATE keeps name/industry/cap fresh
 * but preserves existing id (FKs into kline_daily, stock_sector_mapping,
 * pack_run_targets, etc. don't break on re-run).
 *
 * Usage (locally, with DATABASE_URL):
 *   DATABASE_URL=postgresql://... bun run scripts/bootstrap-stock-list.ts
 *   DRY_RUN=1 bun run scripts/bootstrap-stock-list.ts   # parse only
 *
 * Usage (prod, recommended):
 *   ./scripts/bootstrap-stock-list.sh
 */

import { Pool } from 'pg';

interface StockRow {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: 'SH' | 'SZ';
  readonly industry: string | null;
  readonly marketCap: number | null;
  readonly isST: boolean;
}

interface EastMoneyDiff {
  readonly f12?: string;
  readonly f14?: string;
  readonly f100?: string;
  readonly f20?: number;
}

interface EastMoneyResponse {
  readonly data?: {
    readonly diff?: ReadonlyArray<EastMoneyDiff>;
    readonly total?: number;
  };
}

const EASTMONEY_URL = 'https://push2.eastmoney.com/api/qt/clist/get';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; lucrum-bootstrap/1.0)',
  'Referer': 'https://quote.eastmoney.com/',
};

// Shanghai main board + STAR Market; Shenzhen main + ChiNext + SME.
// Beijing Stock Exchange intentionally excluded — its symbols use a
// different prefix space that confuses EastMoney's secid resolution and
// is not part of CSI300/A-share universe by default.
const MARKET_FILTERS: ReadonlyArray<{ exchange: 'SH' | 'SZ'; fs: string }> = [
  { exchange: 'SH', fs: 'm:1+t:2,m:1+t:23' },
  { exchange: 'SZ', fs: 'm:0+t:6,m:0+t:13,m:0+t:80' },
];

const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === '1';

async function fetchExchange(exchange: 'SH' | 'SZ', fs: string): Promise<StockRow[]> {
  const params = new URLSearchParams({
    pn: '1',
    pz: PAGE_SIZE.toString(),
    po: '1',
    np: '1',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs,
    fields: 'f12,f14,f100,f20',
    _: Date.now().toString(),
  });

  const url = `${EASTMONEY_URL}?${params.toString()}`;
  console.log(`[bootstrap] GET ${exchange} (${url.length}b)`);

  const res = await fetch(url, { headers: HTTP_HEADERS });
  if (!res.ok) {
    throw new Error(`EastMoney ${exchange} HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as EastMoneyResponse;
  const diff = json.data?.diff ?? [];
  if (diff.length === 0) {
    throw new Error(`EastMoney ${exchange} returned 0 rows — filter or API changed`);
  }

  const rows: StockRow[] = [];
  for (const d of diff) {
    const symbol = d.f12;
    const name = d.f14;
    if (typeof symbol !== 'string' || symbol.length === 0) continue;
    if (typeof name !== 'string' || name.length === 0) continue;

    rows.push({
      symbol,
      name,
      exchange,
      industry: typeof d.f100 === 'string' && d.f100 !== '-' ? d.f100 : null,
      marketCap:
        typeof d.f20 === 'number' && d.f20 > 0 ? d.f20 / 100000000 : null, // 亿元
      isST: name.includes('ST'),
    });
  }

  console.log(`[bootstrap] ${exchange}: ${rows.length} stocks parsed`);
  return rows;
}

async function upsertStocks(pool: Pool, rows: StockRow[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    for (const s of batch) {
      placeholders.push(
        `($${p++}, $${p++}, $${p++}, 'active', $${p++}, $${p++}, $${p++})`,
      );
      values.push(s.symbol, s.name, s.exchange, s.industry, s.marketCap, s.isST);
    }

    // ON CONFLICT (symbol) preserves id (FK target) and only refreshes mutable
    // attributes. listing_date is left alone since EastMoney's clist doesn't
    // expose it; populated separately if needed.
    const sql = `
      INSERT INTO stocks (symbol, name, exchange, status, industry, market_cap, is_st)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        exchange = EXCLUDED.exchange,
        status = 'active',
        industry = COALESCE(EXCLUDED.industry, stocks.industry),
        market_cap = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
        is_st = EXCLUDED.is_st,
        updated_at = NOW()
    `;
    const r = await pool.query(sql, values);
    written += r.rowCount ?? batch.length;
    console.log(`[bootstrap] upsert ${i + 1}-${i + batch.length} (cumulative=${written})`);
  }
  return written;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL && !DRY_RUN) {
    console.error('DATABASE_URL is required (or set DRY_RUN=1).');
    process.exit(2);
  }

  const allRows: StockRow[] = [];
  for (const { exchange, fs } of MARKET_FILTERS) {
    const rows = await fetchExchange(exchange, fs);
    allRows.push(...rows);
    // Be polite — pause between exchanges.
    await new Promise((r) => setTimeout(r, 500));
  }

  // De-dupe just in case the two filters overlap (they shouldn't).
  const dedup = new Map<string, StockRow>();
  for (const r of allRows) dedup.set(r.symbol, r);
  const unique = Array.from(dedup.values());

  console.log(`[bootstrap] total unique stocks: ${unique.length}`);
  console.log(
    `[bootstrap] sample: ${unique.slice(0, 3).map((s) => `${s.symbol}/${s.name}/${s.exchange}`).join(' | ')}`,
  );

  if (DRY_RUN) {
    console.log('[bootstrap] DRY_RUN=1 — skipping DB write');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  });

  try {
    const written = await upsertStocks(pool, unique);

    const verify = await pool.query<{ active: string; sh: string; sz: string }>(
      `SELECT
         count(*) FILTER (WHERE status='active')::text AS active,
         count(*) FILTER (WHERE exchange='SH')::text   AS sh,
         count(*) FILTER (WHERE exchange='SZ')::text   AS sz
       FROM stocks`,
    );
    const v = verify.rows[0];
    console.log('=== bootstrap-stock-list summary ===');
    console.log(JSON.stringify(
      {
        fetched: unique.length,
        upserted: written,
        dbActive: v?.active,
        dbSH: v?.sh,
        dbSZ: v?.sz,
      },
      null,
      2,
    ));
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('[bootstrap] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
