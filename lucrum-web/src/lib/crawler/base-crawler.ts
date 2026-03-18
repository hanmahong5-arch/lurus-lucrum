/**
 * Base Crawler Abstract Class
 * 基础爬虫抽象类
 *
 * Provides common functionality for all strategy crawlers.
 * 为所有策略爬虫提供通用功能
 */

import type {
  StrategySource,
  CrawlerConfig,
  CrawlResult,
  RawStrategyData,
  ProcessedStrategy,
  CrawlerEvent,
  CrawlerEventType,
  CrawlStatus,
} from './types';
import { calculatePopularityScore } from './popularity-scorer';

// =============================================================================
// Abstract Base Crawler / 抽象基础爬虫
// =============================================================================

/**
 * Base class for strategy crawlers
 * 策略爬虫基类
 *
 * Implementations must override:
 * - fetchStrategies(): Fetch raw strategy data from source
 * - classifyStrategy(): Classify strategy type and extract indicators
 */
export abstract class BaseCrawler {
  protected config: Required<CrawlerConfig>;
  protected eventHandlers: Map<CrawlerEventType, ((event: CrawlerEvent) => void)[]> = new Map();

  constructor(config: Partial<CrawlerConfig>) {
    this.config = {
      source: config.source ?? 'github',
      maxStrategies: config.maxStrategies ?? 100,
      includeCode: config.includeCode ?? true,
      rateLimitMs: config.rateLimitMs ?? 1000,
      retryAttempts: config.retryAttempts ?? 3,
      github: config.github ?? {},
      joinquant: config.joinquant ?? {},
    };
  }

  /**
   * Get the source this crawler handles
   * 获取此爬虫处理的源
   */
  abstract getSource(): StrategySource;

  /**
   * Fetch raw strategy data from source
   * 从源获取原始策略数据
   *
   * @returns Array of raw strategy data
   */
  protected abstract fetchStrategies(): Promise<RawStrategyData[]>;

  /**
   * Classify strategy type and extract indicators
   * 分类策略类型并提取指标
   *
   * @param raw Raw strategy data
   * @returns Classified strategy with type and indicators
   */
  protected abstract classifyStrategy(
    raw: RawStrategyData
  ): Promise<Pick<ProcessedStrategy, 'strategyType' | 'markets' | 'indicators'>>;

  /**
   * Run the crawler
   * 运行爬虫
   */
  async crawl(): Promise<CrawlResult> {
    const startTime = new Date();
    const errors: string[] = [];
    const strategies: ProcessedStrategy[] = [];

    this.emit({
      type: 'crawl:start',
      source: this.getSource(),
      timestamp: new Date(),
      data: { message: `Starting crawl for ${this.getSource()}` },
    });

    try {
      // Fetch raw strategies
      // 获取原始策略
      const rawStrategies = await this.fetchStrategies();
      const total = rawStrategies.length;

      this.emit({
        type: 'crawl:progress',
        source: this.getSource(),
        timestamp: new Date(),
        data: {
          progress: 10,
          message: `Found ${total} strategies to process`,
        },
      });

      // Process each strategy
      // 处理每个策略
      for (let i = 0; i < rawStrategies.length; i++) {
        const raw = rawStrategies[i];
        if (!raw) continue;

        try {
          const processed = await this.processStrategy(raw);
          strategies.push(processed);

          this.emit({
            type: 'strategy:found',
            source: this.getSource(),
            timestamp: new Date(),
            data: {
              progress: Math.round(10 + (80 * (i + 1)) / total),
              strategyName: processed.name,
            },
          });
        } catch (error) {
          const errorMsg = `Failed to process strategy ${raw.name}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[Crawler:${this.getSource()}]`, errorMsg);
        }

        // Rate limiting
        // 速率限制
        if (i < rawStrategies.length - 1) {
          await this.delay(this.config.rateLimitMs);
        }
      }

      const endTime = new Date();
      const status: CrawlStatus = errors.length > 0 ? 'partial' : 'success';

      this.emit({
        type: 'crawl:complete',
        source: this.getSource(),
        timestamp: new Date(),
        data: {
          progress: 100,
          message: `Crawl completed with ${strategies.length} strategies`,
        },
      });

      return {
        source: this.getSource(),
        status,
        startTime,
        endTime,
        strategiesFound: rawStrategies.length,
        strategiesNew: strategies.length, // Updated by service layer
        strategiesUpdated: 0, // Updated by service layer
        strategies,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMsg = `Crawl failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);

      this.emit({
        type: 'crawl:error',
        source: this.getSource(),
        timestamp: new Date(),
        data: { error: errorMsg },
      });

      return {
        source: this.getSource(),
        status: 'failed',
        startTime,
        endTime: new Date(),
        strategiesFound: 0,
        strategiesNew: 0,
        strategiesUpdated: 0,
        strategies: [],
        errors,
      };
    }
  }

  /**
   * Process raw strategy data into processed format
   * 将原始策略数据处理为格式化数据
   */
  protected async processStrategy(raw: RawStrategyData): Promise<ProcessedStrategy> {
    // Classify strategy
    // 分类策略
    const classification = await this.classifyStrategy(raw);

    // Calculate popularity score
    // 计算流行度分数
    const popularityScore = calculatePopularityScore({
      views: raw.views ?? 0,
      likes: raw.likes ?? 0,
      forks: raw.forks ?? 0,
      stars: raw.stars ?? 0,
      comments: raw.comments ?? 0,
      sharpeRatio: raw.sharpeRatio,
      maxDrawdown: raw.maxDrawdown,
    });

    return {
      source: raw.source,
      sourceId: raw.sourceId,
      name: raw.name,
      description: raw.description,
      author: raw.author,

      // Classification
      strategyType: classification.strategyType,
      markets: classification.markets,
      indicators: classification.indicators,

      // Performance
      annualReturn: raw.annualReturn,
      maxDrawdown: raw.maxDrawdown,
      sharpeRatio: raw.sharpeRatio,

      // Popularity
      views: raw.views ?? 0,
      likes: raw.likes ?? 0,
      popularityScore,

      // Code
      originalCode: this.config.includeCode ? raw.code : undefined,
      conversionStatus: 'pending',

      // Metadata
      originalUrl: raw.url,
      tags: raw.tags,
      isFeatured: popularityScore > 100, // Featured if high popularity
    };
  }

  /**
   * Delay execution
   * 延迟执行
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
   * 使用指数退避重试操作
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < attempts - 1) {
          const backoff = Math.pow(2, i) * 1000; // 1s, 2s, 4s...
          console.log(
            `[Crawler:${this.getSource()}] Retry ${i + 1}/${attempts} after ${backoff}ms`
          );
          await this.delay(backoff);
        }
      }
    }

    throw lastError;
  }

  /**
   * Register event handler
   * 注册事件处理器
   */
  on(type: CrawlerEventType, handler: (event: CrawlerEvent) => void): void {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.push(handler);
    this.eventHandlers.set(type, handlers);
  }

  /**
   * Emit event
   * 发送事件
   */
  protected emit(event: CrawlerEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[Crawler:${this.getSource()}] Event handler error:`, error);
      }
    }
  }
}

