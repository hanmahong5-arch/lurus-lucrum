/**
 * Cache Module Exports
 * 缓存模块导出
 *
 * Central export point for all caching functionality.
 * 所有缓存功能的统一导出点
 */

// Hybrid cache implementation
export {
  HybridCache,
  type HybridCacheConfig,
  type CacheSetOptions,
  type CacheStats,
  // Pre-configured instances
  popularStrategyCache,
  workflowCache,
  backtestCache,
  stockSearchCache,
  // Utilities
  getAllCacheStats,
  logCacheStats,
} from './hybrid-cache';

// Cache key management
export {
  CACHE_PREFIXES,
  CACHE_TTL,
  // Key generators
  getPopularStrategyListKey,
  getPopularStrategyKey,
  getTrendingStrategiesKey,
  getWorkflowSessionKey,
  getWorkflowStepKey,
  getStockSearchKey,
  getStockQuoteKey,
  getKLineKey,
  getBacktestResultKey,
  getAdvisorContextKey,
  getKLineTTL,
} from './cache-keys';
