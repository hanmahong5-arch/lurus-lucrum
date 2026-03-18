/**
 * Daily Data Updater
 * 每日数据更新器
 *
 * Automatically updates stock K-line data daily at 15:30 CST (after market close)
 * 每日15:30（收盘后）自动更新股票K线数据
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { db, pool } from '@/lib/db';
import { stocks, klineDaily, dataUpdateLog } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { runIncrementalUpdate } from './incremental-updater';

// ============================================================================
// Types
// ============================================================================

export interface UpdateOptions {
  updateType?: 'daily' | 'full' | 'partial';
  date?: string;              // Specific date to update (YYYY-MM-DD)
  symbols?: string[];         // Specific symbols to update
  force?: boolean;            // Force update even if data exists
}

export interface UpdateResult {
  success: boolean;
  recordsUpdated: number;
  recordsFailed: number;
  duration: number;
  errors?: string[];
  message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delay execution
 * 延迟执行
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get today's date in YYYY-MM-DD format (China timezone)
 * 获取今天的日期（中国时区）
 */
function getTodayDate(): string {
  const now = new Date();
  // Convert to China timezone (UTC+8)
  const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return chinaTime.toISOString().split('T')[0] ?? '';
}

/**
 * Check if today is a trading day (Mon-Fri)
 * 检查今天是否是交易日（周一到周五）
 */
function isTradingDay(): boolean {
  const now = new Date();
  const day = now.getDay();
  return day >= 1 && day <= 5; // 1=Monday, 5=Friday
}

/**
 * Fetch K-line data from EastMoney API with retry
 * 从东方财富API获取K线数据（带重试）
 */
async function fetchKLineFromAPI(
  symbol: string,
  exchange: string,
  date: string,
  maxRetries: number = 3
): Promise<any | null> {
  const secId = exchange === 'SH' ? `1.${symbol}` : `0.${symbol}`;
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&klt=101&fqt=1&lmt=1&beg=${date.replace(/-/g, '')}&end=${date.replace(/-/g, '')}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://quote.eastmoney.com/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.data || !data.data.klines || data.data.klines.length === 0) {
        return null; // No data for this date (non-trading day or suspended)
      }

      const klineStr = data.data.klines[0] as string;
      const parts = klineStr.split(',');

      return {
        date: parts[0],
        open: parseFloat(parts[1] ?? '0'),
        close: parseFloat(parts[2] ?? '0'),
        high: parseFloat(parts[3] ?? '0'),
        low: parseFloat(parts[4] ?? '0'),
        volume: parseFloat(parts[5] ?? '0'),
        amount: parseFloat(parts[6] ?? '0'),
      };
    } catch (error) {
      console.error(`[DailyUpdater] Attempt ${attempt}/${maxRetries} failed for ${symbol}:`, error);
      if (attempt === maxRetries) {
        return null;
      }
      // Exponential backoff: 1s, 2s, 4s
      await delay(Math.pow(2, attempt - 1) * 1000);
    }
  }

  return null;
}

// ============================================================================
// DailyDataUpdater Class
// ============================================================================

export class DailyDataUpdater {
  private job: ScheduledTask | null = null;
  private incrementalJob: ScheduledTask | null = null;
  private isRunning: boolean = false;

