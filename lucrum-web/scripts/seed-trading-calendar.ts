#!/usr/bin/env bun
/**
 * seed-trading-calendar.ts — Derive the trading_calendar table from K-line
 * data. The CSI300 index (id=1, symbol=000300) trades every CN A-share
 * trading day, so its `kline_daily` rows are the authoritative source for
 * "which days does the market open?".
 *
 * Why derive instead of fetching a calendar feed:
 *   No public, free, reliable A-share calendar feed exists. EastMoney's
 *   stock-list API doesn't expose one, and screen-scraping holiday
 *   announcements is fragile. CSI300 has no halts, so its dates ARE the
 *   trading calendar. This is single-source-of-truth and bug-free.
 *
 * Algorithm:
 *   1. SELECT distinct dates from kline_daily WHERE stock_id = CSI300.id
 *   2. For every date in [min, max], insert with is_trading = true if it
 *      appears in CSI300's set, else false.
 *   3. ON CONFLICT DO UPDATE keeps the table re-runnable.
 *
 * Step 3 of the A-share ingest pipeline. Prereqs:
 *   - ingest-csi300.sh has run (fills CSI300 klines)
 *   - bulk-backfill-klines.sh has run (provides the date range we care about)
 *
 * Usage:
 *   DATABASE_URL=postgresql://... bun run scripts/seed-trading-calendar.ts
 *
 * Usage (prod):
 *   ./scripts/seed-trading-calendar.sh
 */

import { Pool } from 'pg';

const CSI300_SYMBOL = '000300';
const BATCH_SIZE = 1000;

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(2);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Locate CSI300.
    const csiRes = await pool.query<{ id: number }>(
      `SELECT id FROM stocks WHERE symbol = $1 LIMIT 1`,
      [CSI300_SYMBOL],
    );
    const csiId = csiRes.rows[0]?.id;
    if (typeof csiId !== 'number') {
      console.error(`stocks row for ${CSI300_SYMBOL} not found — run ingest-csi300.sh first`);
      process.exit(2);
    }
    console.log(`[trading-cal] CSI300 stock_id=${csiId}`);

    const datesRes = await pool.query<{ date: string }>(
      `SELECT date FROM kline_daily
        WHERE stock_id = $1
        ORDER BY date ASC`,
      [csiId],
    );
    const tradingDates = datesRes.rows.map((r) => r.date);
    if (tradingDates.length === 0) {
      console.error('CSI300 has no klines — run ingest-csi300.sh first');
      process.exit(2);
    }

    const tradingSet = new Set(tradingDates);
    const minDate = tradingDates[0]!;
    const maxDate = tradingDates[tradingDates.length - 1]!;
    console.log(`[trading-cal] CSI300 covers ${minDate} → ${maxDate} (${tradingDates.length} trading days)`);

    // Walk every calendar day in [minDate, maxDate], classify, batch upsert.
    interface CalRow {
      date: string;
      isTrading: boolean;
    }
    const allRows: CalRow[] = [];
    for (let d = minDate; d <= maxDate; d = nextDay(d)) {
      allRows.push({ date: d, isTrading: tradingSet.has(d) });
    }
    const tradingDayCount = allRows.filter((r) => r.isTrading).length;
    const closedDayCount = allRows.length - tradingDayCount;
    console.log(
      `[trading-cal] derived ${allRows.length} rows (${tradingDayCount} trading, ${closedDayCount} closed)`,
    );

    let written = 0;
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let p = 1;
      for (const r of batch) {
        placeholders.push(`($${p++}, $${p++}, 'normal', 'CN')`);
        values.push(r.date, r.isTrading);
      }
      const sql = `
        INSERT INTO trading_calendar (date, is_trading, session_type, exchange)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (date) DO UPDATE SET
          is_trading = EXCLUDED.is_trading,
          session_type = EXCLUDED.session_type,
          exchange = EXCLUDED.exchange
      `;
      const r = await pool.query(sql, values);
      written += r.rowCount ?? batch.length;
      console.log(`[trading-cal] upsert ${i + 1}-${i + batch.length} (cumulative=${written})`);
    }

    const verify = await pool.query<{ count: string; trading: string; min: string; max: string }>(
      `SELECT
         count(*)::text                                AS count,
         count(*) FILTER (WHERE is_trading)::text      AS trading,
         min(date)                                     AS min,
         max(date)                                     AS max
       FROM trading_calendar`,
    );
    const v = verify.rows[0];
    console.log('=== seed-trading-calendar summary ===');
    console.log(JSON.stringify(
      {
        upserted: written,
        dbTotal: v?.count,
        dbTrading: v?.trading,
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
  console.error('[trading-cal] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
