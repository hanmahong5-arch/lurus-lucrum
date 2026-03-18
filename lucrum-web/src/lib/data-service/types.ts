/**
 * Data Service Type Definitions
 * 数据服务类型定义
 *
 * Core types for market data fetching, caching, and observability
 * 市场数据获取、缓存和可观测性的核心类型
 */

// =============================================================================
// MARKET DATA TYPES / 市场数据类型
// =============================================================================

/**
 * Stock quote data structure
 * 股票行情数据结构
 */
export interface StockQuote {
  symbol: string;           // Stock code / 股票代码 (e.g., "600519", "000001")
  name: string;             // Stock name / 股票名称
  price: number;            // Current price / 当前价格
  change: number;           // Price change / 涨跌额
  changePercent: number;    // Change percentage / 涨跌幅
  open: number;             // Open price / 开盘价
  high: number;             // High price / 最高价
  low: number;              // Low price / 最低价
  prevClose: number;        // Previous close / 昨收价
  volume: number;           // Volume in shares / 成交量（股）
  amount: number;           // Amount in CNY / 成交额（元）
  turnoverRate: number;     // Turnover rate / 换手率
  pe: number | null;        // P/E ratio / 市盈率
  pb: number | null;        // P/B ratio / 市净率
  marketCap: number | null; // Market cap / 总市值
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * K-line (candlestick) data structure
 * K线数据结构
 */
export interface KLineData {
  time: number;             // Unix timestamp / 时间戳
  open: number;             // Open price / 开盘价
  high: number;             // High price / 最高价
  low: number;              // Low price / 最低价
  close: number;            // Close price / 收盘价
  volume: number;           // Volume / 成交量
  amount?: number;          // Amount / 成交额
}

/**
 * Time frame options for K-line data
 * K线时间周期选项
 */
export type KLineTimeFrame =
  | "1m"    // 1 minute / 1分钟
  | "5m"    // 5 minutes / 5分钟
  | "15m"   // 15 minutes / 15分钟
  | "30m"   // 30 minutes / 30分钟
  | "60m"   // 60 minutes / 60分钟
  | "1d"    // Daily / 日线
  | "1w"    // Weekly / 周线
  | "1M";   // Monthly / 月线

/**
 * Index data structure (for market indices)
 * 指数数据结构
 */
export interface IndexQuote {
  symbol: string;           // Index code / 指数代码
  name: string;             // Index name / 指数名称
  price: number;            // Current value / 当前点位
  change: number;           // Change / 涨跌
  changePercent: number;    // Change percentage / 涨跌幅
  volume: number;           // Volume / 成交量
  amount: number;           // Amount / 成交额
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * Capital flow data structure
 * 资金流向数据结构
 */
export interface CapitalFlow {
  symbol: string;           // Stock code / 股票代码
  name: string;             // Stock name / 股票名称
  mainNetInflow: number;    // Main force net inflow / 主力净流入
  superLargeInflow: number; // Super large order inflow / 超大单净流入
  largeInflow: number;      // Large order inflow / 大单净流入
  mediumInflow: number;     // Medium order inflow / 中单净流入
  smallInflow: number;      // Small order inflow / 小单净流入
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * North-bound capital flow (港股通北向资金)
 */
export interface NorthBoundFlow {
  date: string;             // Date / 日期
  shConnect: number;        // Shanghai Connect net buy / 沪股通净买入
  szConnect: number;        // Shenzhen Connect net buy / 深股通净买入
  total: number;            // Total net buy / 合计净买入
  shQuota: number;          // Shanghai remaining quota / 沪股通余额
  szQuota: number;          // Shenzhen remaining quota / 深股通余额
  timestamp: number;        // Unix timestamp / 时间戳
}

// =============================================================================
// API RESPONSE TYPES / API响应类型
// =============================================================================

/**
 * Generic API response wrapper
 * 通用API响应包装器
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  source: string;           // Data source name / 数据源名称
  cached: boolean;          // Whether from cache / 是否来自缓存
  timestamp: number;        // Response timestamp / 响应时间戳
  latency: number;          // Request latency in ms / 请求延迟（毫秒）
}

/**
 * Batch API response for multiple symbols
 * 批量API响应
 */
export interface BatchApiResponse<T> {
  success: boolean;
  data: Record<string, T>;
  errors: Record<string, string>;
  source: string;
  cached: boolean;
  timestamp: number;
  latency: number;
}

// =============================================================================
// CACHE TYPES / 缓存类型
// =============================================================================

/**
 * Cache entry structure
 * 缓存条目结构
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;        // Cache time / 缓存时间
  ttl: number;              // Time to live in ms / 过期时间（毫秒）
  source: string;           // Data source / 数据源
  hits: number;             // Cache hit count / 命中次数
}

/**
 * Cache configuration
 * 缓存配置
 */
export interface CacheConfig {
  maxSize: number;          // Max entries / 最大条目数
  defaultTTL: number;       // Default TTL in ms / 默认过期时间
  cleanupInterval: number;  // Cleanup interval in ms / 清理间隔
}

/**
 * Cache statistics
 * 缓存统计
 */
export interface CacheStats {
  size: number;             // Current size / 当前大小
  hits: number;             // Total hits / 总命中次数
  misses: number;           // Total misses / 总未命中次数
  hitRate: number;          // Hit rate / 命中率
  oldestEntry: number;      // Oldest entry timestamp / 最旧条目时间
  newestEntry: number;      // Newest entry timestamp / 最新条目时间
}

// =============================================================================
// OBSERVABILITY TYPES / 可观测性类型
// =============================================================================

/**
 * Log levels for data service
 * 数据服务日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log entry structure
 * 日志条目结构
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: string;           // Service/module name / 服务/模块名称
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request metrics
 * 请求指标
 */
export interface RequestMetrics {
  requestId: string;
  source: string;           // Data source / 数据源
  endpoint: string;         // API endpoint / API端点
  method: string;           // HTTP method / HTTP方法
  startTime: number;        // Start timestamp / 开始时间
  endTime: number;          // End timestamp / 结束时间
  latency: number;          // Latency in ms / 延迟（毫秒）
  status: "success" | "error" | "timeout";
  statusCode?: number;      // HTTP status code / HTTP状态码
  cached: boolean;          // From cache / 是否来自缓存
  errorMessage?: string;    // Error message / 错误信息
}

/**
 * Service health status
 * 服务健康状态
 */
export interface ServiceHealth {
  source: string;           // Data source name / 数据源名称
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: number;        // Last check timestamp / 最后检查时间
  latency: number;          // Average latency / 平均延迟
  successRate: number;      // Success rate (0-1) / 成功率
  errorCount: number;       // Recent error count / 最近错误数
  lastError?: string;       // Last error message / 最后错误信息
}

/**
 * Aggregated service statistics
 * 聚合服务统计
 */
export interface ServiceStats {
  totalRequests: number;    // Total requests / 总请求数
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  cacheHitRate: number;
  healthStatus: ServiceHealth[];
  uptime: number;           // Service uptime in ms / 服务运行时间
}

// =============================================================================
// DATA SOURCE TYPES / 数据源类型
// =============================================================================

/**
 * Data source configuration
 * 数据源配置
 */
export interface DataSourceConfig {
  id: string;               // Source ID / 源ID
  name: string;             // Display name / 显示名称
  baseUrl: string;          // Base URL / 基础URL
  timeout: number;          // Request timeout in ms / 请求超时
  retries: number;          // Max retries / 最大重试次数
  retryDelay: number;       // Retry delay in ms / 重试延迟
  rateLimit: {
    maxRequests: number;    // Max requests / 最大请求数
    windowMs: number;       // Window in ms / 窗口时间
  };
  headers?: Record<string, string>;
  enabled: boolean;         // Whether enabled / 是否启用
  priority: number;         // Priority (lower is higher) / 优先级
}

/**
 * Data source status
 * 数据源状态
 */
export interface DataSourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  health: ServiceHealth;
  lastRequest: number;
  requestCount: number;
  errorCount: number;
}

// =============================================================================
// MARKET STATUS TYPES / 市场状态类型
// =============================================================================

/**
 * Market trading status
 * 市场交易状态
 */
export type MarketStatus =
  | "pre-open"      // Pre-market / 盘前
  | "opening"       // Opening auction / 集合竞价
  | "trading"       // Trading / 交易中
  | "lunch-break"   // Lunch break / 午休
  | "closing"       // Closing auction / 尾盘集合竞价
  | "closed";       // Closed / 收盘

/**
 * Market info structure
 * 市场信息结构
 */
export interface MarketInfo {
  market: "sh" | "sz" | "bj"; // Shanghai, Shenzhen, Beijing / 沪、深、北
  status: MarketStatus;
  tradingDay: string;       // Trading day / 交易日 YYYY-MM-DD
  openTime: string;         // Open time / 开盘时间
  closeTime: string;        // Close time / 收盘时间
  isHoliday: boolean;       // Is holiday / 是否假日
  nextTradingDay: string;   // Next trading day / 下一交易日
}

// =============================================================================
// INSTITUTIONAL DATA TYPES / 机构数据类型
// =============================================================================

/**
 * Dragon Tiger List (龙虎榜) entry
 * 龙虎榜条目
 */
export interface DragonTigerEntry {
  symbol: string;           // Stock code / 股票代码
  name: string;             // Stock name / 股票名称
  tradeDate: string;        // Trade date / 交易日期
  closePrice: number;       // Close price / 收盘价
  changePercent: number;    // Change percent / 涨跌幅
  turnoverRate: number;     // Turnover rate / 换手率
  netBuyAmount: number;     // Net buy amount / 净买入额
  buyAmount: number;        // Total buy amount / 买入总额
  sellAmount: number;       // Total sell amount / 卖出总额
  reason: string;           // Reason for list / 上榜原因
  buyInstitutions: number;  // Buy institution count / 买入机构数
  sellInstitutions: number; // Sell institution count / 卖出机构数
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * Sector capital flow data
 * 板块资金流向数据
 */
export interface SectorCapitalFlow {
  sectorCode: string;       // Sector code / 板块代码
  sectorName: string;       // Sector name / 板块名称
  sectorType: "industry" | "concept" | "region"; // 行业/概念/地域
  mainNetInflow: number;    // Main force net inflow / 主力净流入
  mainNetInflowPercent: number; // Main net inflow percent / 主力净流入占比
  superLargeInflow: number; // Super large order inflow / 超大单净流入
  largeInflow: number;      // Large order inflow / 大单净流入
  mediumInflow: number;     // Medium order inflow / 中单净流入
  smallInflow: number;      // Small order inflow / 小单净流入
  changePercent: number;    // Sector change percent / 板块涨跌幅
  leadingStock: string;     // Leading stock name / 领涨股
  leadingStockChange: number; // Leading stock change / 领涨股涨幅
  stockCount: number;       // Stock count in sector / 成份股数量
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * Margin trading (融资融券) data
 * 融资融券数据
 */
export interface MarginTradingData {
  tradeDate: string;        // Trade date / 交易日期
  market: "sh" | "sz" | "total"; // Market / 市场
  marginBalance: number;    // Margin balance / 融资余额
  marginBuy: number;        // Margin buy amount / 融资买入额
  marginRepay: number;      // Margin repay amount / 融资偿还额
  shortBalance: number;     // Short balance / 融券余额
  shortBalanceAmount: number; // Short balance in CNY / 融券余额金额
  shortSell: number;        // Short sell volume / 融券卖出量
  shortRepay: number;       // Short repay volume / 融券偿还量
  totalBalance: number;     // Total balance / 融资融券余额
  netBuy: number;           // Net margin buy / 融资净买入
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * Large order flow summary
 * 大单流向汇总
 */
export interface LargeOrderFlow {
  symbol: string;           // Stock code / 股票代码
  name: string;             // Stock name / 股票名称
  price: number;            // Current price / 现价
  changePercent: number;    // Change percent / 涨跌幅
  mainNetInflow: number;    // Main net inflow / 主力净流入
  mainNetInflowPercent: number; // Main net inflow ratio / 主力净流入占比
  superLargeNetInflow: number; // Super large net inflow / 超大单净流入
  largeNetInflow: number;   // Large net inflow / 大单净流入
  orderType: "buy" | "sell"; // Dominant order type / 主导方向
  timestamp: number;        // Unix timestamp / 时间戳
}

/**
 * Market sentiment indicator
 * 市场情绪指标
 */
export interface MarketSentiment {
  date: string;             // Date / 日期
  upCount: number;          // Up stock count / 上涨家数
  downCount: number;        // Down stock count / 下跌家数
  flatCount: number;        // Flat stock count / 平盘家数
  limitUpCount: number;     // Limit up count / 涨停家数
  limitDownCount: number;   // Limit down count / 跌停家数
  upDownRatio: number;      // Up/Down ratio / 涨跌比
  avgChangePercent: number; // Average change percent / 平均涨跌幅
  totalAmount: number;      // Total trading amount / 总成交额
  newHighCount: number;     // 52-week high count / 创新高家数
  newLowCount: number;      // 52-week low count / 创新低家数
  sentimentScore: number;   // Sentiment score 0-100 / 情绪分数
  timestamp: number;        // Unix timestamp / 时间戳
}