  /**
   * Start the cron jobs
   * 启动定时任务
   */
  start() {
    if (this.job) {
      console.log('[DailyUpdater] Job already running');
      return;
    }

    // Cron expression: "30 15 * * 1-5" = Every weekday at 15:30
    // Note: node-cron uses local timezone, so we need to specify Asia/Shanghai
    this.job = cron.schedule(
      '30 15 * * 1-5',
      async () => {
        console.log('[DailyUpdater] Cron job triggered at', new Date().toISOString());

        // Check if it's a trading day
        if (!isTradingDay()) {
          console.log('[DailyUpdater] Not a trading day, skipping update');
          return;
        }

        await this.runUpdate();
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    console.log('[DailyUpdater] Daily update job scheduled at 15:30 CST (Mon-Fri)');

    // Incremental update at 18:00 CST (after settlement, data fully available)
    this.incrementalJob = cron.schedule(
      '0 18 * * 1-5',
      async () => {
        console.log('[DailyUpdater] Incremental update cron triggered at', new Date().toISOString());

        if (!isTradingDay()) {
          console.log('[DailyUpdater] Not a trading day, skipping incremental update');
          return;
        }

        try {
          const result = await runIncrementalUpdate({
            batchSize: 50,
            batchDelayMs: 1000,
          });

          console.log(
            JSON.stringify({
              event: 'incremental_cron_complete',
              success: result.success,
              stocksUpdated: result.stocksUpdated,
              recordsInserted: result.recordsInserted,
              failedSymbols: result.failedSymbols.length,
              durationMs: result.durationMs,
            }),
          );
        } catch (error) {
          console.error(
            '[DailyUpdater] Incremental update cron failed:',
            error instanceof Error ? error.message : String(error),
          );
        }
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    console.log('[DailyUpdater] Incremental update job scheduled at 18:00 CST (Mon-Fri)');
  }

  /**
   * Stop the cron jobs
   * 停止定时任务
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('[DailyUpdater] Job stopped');
    }
    if (this.incrementalJob) {
      this.incrementalJob.stop();
      this.incrementalJob = null;
      console.log('[DailyUpdater] Incremental job stopped');
    }
  }

  /**
   * Check if currently running
   * 检查是否正在运行
   */
  isUpdating(): boolean {
    return this.isRunning;
  }

  /**
   * Run the update process
   * 执行更新流程
   */
  async runUpdate(options: UpdateOptions = {}): Promise<UpdateResult> {
    if (this.isRunning) {
      return {
        success: false,
        recordsUpdated: 0,
        recordsFailed: 0,
        duration: 0,
        message: 'Update already in progress',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const updateDate = options.date || getTodayDate();
    const updateType = options.updateType || 'daily';

    console.log(`[DailyUpdater] Starting ${updateType} update for ${updateDate}...`);

    try {
      // Create update log entry
      const [logEntry] = await db
        .insert(dataUpdateLog)
        .values({
          updateDate,
          updateType,
          startTime: new Date(), // Pass Date object, not string
          status: 'running',
        })
        .returning();

      let recordsUpdated = 0;
      let recordsFailed = 0;
      const errors: string[] = [];

      // Get stocks to update
      const stocksToUpdate = options.symbols
        ? await db.select().from(stocks).where(
            and(
              eq(stocks.status, 'active'),
              // Filter by symbols if provided
            )
          )
        : await db.select().from(stocks).where(eq(stocks.status, 'active'));

      console.log(`[DailyUpdater] Updating ${stocksToUpdate.length} stocks...`);

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < stocksToUpdate.length; i += batchSize) {
        const batch = stocksToUpdate.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (stock) => {
            try {
              // Check if data already exists (unless force update)
              if (!options.force) {
                const existing = await db
                  .select()
                  .from(klineDaily)
                  .where(
                    and(
                      eq(klineDaily.stockId, stock.id),
                      eq(klineDaily.date, updateDate)
                    )
                  )
                  .limit(1);

                if (existing.length > 0) {
                  // Data already exists, skip
                  return;
                }
              }

              // Fetch K-line data from API
              const klineData = await fetchKLineFromAPI(
                stock.symbol,
                stock.exchange || 'SZ',
                updateDate
              );

              if (!klineData) {
                // No data (non-trading day or suspended)
                return;
              }

              // Insert or update K-line data
              await db
                .insert(klineDaily)
                .values({
                  stockId: stock.id,
                  date: klineData.date,
                  open: klineData.open,
                  high: klineData.high,
                  low: klineData.low,
                  close: klineData.close,
                  volume: klineData.volume,
                  amount: klineData.amount,
                })
                .onConflictDoUpdate({
                  target: [klineDaily.stockId, klineDaily.date],
                  set: {
                    open: klineData.open,
                    high: klineData.high,
                    low: klineData.low,
                    close: klineData.close,
                    volume: klineData.volume,
                    amount: klineData.amount,
                  },
                });

              recordsUpdated++;
            } catch (error) {
              recordsFailed++;
              const errorMsg = `Failed to update ${stock.symbol}: ${error instanceof Error ? error.message : String(error)}`;
              errors.push(errorMsg);
              console.error('[DailyUpdater]', errorMsg);
            }
          })
        );

        // Progress logging
        const progress = Math.min(i + batchSize, stocksToUpdate.length);
        console.log(`[DailyUpdater] Progress: ${progress}/${stocksToUpdate.length} (${Math.round(progress / stocksToUpdate.length * 100)}%)`);

        // Rate limiting: delay between batches
        if (i + batchSize < stocksToUpdate.length) {
          await delay(1000); // 1 second delay between batches
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Update log entry
      if (logEntry) {
        await db
          .update(dataUpdateLog)
          .set({
            endTime: new Date(), // Pass Date object, not string
            status: recordsFailed === 0 ? 'success' : 'partial',
            recordsUpdated,
            recordsFailed,
            errorMessage: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
          })
          .where(eq(dataUpdateLog.id, logEntry.id));
      }

      console.log(`[DailyUpdater] Update completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`[DailyUpdater] Updated: ${recordsUpdated}, Failed: ${recordsFailed}`);

      return {
        success: recordsFailed === 0,
        recordsUpdated,
        recordsFailed,
        duration,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        message: `Updated ${recordsUpdated} records, ${recordsFailed} failed`,
      };
    } catch (error) {
      console.error('[DailyUpdater] Update failed:', error);

      return {
        success: false,
        recordsUpdated: 0,
        recordsFailed: 0,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        message: 'Update failed',
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let updaterInstance: DailyDataUpdater | null = null;

/**
 * Get the singleton updater instance
 * 获取单例更新器实例
 */
export function getDailyUpdater(): DailyDataUpdater {
  if (!updaterInstance) {
    updaterInstance = new DailyDataUpdater();
  }
  return updaterInstance;
}

/**
 * Initialize and start the daily updater
 * 初始化并启动每日更新器
 */
export function initializeDailyUpdater() {
  if (process.env.NODE_ENV === 'production') {
    const updater = getDailyUpdater();
    updater.start();
    console.log('✅ Daily data updater initialized and started');
  } else {
    console.log('ℹ️ Daily data updater disabled in development mode');
  }
}
