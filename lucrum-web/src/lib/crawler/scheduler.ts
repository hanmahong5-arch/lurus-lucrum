/**
 * Crawler Scheduler
 * 爬虫调度器
 *
 * Manages scheduled crawling jobs using node-cron.
 * Supports daily and weekly schedules for different sources.
 *
 * 使用node-cron管理定时爬取任务
 * 支持不同源的每日和每周调度
 */

import { schedule, type ScheduledTask } from 'node-cron';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { strategyCrawlLog, popularStrategies } from '@/lib/db/schema';
import type { ScheduledJob, StrategySource, CrawlResult, ProcessedStrategy } from './types';
import { createGitHubCrawler } from './sources/github-crawler';
import type { BaseCrawler } from './base-crawler';

// =============================================================================
// Types / 类型
// =============================================================================

interface SchedulerConfig {
  /** Enable scheduling / 启用调度 */
  enabled: boolean;
  /** Timezone for cron jobs / 定时任务的时区 */
  timezone: string;
}

// =============================================================================
// Constants / 常量
// =============================================================================

/**
 * Default scheduled jobs
 * 默认定时任务
 */
const DEFAULT_JOBS: ScheduledJob[] = [
  {
    id: 'daily-github',
    schedule: '0 6 * * *', // Daily at 06:00 CST
    sources: ['github'],
    enabled: true,
    description: 'Daily GitHub strategy crawl',
  },
  // Future: JoinQuant, UQer, XueQiu
];

// =============================================================================
// Crawler Scheduler Class / 爬虫调度器类
// =============================================================================

/**
 * Manages scheduled crawling jobs
 * 管理定时爬取任务
 */
