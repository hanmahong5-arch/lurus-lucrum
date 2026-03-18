/**
 * Crawler Module Types
 * 爬虫模块类型定义
 *
 * Defines types for the popular strategy crawling system.
 * 定义流行策略爬取系统的类型
 */

// =============================================================================
// Source Types / 数据源类型
// =============================================================================

/**
 * Supported strategy sources
 * 支持的策略来源
 */
export type StrategySource = 'github' | 'joinquant' | 'uqer' | 'xueqiu';

/**
 * Strategy type classification
 * 策略类型分类
 */
export type StrategyType =
  | 'trend' // Trend following / 趋势跟踪
  | 'mean-revert' // Mean reversion / 均值回归
  | 'momentum' // Momentum / 动量策略
  | 'factor' // Factor-based / 因子策略
  | 'arbitrage' // Arbitrage / 套利策略
  | 'event-driven' // Event-driven / 事件驱动
  | 'machine-learning' // ML-based / 机器学习
  | 'other'; // Other / 其他

/**
 * Target markets for strategy
 * 策略适用市场
 */
export type TargetMarket = 'stock' | 'futures' | 'crypto' | 'options' | 'forex';

/**
 * Code conversion status
 * 代码转换状态
 */
export type ConversionStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * Crawl job status
 * 爬取任务状态
 */
export type CrawlStatus = 'running' | 'success' | 'failed' | 'partial';

// =============================================================================
// Data Types / 数据类型
// =============================================================================

/**
 * Raw strategy data from crawler
 * 爬虫获取的原始策略数据
 */
export interface RawStrategyData {
  /** Source platform / 来源平台 */
  source: StrategySource;
  /** ID on source platform / 源平台ID */
  sourceId: string;
  /** Strategy name / 策略名称 */
  name: string;
  /** Description / 描述 */
  description?: string;
  /** Author / 作者 */
  author?: string;
  /** Original code / 原始代码 */
  code?: string;
  /** Original URL / 原始链接 */
  url?: string;

  // Metrics from source / 源平台指标
  views?: number;
  likes?: number;
  forks?: number;
  comments?: number;
  stars?: number;

  // Performance (if available) / 性能（如有）
  annualReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;

  // Metadata / 元数据
  tags?: string[];
  language?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Processed strategy data ready for database
 * 处理后准备存入数据库的策略数据
 */
export interface ProcessedStrategy {
  source: StrategySource;
  sourceId: string;
  name: string;
  description?: string;
  author?: string;

  // Classification / 分类
  strategyType?: StrategyType;
  markets?: TargetMarket[];
  indicators?: string[];

  // Performance / 性能
  annualReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;

  // Popularity / 流行度
  views: number;
  likes: number;
  popularityScore: number;

  // Code / 代码
  originalCode?: string;
  conversionStatus: ConversionStatus;

  // Metadata / 元数据
  originalUrl?: string;
  tags?: string[];
  isFeatured: boolean;
}

/**
 * Strategy code conversion request
 * 策略代码转换请求
 */
export interface ConversionRequest {
  strategyId: number;
  originalCode: string;
  sourceLanguage: string;
  targetFramework: 'veighna' | 'vnpy';
  metadata?: {
    name?: string;
    description?: string;
    indicators?: string[];
  };
}

/**
 * Strategy code conversion result
 * 策略代码转换结果
 */
export interface ConversionResult {
  success: boolean;
  convertedCode?: string;
  error?: string;
  warnings?: string[];
  confidence?: number; // 0-1, conversion confidence
}

// =============================================================================
// Crawler Types / 爬虫类型
// =============================================================================

/**
 * Crawler configuration
 * 爬虫配置
 */
export interface CrawlerConfig {
  /** Source to crawl / 爬取的源 */
  source: StrategySource;
  /** Maximum strategies to fetch / 最大获取策略数 */
  maxStrategies?: number;
  /** Include code in crawl / 是否包含代码 */
  includeCode?: boolean;
  /** Rate limit delay in ms / 速率限制延迟（毫秒） */
  rateLimitMs?: number;
  /** Retry attempts / 重试次数 */
  retryAttempts?: number;
  /** GitHub specific options */
  github?: {
    /** Repositories to crawl / 要爬取的仓库 */
    repositories?: string[];
    /** Search query / 搜索查询 */
    searchQuery?: string;
    /** Minimum stars / 最小星标数 */
    minStars?: number;
  };
  /** JoinQuant specific options */
  joinquant?: {
    /** Categories to crawl / 要爬取的分类 */
    categories?: string[];
  };
}

/**
 * Crawl job result
 * 爬取任务结果
 */
export interface CrawlResult {
  source: StrategySource;
  status: CrawlStatus;
  startTime: Date;
  endTime: Date;
  strategiesFound: number;
  strategiesNew: number;
  strategiesUpdated: number;
  strategies: ProcessedStrategy[];
  errors?: string[];
}

/**
 * Scheduled crawl job configuration
 * 定时爬取任务配置
 */
export interface ScheduledJob {
  /** Job identifier / 任务标识 */
  id: string;
  /** Cron expression / Cron表达式 */
  schedule: string;
  /** Sources to crawl / 要爬取的源 */
  sources: StrategySource[];
  /** Crawler config overrides / 爬虫配置覆盖 */
  config?: Partial<CrawlerConfig>;
  /** Is job enabled / 是否启用 */
  enabled: boolean;
  /** Description / 描述 */
  description?: string;
}

// =============================================================================
// Event Types / 事件类型
// =============================================================================

/**
 * Crawler event types
 * 爬虫事件类型
 */
export type CrawlerEventType =
  | 'crawl:start'
  | 'crawl:progress'
  | 'crawl:complete'
  | 'crawl:error'
  | 'strategy:found'
  | 'strategy:saved'
  | 'conversion:start'
  | 'conversion:complete';

/**
 * Crawler event data
 * 爬虫事件数据
 */
export interface CrawlerEvent {
  type: CrawlerEventType;
  source: StrategySource;
  timestamp: Date;
  data?: {
    progress?: number; // 0-100
    message?: string;
    strategyId?: number;
    strategyName?: string;
    error?: string;
  };
}
