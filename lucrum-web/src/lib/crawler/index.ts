/**
 * Crawler Module Exports
 * 爬虫模块导出
 *
 * Central export point for the popular strategy crawler system.
 * 流行策略爬虫系统的统一导出点
 */

// Types
export type {
  StrategySource,
  StrategyType,
  TargetMarket,
  ConversionStatus,
  CrawlStatus,
  RawStrategyData,
  ProcessedStrategy,
  ConversionRequest,
  ConversionResult,
  CrawlerConfig,
  CrawlResult,
  ScheduledJob,
  CrawlerEventType,
  CrawlerEvent,
} from './types';

// Base crawler
export { BaseCrawler, detectIndicators, detectStrategyType } from './base-crawler';

// Source crawlers
export { GitHubCrawler, createGitHubCrawler } from './sources/github-crawler';

// Popularity scoring
export {
  calculatePopularityScore,
  getScoreBreakdown,
  normalizeScore,
  getPopularityTier,
  compareByPopularity,
  calculateTrendingScore,
  calculateQualityScore,
  type PopularityMetrics,
  type ScoringWeights,
  type ScoreBreakdown,
} from './popularity-scorer';

// Strategy converter
export {
  StrategyConverter,
  getStrategyConverter,
  convertStrategy,
} from './strategy-converter';

// Scheduler
export {
  CrawlerScheduler,
  getCrawlerScheduler,
  initializeCrawlerScheduler,
  triggerManualCrawl,
} from './scheduler';
