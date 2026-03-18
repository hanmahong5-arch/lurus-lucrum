/**
 * Core Backtest Interfaces
 * 核心回测接口定义
 *
 * Provides abstraction layer for data providers, engines, and storage
 * 为数据提供者、引擎和存储提供抽象层
 *
 * @module lib/backtest/core/interfaces
 */

import type {
  BacktestKline,
  BacktestConfig,
  UnifiedBacktestRequest,
  UnifiedBacktestResult,
  BacktestProgress,
  ReturnMetrics,
  RiskMetrics,
  TradingMetrics,
  DiagnosticReport,
  PortfolioTarget,
  DetailedTrade,
} from "../types";

// =============================================================================
// RESULT TYPE / 结果类型
// =============================================================================

/**
 * Standard result type for consistent error handling
 * 标准结果类型，用于一致的错误处理
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: ErrorInfo };

/**
 * Error information structure
 * 错误信息结构
 */
export interface ErrorInfo {
  /** Machine-readable error code (错误代码) */
  code: string;
  /** User-friendly message in Chinese (中文用户友好消息) */
  message: string;
  /** English message (英文消息) */
  messageEn: string;
  /** Technical details for debugging (调试用技术详情) */
  details?: unknown;
  /** Whether user can retry (用户是否可以重试) */
  recoverable: boolean;
  /** Suggested action for user (建议的用户操作) */
  suggestedAction?: string;
}

// =============================================================================
// DATA TYPES / 数据类型
// =============================================================================

/**
 * K-line data request parameters
 * K线数据请求参数
 */
export interface KlineRequest {
  symbol: string;
  startDate: string;
  endDate: string;
  timeframe: "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m";
  adjustType?: "none" | "forward" | "backward";
}

/**
 * Stock basic information
 * 股票基本信息
 */
export interface StockInfo {
  symbol: string;
  name: string;
  market: "SH" | "SZ" | "BJ";
  listDate?: string;
  delistDate?: string;
  isST?: boolean;
  industry?: string;
  marketCap?: number;
}

/**
 * Trading day information
 * 交易日信息
 */
export interface TradingDay {
  date: string;
  isOpen: boolean;
  reason?: string; // Holiday name if closed
}

/**
 * Strategy configuration for validation
 * 策略配置（用于验证）
 */
export interface StrategyConfig {
  type: "builtin" | "custom" | "nlp";
  builtinId?: string;
  customCode?: string;
  nlpDescription?: string;
  params?: Record<string, number>;
}

/**
 * Strategy validation result
 * 策略验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * User preferences for backtest
 * 用户回测偏好设置
 */
export interface UserPreferences {
  defaultCapital: number;
  defaultCommission: number;
  defaultSlippage: number;
  defaultTimeframe: string;
  excludeST: boolean;
  excludeNew: boolean;
  theme?: "light" | "dark" | "system";
  locale?: "zh" | "en";
}

// =============================================================================
// DATA PROVIDER INTERFACE / 数据提供者接口
// =============================================================================

/**
 * Data Provider Interface
 * 数据提供者接口
 *
 * Decouples backtest engine from specific data sources
 * 将回测引擎与特定数据源解耦
 */
export interface IDataProvider {
  /** Provider name for identification */
  readonly name: string;

  /**
   * Fetch K-line data for symbol
   * 获取股票K线数据
   */
  getKlineData(params: KlineRequest): Promise<Result<BacktestKline[]>>;

  /**
   * Check if market is open on given date
   * 检查指定日期市场是否开放
   */
  isTradingDay(date: string): Promise<boolean>;

  /**
   * Get trading calendar for date range
   * 获取日期范围内的交易日历
   */
  getTradingCalendar(start: string, end: string): Promise<TradingDay[]>;

  /**
   * Get stock information for validation
   * 获取股票信息（用于验证）
   */
  getStockInfo(symbol: string): Promise<Result<StockInfo>>;

  /**
   * Search stocks by keyword
   * 根据关键词搜索股票
   */
  searchStocks(query: string, limit?: number): Promise<Result<StockInfo[]>>;

  /**
   * Health check for data provider
   * 数据提供者健康检查
   */
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// BACKTEST ENGINE INTERFACE / 回测引擎接口
// =============================================================================

/**
 * Backtest Engine Interface
 * 回测引擎接口
 *
 * Allows swapping between local/remote/mock engines
 * 允许在本地/远程/模拟引擎间切换
 */
export interface IBacktestEngine {
  /** Engine name for identification */
  readonly name: string;

  /**
   * Run backtest with given configuration
   * 使用给定配置运行回测
   */
  runBacktest(
    request: UnifiedBacktestRequest
  ): Promise<Result<UnifiedBacktestResult>>;

