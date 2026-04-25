/**
 * Pack-Run Performance Scheduler
 *
 * Refreshes alpha-decay rollups (pack_run_performance) on a schedule so the
 * monitoring drill-down always shows fresh data without relying on a user
 * clicking "重新计算".
 *
 * Why a refresh, not just a one-shot compute when a horizon T+H is reached:
 * - klineDaily for very recent days may be revised (intraday → settled).
 * - adj_factor for splits/dividends arrives a few sessions after the event.
 * - The benchmark series may be backfilled later (CSI300 ingestion is
 *   bootstrapped separately from per-stock klines).
 * Recomputing each weekday converges all of these without per-symbol logic.
 *
 * Idempotency: computePackRunPerformance upserts on (run_id, horizon, topN),
 * so running this every weekday is safe — it just touches existing rows.
 *
 * Cost bound: scans at most MAX_RUNS_PER_TICK runs whose asOfDate is within
 * REFRESH_LOOKBACK_DAYS. Beyond that lookback, h=120 has long since
 * converged and no further changes occur. Each run-row triggers two cheap
 * windowed queries (basket grid + benchmark series).
 *
 * @module lib/cron/pack-run-performance-scheduler
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { packRuns } from '@/lib/db/schema';
import { computePackRunPerformance } from '@/lib/strategy-packs/pack-run-performance';

// Runs older than this are skipped: by 200 trading days even h=120 is fully
// cooked (with margin for the slowest split-adjustment latency we've seen).
const REFRESH_LOOKBACK_DAYS = 200;

// Hard ceiling per tick to keep one bad day from blowing out the cron's
// runtime. Re-runs the next session if we somehow accumulate more.
const MAX_RUNS_PER_TICK = 500;

// Default horizons + topN — must match the UI's defaults so the upsert key
// (run_id, horizon, top_n) deduplicates against what users see.
const DEFAULT_HORIZONS: ReadonlyArray<number> = [1, 5, 20];
const DEFAULT_TOP_N = 10;

export interface PerfRefreshResult {
  readonly scanned: number;
  readonly computed: number;
  readonly failed: number;
  readonly durationMs: number;
}

export class PackRunPerformanceScheduler {
  private job: ScheduledTask | null = null;
  private running = false;

  start(): void {
    if (this.job) {
      console.log('[PerfScheduler] Job already running');
      return;
    }
    // 07:00 CST Mon-Fri — after the 18:00 prior-day incremental kline update
    // has fully settled, so today's compute sees the latest closes.
    this.job = cron.schedule(
      '0 7 * * 1-5',
      async () => {
        console.log(
          '[PerfScheduler] Cron triggered at',
          new Date().toISOString(),
        );
        const result = await this.runRefresh();
        console.log(
          JSON.stringify({
            event: 'perf_refresh_complete',
            scanned: result.scanned,
            computed: result.computed,
            failed: result.failed,
            durationMs: result.durationMs,
          }),
        );
      },
      { timezone: 'Asia/Shanghai' },
    );
    console.log(
      '[PerfScheduler] Forward-return refresh scheduled at 07:00 CST (Mon-Fri)',
    );
  }

  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('[PerfScheduler] Job stopped');
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Scan recent successful runs and recompute their performance rollups.
   * Safe to call ad-hoc (e.g. for backfill). Returns counters for telemetry.
   */
  async runRefresh(): Promise<PerfRefreshResult> {
    if (this.running) {
      console.log('[PerfScheduler] Already running, skipping');
      return { scanned: 0, computed: 0, failed: 0, durationMs: 0 };
    }
    this.running = true;
    const start = Date.now();

    try {
      const cutoffMs = Date.now() - REFRESH_LOOKBACK_DAYS * 86_400_000;
      const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

      const runs = await db
        .select({
          runId: packRuns.runId,
          userId: packRuns.userId,
        })
        .from(packRuns)
        .where(
          and(
            eq(packRuns.status, 'success'),
            gte(packRuns.asOfDate, cutoffDate),
          ),
        )
        .orderBy(packRuns.createdAt)
        .limit(MAX_RUNS_PER_TICK);

      let computed = 0;
      let failed = 0;

      for (const r of runs) {
        // Owner-scoped compute requires a userId; legacy/orphan rows are
        // skipped rather than attributed to a fallback identity.
        if (!r.userId) continue;
        try {
          await computePackRunPerformance(r.userId, r.runId, {
            horizons: DEFAULT_HORIZONS,
            topN: DEFAULT_TOP_N,
          });
          computed++;
        } catch (err) {
          failed++;
          console.error(
            `[PerfScheduler] compute failed for ${r.runId}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      return {
        scanned: runs.length,
        computed,
        failed,
        durationMs: Date.now() - start,
      };
    } finally {
      this.running = false;
    }
  }
}

let instance: PackRunPerformanceScheduler | null = null;

export function getPackRunPerformanceScheduler(): PackRunPerformanceScheduler {
  if (!instance) instance = new PackRunPerformanceScheduler();
  return instance;
}

export function initializePackRunPerformanceScheduler(): void {
  if (process.env.NODE_ENV === 'production') {
    const scheduler = getPackRunPerformanceScheduler();
    scheduler.start();
    console.log('✅ Pack-run performance scheduler initialized and started');
  } else {
    console.log(
      'ℹ️ Pack-run performance scheduler disabled in development mode',
    );
  }
}
