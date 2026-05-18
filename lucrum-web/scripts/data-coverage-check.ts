#!/usr/bin/env bun
/**
 * data-coverage-check.ts — Read-only quality report for the lucrum data
 * layer. Run after the bulk backfill (and any time you want a snapshot)
 * to answer: "is the data shippable?"
 *
 * Reports:
 *   1. stocks: total active, by exchange, ST count
 *   2. kline_daily: row count, date range, distinct stock count
 *   3. coverage gaps: stocks with too-few rows or stale latest-date
 *   4. trading_calendar coverage
 *   5. Recent data_update_log entries
 *
 * Coverage thresholds (treat as soft warnings, not hard fails):
 *   - active stock should have >= 0.95 × expected trading days in window
 *   - latest kline date should be within 5 trading days of today
 *
 * Usage:
 *   DATABASE_URL=postgresql://... bun run scripts/data-coverage-check.ts
 *
 * Usage (prod):
 *   ./scripts/data-coverage-check.sh
 */

import { Pool } from 'pg';

const YEARS_BACK = Number.parseInt(process.env.YEARS ?? '5', 10);
const MIN_COVERAGE_RATIO = 0.95;
const STALE_LATEST_DAYS = 5;
const SAMPLE_LIMIT = 20;

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
    console.log('=== 1. stocks ===');
    const s = await pool.query<{
      total: string;
      active: string;
      sh: string;
      sz: string;
      st: string;
    }>(
      `SELECT
         count(*)::text                                       AS total,
         count(*) FILTER (WHERE status = 'active')::text       AS active,
         count(*) FILTER (WHERE exchange = 'SH')::text         AS sh,
         count(*) FILTER (WHERE exchange = 'SZ')::text         AS sz,
         count(*) FILTER (WHERE is_st = true)::text            AS st
       FROM stocks`,
    );
    console.log(JSON.stringify(s.rows[0], null, 2));

    console.log('\n=== 2. kline_daily ===');
    const k = await pool.query<{
      total: string;
      stock_count: string;
      min_date: string;
      max_date: string;
    }>(
      `SELECT
         count(*)::text                       AS total,
         count(DISTINCT stock_id)::text       AS stock_count,
         min(date)                            AS min_date,
         max(date)                            AS max_date
       FROM kline_daily`,
    );
    console.log(JSON.stringify(k.rows[0], null, 2));

    console.log('\n=== 3. coverage gaps ===');

    // Expected trading days in YEARS_BACK window — use trading_calendar
    // when available, otherwise fall back to a rough estimate.
    let expected = YEARS_BACK * 243; // A-share avg ~243 trading days/year
    try {
      const t = await pool.query<{ trading_days: string | null }>(
        `SELECT count(*)::text AS trading_days
           FROM trading_calendar
          WHERE is_trading = true
            AND date >= (CURRENT_DATE - ($1 || ' years')::interval)::date::text`,
        [YEARS_BACK],
      );
      const td = t.rows[0]?.trading_days;
      if (td !== null && td !== undefined) {
        const n = Number.parseInt(td, 10);
        if (Number.isFinite(n) && n > 0) expected = n;
      }
    } catch {
      // trading_calendar table empty or query shape mismatch — fallback.
    }
    console.log(`expected trading days in last ${YEARS_BACK}y: ${expected}`);

    const minRows = Math.floor(expected * MIN_COVERAGE_RATIO);
    const lowCoverage = await pool.query<{
      symbol: string;
      name: string;
      exchange: string | null;
      row_count: string;
      latest: string | null;
    }>(
      `SELECT s.symbol, s.name, s.exchange,
              coalesce(c.row_count, 0)::text AS row_count,
              c.latest                       AS latest
         FROM stocks s
         LEFT JOIN (
           SELECT stock_id, count(*)::int AS row_count, max(date) AS latest
             FROM kline_daily
            GROUP BY stock_id
         ) c ON c.stock_id = s.id
        WHERE s.status = 'active'
          AND s.symbol <> '000300'
          AND coalesce(c.row_count, 0) < $1
        ORDER BY coalesce(c.row_count, 0) ASC, s.symbol ASC
        LIMIT $2`,
      [minRows, SAMPLE_LIMIT],
    );
    console.log(
      `stocks below ${MIN_COVERAGE_RATIO * 100}% coverage (< ${minRows} rows). showing first ${SAMPLE_LIMIT}:`,
    );
    if (lowCoverage.rows.length === 0) {
      console.log('  ✅ none');
    } else {
      for (const row of lowCoverage.rows) {
        console.log(
          `  ${row.symbol} ${row.name.padEnd(8)} ${row.exchange ?? '?'} rows=${row.row_count} latest=${row.latest ?? '(none)'}`,
        );
      }
      const totalLow = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM stocks s
           LEFT JOIN (
             SELECT stock_id, count(*) AS row_count
               FROM kline_daily GROUP BY stock_id
           ) c ON c.stock_id = s.id
          WHERE s.status = 'active'
            AND s.symbol <> '000300'
            AND coalesce(c.row_count, 0) < $1`,
        [minRows],
      );
      console.log(`  …(total ${totalLow.rows[0]?.count} stocks below threshold)`);
    }

    // Stale-latest check: stocks whose newest kline is too old.
    const staleSince = new Date();
    staleSince.setDate(staleSince.getDate() - STALE_LATEST_DAYS - 2); // +2 weekend buffer
    const staleIso = staleSince.toISOString().slice(0, 10);
    const stale = await pool.query<{
      symbol: string;
      name: string;
      latest: string;
    }>(
      `SELECT s.symbol, s.name, c.latest
         FROM stocks s
         JOIN (
           SELECT stock_id, max(date) AS latest
             FROM kline_daily
            GROUP BY stock_id
         ) c ON c.stock_id = s.id
        WHERE s.status = 'active'
          AND s.symbol <> '000300'
          AND c.latest < $1
        ORDER BY c.latest ASC
        LIMIT $2`,
      [staleIso, SAMPLE_LIMIT],
    );
    console.log(
      `\nstocks with latest kline older than ${STALE_LATEST_DAYS} trading days (~${staleIso}). showing first ${SAMPLE_LIMIT}:`,
    );
    if (stale.rows.length === 0) {
      console.log('  ✅ none');
    } else {
      for (const r of stale.rows) {
        console.log(`  ${r.symbol} ${r.name.padEnd(8)} latest=${r.latest}`);
      }
    }

    console.log('\n=== 4. trading_calendar ===');
    const cal = await pool.query<{
      total: string;
      trading: string;
      min: string | null;
      max: string | null;
    }>(
      `SELECT
         count(*)::text                                    AS total,
         count(*) FILTER (WHERE is_trading)::text          AS trading,
         min(date)                                         AS min,
         max(date)                                         AS max
       FROM trading_calendar`,
    );
    console.log(JSON.stringify(cal.rows[0], null, 2));

    console.log('\n=== 5. recent data_update_log (last 10) ===');
    const log = await pool.query<{
      id: number;
      update_date: string;
      update_type: string;
      status: string;
      records_updated: number;
      records_failed: number;
      start_time: string;
      end_time: string | null;
    }>(
      `SELECT id, update_date, update_type, status,
              records_updated, records_failed,
              start_time::text, end_time::text
         FROM data_update_log
        ORDER BY id DESC
        LIMIT 10`,
    );
    if (log.rows.length === 0) {
      console.log('  (no entries — incremental cron has not run yet)');
    } else {
      for (const r of log.rows) {
        const dur = r.end_time ? `${Math.round((Date.parse(r.end_time) - Date.parse(r.start_time)) / 1000)}s` : 'running';
        console.log(
          `  #${r.id} ${r.update_date} ${r.update_type.padEnd(11)} ${r.status.padEnd(8)} updated=${r.records_updated} failed=${r.records_failed} dur=${dur}`,
        );
      }
    }

    console.log('\n✅ data-coverage-check complete');
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('[coverage] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