  /**
   * Cancel running backtest
   * 取消正在运行的回测
   */
  cancelBacktest(jobId: string): Promise<void>;

  /**
   * Get backtest progress
   * 获取回测进度
   */
  getProgress(jobId: string): Promise<BacktestProgress | null>;

  /**
   * Validate strategy before running
   * 运行前验证策略
   */
  validateStrategy(strategy: StrategyConfig): Promise<ValidationResult>;

  /**
   * Check if engine is available
   * 检查引擎是否可用
   */
  isAvailable(): Promise<boolean>;
}

// =============================================================================
// METRICS CALCULATOR INTERFACE / 指标计算器接口
// =============================================================================

/**
 * Equity curve data point
 * 净值曲线数据点
 */
export interface EquityCurvePoint {
  date: string;
  equity: number;
  benchmark?: number;
  drawdown: number;
  position?: number;
  cash?: number;
}

/**
 * All metrics combined
 * 所有指标合集
 */
export interface AllMetrics {
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;
}

/**
 * Metrics Calculator Interface
 * 指标计算器接口
 */
export interface IMetricsCalculator {
  /**
   * Calculate return metrics from equity curve
   * 从净值曲线计算收益指标
   */
  calculateReturnMetrics(data: EquityCurvePoint[]): ReturnMetrics;

  /**
   * Calculate risk metrics from equity curve
   * 从净值曲线计算风险指标
   */
  calculateRiskMetrics(data: EquityCurvePoint[]): RiskMetrics;

  /**
   * Calculate trading metrics from trades
   * 从交易记录计算交易指标
   */
  calculateTradingMetrics(
    trades: DetailedTrade[],
    tradingDays: number
  ): TradingMetrics;

  /**
   * Run diagnostics on all metrics
   * 对所有指标运行诊断
   */
  runDiagnostics(metrics: AllMetrics): DiagnosticReport;
}

// =============================================================================
// STORAGE INTERFACE / 存储接口
// =============================================================================

/**
 * Saved portfolio with metadata
 * 保存的组合（含元数据）
 */
export interface SavedPortfolio extends PortfolioTarget {
  id: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
}

/**
 * Cached backtest result
 * 缓存的回测结果
 */
export interface CachedResult {
  key: string;
  result: UnifiedBacktestResult;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Storage Interface
 * 存储接口
 *
 * Abstracts storage for portfolios, settings, and results
 * 抽象组合、设置和结果的存储
 */
export interface IStorage {
  // Portfolio operations / 组合操作
  savePortfolio(portfolio: SavedPortfolio): Promise<Result<void>>;
  loadPortfolio(id: string): Promise<Result<SavedPortfolio | null>>;
  listPortfolios(): Promise<Result<SavedPortfolio[]>>;
  deletePortfolio(id: string): Promise<Result<void>>;

  // Result caching / 结果缓存
  cacheResult(
    key: string,
    result: UnifiedBacktestResult,
    ttlSeconds?: number
  ): Promise<void>;
  getCachedResult(key: string): Promise<Result<UnifiedBacktestResult | null>>;
  clearCache(): Promise<void>;

  // User preferences / 用户偏好
  getPreferences(): Promise<UserPreferences>;
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;

  // Recent items / 最近项目
  getRecentTargets(): Promise<Result<Array<{ target: unknown; usedAt: number }>>>;
  addRecentTarget(target: unknown): Promise<void>;
}

// =============================================================================
// FACTORY FUNCTIONS / 工厂函数
// =============================================================================

/**
 * Create success result
 * 创建成功结果
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create failure result
 * 创建失败结果
 */
export function failure<T>(error: ErrorInfo): Result<T> {
  return { success: false, error };
}

/**
 * Check if result is success
 * 检查结果是否成功
 */
export function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Check if result is failure
 * 检查结果是否失败
 */
export function isFailure<T>(result: Result<T>): result is { success: false; error: ErrorInfo } {
  return !result.success;
}

/**
 * Unwrap result or throw
 * 解包结果或抛出异常
 */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

/**
 * Unwrap result or return default
 * 解包结果或返回默认值
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Map result data
 * 映射结果数据
 */
export function mapResult<T, U>(
  result: Result<T>,
  fn: (data: T) => U
): Result<U> {
  if (isSuccess(result)) {
    return success(fn(result.data));
  }
  return result as Result<U>;
}

/**
 * Chain results (flatMap)
 * 链式结果（flatMap）
 */
export async function chainResult<T, U>(
  result: Result<T>,
  fn: (data: T) => Promise<Result<U>>
): Promise<Result<U>> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result as Result<U>;
}