// =============================================================================
// Utility Functions / 工具函数
// =============================================================================

/**
 * Common indicator detection patterns
 * 常见指标检测模式
 */
export const INDICATOR_PATTERNS: Record<string, RegExp[]> = {
  SMA: [/\bsma\b/i, /simple\s*moving\s*average/i, /smawindow/i],
  EMA: [/\bema\b/i, /exponential\s*moving\s*average/i, /emawindow/i],
  MACD: [/\bmacd\b/i, /macd_?signal/i, /macd_?hist/i],
  RSI: [/\brsi\b/i, /relative\s*strength/i, /rsiwindow/i],
  BOLL: [/\bboll\b/i, /bollinger/i, /boll_?band/i],
  KDJ: [/\bkdj\b/i, /stochastic/i],
  ATR: [/\batr\b/i, /average\s*true\s*range/i],
  VWAP: [/\bvwap\b/i, /volume\s*weighted/i],
  OBV: [/\bobv\b/i, /on\s*balance\s*volume/i],
  DMI: [/\bdmi\b/i, /directional\s*movement/i, /\badx\b/i],
};

/**
 * Detect indicators from code or description
 * 从代码或描述中检测指标
 */
export function detectIndicators(text: string): string[] {
  const indicators: string[] = [];

  for (const [indicator, patterns] of Object.entries(INDICATOR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        indicators.push(indicator);
        break;
      }
    }
  }

  return Array.from(new Set(indicators));
}

/**
 * Strategy type detection patterns
 * 策略类型检测模式
 */
export const STRATEGY_TYPE_PATTERNS = {
  trend: [/trend/i, /趋势/i, /突破/i, /breakout/i, /moving\s*average/i],
  'mean-revert': [/mean\s*revert/i, /均值回归/i, /reversion/i, /oscillator/i],
  momentum: [/momentum/i, /动量/i, /relative\s*strength/i],
  factor: [/factor/i, /因子/i, /alpha/i, /多因子/i],
  arbitrage: [/arbitrage/i, /套利/i, /spread/i],
  'event-driven': [/event/i, /事件/i, /news/i, /earnings/i],
  'machine-learning': [/machine\s*learning/i, /ml\b/i, /神经网络/i, /neural/i, /深度学习/i],
};

/**
 * Detect strategy type from text
 * 从文本中检测策略类型
 */
export function detectStrategyType(text: string): ProcessedStrategy['strategyType'] {
  for (const [type, patterns] of Object.entries(STRATEGY_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type as ProcessedStrategy['strategyType'];
      }
    }
  }
  return 'other';
}