export class CrawlerScheduler {
  private config: SchedulerConfig;
  private jobs: Map<string, ScheduledTask> = new Map();
  private isRunning = false;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      enabled: config?.enabled ?? process.env.NODE_ENV === 'production',
      timezone: config?.timezone ?? 'Asia/Shanghai',
    };
  }

  /**
   * Start the scheduler
   * 启动调度器
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[CrawlerScheduler] Scheduler disabled');
      return;
    }

    if (this.isRunning) {
      console.log('[CrawlerScheduler] Scheduler already running');
      return;
    }

    console.log('[CrawlerScheduler] Starting scheduler...');

    for (const job of DEFAULT_JOBS) {
      if (!job.enabled) continue;

      const task = schedule(
        job.schedule,
        async () => {
          await this.runJob(job);
        },
        {
          timezone: this.config.timezone,
        }
      );

      this.jobs.set(job.id, task);
      console.log(`[CrawlerScheduler] Scheduled job: ${job.id} (${job.schedule})`);
    }

    this.isRunning = true;
    console.log('[CrawlerScheduler] Scheduler started');
  }

  /**
   * Stop the scheduler
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[CrawlerScheduler] Stopping scheduler...');

    for (const [id, task] of Array.from(this.jobs.entries())) {
      task.stop();
      console.log(`[CrawlerScheduler] Stopped job: ${id}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('[CrawlerScheduler] Scheduler stopped');
  }

  /**
   * Run a specific job
   * 运行特定任务
   */
  async runJob(job: ScheduledJob): Promise<CrawlResult[]> {
    console.log(`[CrawlerScheduler] Running job: ${job.id}`);
    const results: CrawlResult[] = [];

    for (const source of job.sources) {
      try {
        const result = await this.crawlSource(source, job.config);
        results.push(result);

        // Save results to database
        await this.saveResults(result);
      } catch (error) {
        console.error(`[CrawlerScheduler] Job ${job.id} failed for source ${source}:`, error);
      }
    }

    return results;
  }

  /**
   * Manually trigger a crawl for a source
   * 手动触发源的爬取
   */
  async triggerCrawl(source: StrategySource): Promise<CrawlResult> {
    console.log(`[CrawlerScheduler] Manual crawl triggered for: ${source}`);

    const result = await this.crawlSource(source);
    await this.saveResults(result);

    return result;
  }

  /**
   * Crawl a specific source
   * 爬取特定源
   */
  private async crawlSource(
    source: StrategySource,
    config?: Partial<ScheduledJob['config']>
  ): Promise<CrawlResult> {
    const crawler = this.createCrawler(source, config);

    if (!crawler) {
      throw new Error(`No crawler available for source: ${source}`);
    }

    return crawler.crawl();
  }

  /**
   * Create crawler for source
   * 为源创建爬虫
   */
  private createCrawler(
    source: StrategySource,
    config?: Partial<ScheduledJob['config']>
  ): BaseCrawler | null {
    switch (source) {
      case 'github':
        return createGitHubCrawler(config);
      // Future: other crawlers
      default:
        console.warn(`[CrawlerScheduler] Unknown source: ${source}`);
        return null;
    }
  }

  /**
   * Save crawl results to database
   * 保存爬取结果到数据库
   */
  private async saveResults(result: CrawlResult): Promise<void> {
    // Create crawl log entry
    const [logEntry] = await db
      .insert(strategyCrawlLog)
      .values({
        source: result.source,
        crawlType: 'daily',
        startTime: result.startTime,
        endTime: result.endTime,
        status: result.status,
        strategiesFound: result.strategiesFound,
        strategiesNew: 0, // Will be updated below
        strategiesUpdated: 0,
        errorMessage: result.errors?.join('; '),
        details: { errors: result.errors },
      })
      .returning();

    let newCount = 0;
    let updatedCount = 0;

    // Save or update strategies
    for (const strategy of result.strategies) {
      try {
        const existing = await db.query.popularStrategies.findFirst({
          where: eq(popularStrategies.source, strategy.source),
        });

        if (existing) {
          // Update existing strategy
          await db
            .update(popularStrategies)
            .set({
              name: strategy.name,
              description: strategy.description,
              author: strategy.author,
              strategyType: strategy.strategyType,
              markets: strategy.markets,
              indicators: strategy.indicators,
              annualReturn: strategy.annualReturn?.toString(),
              maxDrawdown: strategy.maxDrawdown?.toString(),
              sharpeRatio: strategy.sharpeRatio?.toString(),
              views: strategy.views,
              likes: strategy.likes,
              popularityScore: strategy.popularityScore.toString(),
              originalCode: strategy.originalCode,
              originalUrl: strategy.originalUrl,
              tags: strategy.tags,
              isFeatured: strategy.isFeatured,
              updatedAt: new Date(),
            })
            .where(eq(popularStrategies.id, existing.id));

          updatedCount++;
        } else {
          // Insert new strategy
          await db.insert(popularStrategies).values({
            source: strategy.source,
            sourceId: strategy.sourceId,
            name: strategy.name,
            description: strategy.description,
            author: strategy.author,
            strategyType: strategy.strategyType,
            markets: strategy.markets,
            indicators: strategy.indicators,
            annualReturn: strategy.annualReturn?.toString(),
            maxDrawdown: strategy.maxDrawdown?.toString(),
            sharpeRatio: strategy.sharpeRatio?.toString(),
            views: strategy.views,
            likes: strategy.likes,
            popularityScore: strategy.popularityScore.toString(),
            originalCode: strategy.originalCode,
            conversionStatus: strategy.conversionStatus,
            originalUrl: strategy.originalUrl,
            tags: strategy.tags,
            isFeatured: strategy.isFeatured,
          });

          newCount++;
        }
      } catch (error) {
        console.error(
          `[CrawlerScheduler] Failed to save strategy ${strategy.name}:`,
          error
        );
      }
    }

    // Update log with final counts
    await db
      .update(strategyCrawlLog)
      .set({
        strategiesNew: newCount,
        strategiesUpdated: updatedCount,
      })
      .where(eq(strategyCrawlLog.id, logEntry!.id));

    console.log(
      `[CrawlerScheduler] Saved ${newCount} new, ${updatedCount} updated strategies`
    );
  }

  /**
   * Get scheduler status
   * 获取调度器状态
   */
  getStatus(): {
    running: boolean;
    jobs: { id: string; schedule: string; enabled: boolean }[];
  } {
    return {
      running: this.isRunning,
      jobs: DEFAULT_JOBS.map((j) => ({
        id: j.id,
        schedule: j.schedule,
        enabled: j.enabled,
      })),
    };
  }
}

// =============================================================================
// Singleton Instance / 单例实例
// =============================================================================

let schedulerInstance: CrawlerScheduler | null = null;

/**
 * Get crawler scheduler instance (singleton)
 * 获取爬虫调度器实例（单例）
 */
export function getCrawlerScheduler(): CrawlerScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new CrawlerScheduler();
  }
  return schedulerInstance;
}

/**
 * Initialize and start the scheduler
 * 初始化并启动调度器
 */
export function initializeCrawlerScheduler(): void {
  const scheduler = getCrawlerScheduler();
  scheduler.start();
}

/**
 * Trigger manual crawl for a source
 * 触发源的手动爬取
 */
export async function triggerManualCrawl(source: StrategySource): Promise<CrawlResult> {
  const scheduler = getCrawlerScheduler();
  return scheduler.triggerCrawl(source);
}
