/**
 * Cache Key Management
 * 缓存键管理
 *
 * Centralized cache key generation for all caching needs.
 * Ensures consistent key formats across memory and Redis caches.
 * 集中式缓存键生成，确保内存和Redis缓存使用一致的键格式
 */

// =============================================================================
// Key Prefixes / 键前缀
// =============================================================================

export const CACHE_PREFIXES = {
  // Popular strategy system / 流行策略系统
  POPULAR_STRATEGY: 'ps',
  STRATEGY_LIST: 'psl',
  STRATEGY_TRENDING: 'pst',

  // Workflow system / 工作流系统
  WORKFLOW_SESSION: 'wfs',
  WORKFLOW_STEP: 'wfst',

  // Stock data / 股票数据
  STOCK_SEARCH: 'ss',
  STOCK_QUOTE: 'sq',
  KLINE: 'kl',

  // Backtest / 回测
  BACKTEST_RESULT: 'bt',

  // Advisor / 顾问
  ADVISOR_CONTEXT: 'ac',
} as const;

// =============================================================================
// Key Generators / 键生成器
// =============================================================================

/**
 * Generate cache key for popular strategy list
 * 生成流行策略列表缓存键
 */
export function getPopularStrategyListKey(
  source?: string,
  type?: string,
  page?: number
): string {
  const parts: string[] = [CACHE_PREFIXES.STRATEGY_LIST];
  if (source) parts.push(source);
  if (type) parts.push(type);
  if (page !== undefined) parts.push(String(page));
  return parts.join(':');
}

/**
 * Generate cache key for single popular strategy
 * 生成单个流行策略缓存键
 */
export function getPopularStrategyKey(id: number): string {
  return `${CACHE_PREFIXES.POPULAR_STRATEGY}:${id}`;
}

/**
 * Generate cache key for trending strategies
 * 生成趋势策略缓存键
 */
export function getTrendingStrategiesKey(period: 'day' | 'week' | 'month'): string {
  return `${CACHE_PREFIXES.STRATEGY_TRENDING}:${period}`;
}

/**
 * Generate cache key for workflow session
 * 生成工作流会话缓存键
 */
export function getWorkflowSessionKey(sessionId: string): string {
  return `${CACHE_PREFIXES.WORKFLOW_SESSION}:${sessionId}`;
}

/**
 * Generate cache key for workflow step
 * 生成工作流步骤缓存键
 */
export function getWorkflowStepKey(sessionId: string, stepNumber: number): string {
  return `${CACHE_PREFIXES.WORKFLOW_STEP}:${sessionId}:${stepNumber}`;
}

/**
 * Generate cache key for stock search results
 * 生成股票搜索结果缓存键
 */
export function getStockSearchKey(query: string): string {
  return `${CACHE_PREFIXES.STOCK_SEARCH}:${query.toLowerCase()}`;
}

/**
 * Generate cache key for stock quote
 * 生成股票行情缓存键
 */
export function getStockQuoteKey(symbol: string): string {
  return `${CACHE_PREFIXES.STOCK_QUOTE}:${symbol}`;
}

/**
 * Generate cache key for K-line data
 * 生成K线数据缓存键
 */
export function getKLineKey(symbol: string, timeframe: string, startDate?: string): string {
  const parts = [CACHE_PREFIXES.KLINE, symbol, timeframe];
  if (startDate) parts.push(startDate);
  return parts.join(':');
}

/**
 * Generate cache key for backtest result
 * 生成回测结果缓存键
 */
export function getBacktestResultKey(
  strategyHash: string,
  symbol: string,
  dateRange: string
): string {
  return `${CACHE_PREFIXES.BACKTEST_RESULT}:${strategyHash}:${symbol}:${dateRange}`;
}

/**
 * Generate cache key for advisor context
 * 生成顾问上下文缓存键
 */
export function getAdvisorContextKey(userId: string, sessionId: string): string {
  return `${CACHE_PREFIXES.ADVISOR_CONTEXT}:${userId}:${sessionId}`;
}

// =============================================================================
// TTL Configuration / TTL配置
// =============================================================================

/**
 * Default TTL values in seconds for different cache types
 * 不同缓存类型的默认TTL值（秒）
 */
export const CACHE_TTL = {
  // Very short (real-time data) / 超短（实时数据）
  STOCK_QUOTE: 5,

  // Short / 短
  STOCK_SEARCH: 5 * 60, // 5 minutes
  KLINE_MINUTE: 60, // 1 minute

  // Medium / 中等
  KLINE_DAILY: 60 * 60, // 1 hour
  POPULAR_STRATEGY_LIST: 30 * 60, // 30 minutes
  TRENDING_STRATEGIES: 60 * 60, // 1 hour

  // Long / 长
  WORKFLOW_SESSION: 24 * 60 * 60, // 24 hours
  WORKFLOW_STEP: 24 * 60 * 60, // 24 hours
  BACKTEST_RESULT: 24 * 60 * 60, // 24 hours
  STRATEGY_DETAIL: 24 * 60 * 60, // 24 hours

  // Very long / 超长
  KLINE_WEEKLY: 7 * 24 * 60 * 60, // 1 week
} as const;

/**
 * Get appropriate TTL for K-line data based on timeframe
 * 根据时间周期获取合适的K线数据TTL
 */
export function getKLineTTL(timeframe: string): number {
  const ttlMap: Record<string, number> = {
    '1m': CACHE_TTL.KLINE_MINUTE,
    '5m': CACHE_TTL.KLINE_MINUTE * 5,
    '15m': CACHE_TTL.KLINE_MINUTE * 15,
    '30m': CACHE_TTL.KLINE_MINUTE * 30,
    '60m': CACHE_TTL.KLINE_DAILY,
    '1d': CACHE_TTL.KLINE_DAILY,
    '1w': CACHE_TTL.KLINE_WEEKLY,
    '1M': CACHE_TTL.KLINE_WEEKLY * 4,
  };
  return ttlMap[timeframe] ?? CACHE_TTL.KLINE_DAILY;
}
