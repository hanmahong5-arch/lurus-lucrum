/**
 * Backtest Types - Enhanced type definitions
 * 回测类型 - 增强的类型定义
 *
 * This module provides comprehensive type definitions for the backtest system,
 * including detailed trade records, daily logs, and result structures.
 *
 * @module lib/backtest/types
 */

import type { LotCalculation } from "./lot-size";

// =============================================================================
// BASIC TYPES / 基础类型
// =============================================================================

/**
 * K-line data point for backtesting
 */
export interface BacktestKline {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  symbol: string;
  initialCapital: number;
  commission: number; // Commission rate (e.g., 0.0003 = 0.03%)
  slippage: number; // Slippage rate (e.g., 0.001 = 0.1%)
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  timeframe: "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m";
  // A-share market rules
  enableT1?: boolean; // T+1 constraint: cannot sell on same day as buy (default true)
  enableCircuitBreaker?: boolean; // Limit up/down (涨跌停) constraint (default true)
  stampDuty?: number; // Stamp duty rate on sell side only, e.g. 0.0005 = 0.05% (default 0.0005, since 2023-08-28)
  transferFee?: number; // Transfer fee rate (bilateral), e.g. 0.00001 = 0.001% (default 0.00001)
  // Walk-forward analysis
  wfSplitRatio?: 0 | 0.7 | 0.8; // 0 = full sample, 0.8 = 80% in-sample (default 0)
  // Benchmark comparison
  benchmarkKlines?: BacktestKline[]; // Benchmark K-line data (e.g., CSI 300)
}

/**
 * Parsed strategy from generated code
 */
export interface ParsedStrategy {
  name: string;
  params: Record<string, number>;
  indicators: string[];
  entryCondition: string;
  exitCondition: string;
}

// =============================================================================
// ENHANCED TRADE TYPES / 增强的交易类型
// =============================================================================

/**
 * Detailed trade record with full execution information
 * 包含完整执行信息的详细交易记录
 */
export interface DetailedTrade {
  // Basic info / 基本信息
  id: string;
  timestamp: number; // Unix timestamp
  date: string; // ISO date string
  type: "buy" | "sell";

  // Symbol info / 标的信息 (Phase 7 新增)
  symbol: string; // Stock symbol code (股票代码)
  symbolName: string; // Stock name (股票名称, e.g., "贵州茅台")
  market?: string; // Market name (市场, e.g., "上海"/"深圳")

  // Execution details / 执行详情
  signalPrice: number; // Price when signal triggered (信号触发时的价格)
  executePrice: number; // Actual execution price with slippage (实际成交价含滑点)
  slippage: number; // Slippage amount (滑点金额)
  slippagePercent: number; // Slippage percentage (滑点百分比)
  commission: number; // Commission paid (手续费)
  commissionPercent: number; // Commission percentage (手续费百分比)
  totalCost: number; // Total transaction cost (总交易成本)

  // Quantity calculation / 数量计算过程
  lotCalculation: LotCalculation; // Lot size calculation details (手数计算详情)
  requestedQuantity: number; // Original calculated quantity (原始计算数量)
  actualQuantity: number; // Actual traded quantity after lot rounding (实际成交数量)
  lots: number; // Number of lots (手数, Phase 7 新增)
  lotSize: number; // Shares per lot (每手股数, Phase 7 新增)
  quantityUnit: string; // Unit for display (显示单位: "股"/"手"/"张", Phase 7 新增)
  orderValue: number; // Order value = quantity * price (订单金额, Phase 7 新增)

  // Position changes / 持仓变化
  cashBefore: number;
  cashAfter: number;
  positionBefore: number;
  positionAfter: number;
  portfolioValueBefore: number;
  portfolioValueAfter: number;

  // P&L for sell trades / 卖出交易的盈亏
  pnl?: number; // Profit/Loss amount (盈亏金额)
  pnlPercent?: number; // Profit/Loss percentage (盈亏百分比)
  holdingDays?: number; // Days held (持有天数)
  entryTradeId?: string; // Reference to entry trade (关联的买入交易ID)

  // Signal information / 信号信息
  triggerReason: string; // Signal trigger reason (触发原因)
  indicatorValues: Record<string, number>; // Indicator values at trigger (触发时的指标值)
  strategyName?: string; // Strategy name (策略名称, Phase 7 新增)
}

/**
 * Daily backtest log entry
 * 每日回测日志条目
 */
export interface BacktestDailyLog {
  // Bar info / K线信息
  bar: number; // Bar index (K线索引)
  date: string; // Date string (日期)
  time: number; // Unix timestamp

  // OHLCV data / OHLCV数据
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Indicators / 指标值
  indicators: {
    sma5?: number;
    sma10?: number;
    sma20?: number;
    sma60?: number;
    ema12?: number;
    ema26?: number;
    rsi?: number;
    macdDif?: number;
    macdDea?: number;
    macdHist?: number;
    bollUpper?: number;
    bollMiddle?: number;
    bollLower?: number;
    [key: string]: number | undefined;
  };

  // Signal / 信号
  signal: "buy" | "sell" | null;
  signalReason: string | null;
  signalStrength?: number; // Signal confidence 0-100 (信号强度)

  // Action taken / 采取的操作
  action: string; // Human readable action description (可读的操作描述)
  actionDetail?: string; // Detailed action info (详细操作信息)

  // Portfolio state / 投资组合状态
  cash: number;
  position: number;
  positionValue: number;
  portfolioValue: number;
  portfolioReturn: number; // Return since start (累计收益率)
  dailyReturn: number; // Daily return (日收益率)

  // Risk metrics / 风险指标
  drawdown: number; // Current drawdown percentage (当前回撤)
  peakValue: number; // Peak portfolio value (峰值)
}

/**
 * Backtest execution summary
 * 回测执行摘要
 */
export interface BacktestSummary {
  // Time info / 时间信息
  startDate: string;
  endDate: string;
  tradingDays: number;
  executionTime: number; // in milliseconds

  // Capital info / 资金信息
  initialCapital: number;
  finalCapital: number;
  peakCapital: number;
  troughCapital: number;

  // Return metrics / 收益指标
  totalReturn: number;
  annualizedReturn: number;
  monthlyReturn: number;
  dailyReturn: number;

  // Risk metrics / 风险指标
  maxDrawdown: number;
  maxDrawdownDuration: number; // Days (最大回撤持续天数)
  volatility: number; // Annualized volatility (年化波动率)
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number; // Annualized return / Max drawdown

  // Trade metrics / 交易指标
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldingPeriod: number;

  // Best/Worst trades / 最佳/最差交易
  maxSingleWin: number;
  maxSingleWinDate: string;
  maxSingleLoss: number;
  maxSingleLossDate: string;

  // Commission & Slippage / 手续费和滑点
  totalCommission: number;
  totalSlippage: number;
  totalTradingCost: number;
  tradingCostPercent: number;

  // Benchmark comparison / 基准对比
  benchmarkReturn?: number; // Benchmark buy-and-hold return (基准买持收益)
  alpha?: number; // Strategy return - benchmark return (超额收益)
  beta?: number; // Regression coefficient vs benchmark (回归系数)
  informationRatio?: number; // Excess return / tracking error (信息比率)

  // Walk-forward analysis / Walk-Forward 样本分割
  inSampleMetrics?: BacktestSummary; // In-sample (training) period metrics
  outOfSampleMetrics?: BacktestSummary; // Out-of-sample (test) period metrics
  splitDate?: string; // Date splitting in-sample and out-of-sample
}

/**
 * Complete backtest result with all details
 * 包含所有详情的完整回测结果
 */
export interface EnhancedBacktestResult {
  // Summary / 摘要
  summary: BacktestSummary;

  // Time series data / 时间序列数据
  equityCurve: Array<{
    date: string;
    equity: number;
    drawdown: number;
    position: number;
    cash: number;
  }>;

  // Detailed trades / 详细交易记录
  trades: DetailedTrade[];

  // Daily logs / 每日日志
  dailyLogs: BacktestDailyLog[];

  // Configuration / 配置信息
  config: BacktestConfig;
  strategy: ParsedStrategy;

  // Lot size info / 手数信息
  lotSizeInfo: {
    assetType: string;
    lotSize: number;
    description: string;
  };
}

// =============================================================================
// EQUITY TYPES / 净值类型
// =============================================================================

/**
 * Daily equity snapshot
 */
export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  position: number;
}

/**
 * Strategy signal
 */
export interface StrategySignal {
  action: "buy" | "sell" | "hold";
  size?: number; // Position size (default: all-in)
  stopLoss?: number; // Stop loss price
  takeProfit?: number; // Take profit price
  reason?: string; // Signal reason
  strength?: number; // Signal strength 0-100
  indicatorValues?: Record<string, number>;
}

// =============================================================================
// MULTI-LEVEL TARGET TYPES / 多层级标的类型
// =============================================================================

/**
 * Backtest target mode
 * 回测标的模式
 */
export type BacktestTargetMode = "single" | "multi" | "sector" | "portfolio" | "stock";

/**
 * Sector filter configuration
 * 板块过滤配置
 */
export interface SectorFilter {
  minMarketCap?: number; // Minimum market cap in billions (最小市值，亿元)
  maxMarketCap?: number; // Maximum market cap in billions (最大市值，亿元)
  excludeST?: boolean; // Exclude ST stocks (排除ST股票)
  excludeNew?: boolean; // Exclude stocks listed < 1 year (排除次新股)
  minPrice?: number; // Minimum stock price (最小股价)
  maxPrice?: number; // Maximum stock price (最大股价)
}

/**
 * Sector target configuration
 * 板块标的配置
 */
export interface SectorTarget {
  code: string; // Sector code (板块代码)
  name: string; // Sector name (板块名称)
  type: "industry" | "concept"; // Sector type (板块类型)
  stockCount?: number; // Number of constituent stocks (成分股数量)
  filters?: SectorFilter; // Filter conditions (过滤条件)
}

/**
 * Individual stock target configuration
 * 个股标的配置
 */
export interface StockTarget {
  symbol: string; // Stock code (股票代码)
  name: string; // Stock name (股票名称)
  market: "SH" | "SZ" | "BJ"; // Market (市场)
}

/**
 * Portfolio stock with weight
 * 组合中的股票（含权重）
 */
export interface PortfolioStock {
  symbol: string;
  name: string;
  weight?: number; // Weight in portfolio (0-100, optional)
}

/**
 * Portfolio target configuration
 * 组合标的配置
 */
export interface PortfolioTarget {
  id?: string; // Portfolio ID for saved portfolios
  name: string; // Portfolio name
  stocks: PortfolioStock[];
}

/**
 * Unified backtest target selector
 * 统一回测标的选择器
 */
export interface BacktestTarget {
  mode: BacktestTargetMode;
  sector?: SectorTarget;
  stock?: StockTarget;
  portfolio?: PortfolioTarget;
}

// =============================================================================
// ENHANCED METRICS TYPES / 增强指标类型
// =============================================================================

/**
 * Return metrics category
 * 收益类指标
 */
export interface ReturnMetrics {
  totalReturn: number; // Total return (总收益率)
  annualizedReturn: number; // Annualized return (年化收益率)
  monthlyReturns: number[]; // Monthly return array (月度收益数组)
  alpha?: number; // Alpha vs benchmark (超额收益)
  returnVolatility: number; // Return volatility (收益波动率)
  bestMonth?: number; // Best monthly return (最佳月度收益)
  worstMonth?: number; // Worst monthly return (最差月度收益)
}

/**
 * Risk metrics category
 * 风险类指标
 */
export interface RiskMetrics {
  maxDrawdown: number; // Maximum drawdown (最大回撤)
  maxDrawdownDuration: number; // Drawdown duration in days (回撤持续天数)
  drawdownRecoveryDays?: number; // Days to recover from max drawdown (恢复天数)
  sharpeRatio: number; // Sharpe ratio (夏普比率)
  sortinoRatio: number; // Sortino ratio (索提诺比率)
  calmarRatio: number; // Calmar ratio (卡玛比率)
  var95?: number; // Value at Risk 95% (95% VaR)
  var99?: number; // Value at Risk 99% (99% VaR)
  cvar?: number; // Conditional VaR (条件VaR)
  beta?: number; // Beta vs benchmark (贝塔)
}

/**
 * Trading metrics category
 * 交易类指标
 */
export interface TradingMetrics {
  totalTrades: number; // Total number of trades (总交易次数)
  winningTrades: number; // Number of winning trades (盈利次数)
  losingTrades: number; // Number of losing trades (亏损次数)
  winRate: number; // Win rate percentage (胜率)
  profitFactor: number; // Profit factor / Payoff ratio (盈亏比)
  avgWin: number; // Average winning trade (平均盈利)
  avgLoss: number; // Average losing trade (平均亏损)
  avgHoldingDays: number; // Average holding period (平均持仓天数)
  maxConsecutiveWins: number; // Max consecutive wins (最大连胜)
  maxConsecutiveLosses: number; // Max consecutive losses (最大连亏)
  maxSingleWin: number; // Largest single win (最大单笔盈利)
  maxSingleLoss: number; // Largest single loss (最大单笔亏损)
  tradingFrequency: number; // Trades per month (月均交易次数)
}

/**
 * Individual stock result in sector backtest
 * 板块回测中的个股结果
 */
export interface StockBacktestResult {
  symbol: string;
  name: string;
  totalReturn: number;
  winRate: number;
  tradeCount: number;
  contribution: number; // Contribution to portfolio return (贡献度)
  sharpeRatio: number;
  maxDrawdown: number;
}

/**
 * Sector-level aggregated result
 * 板块级汇总结果
 */
export interface SectorAggregatedResult {
  sectorCode: string;
  sectorName: string;
  stockCount: number;
  backtestCount: number; // Stocks actually backtested

  // Aggregated metrics
  avgReturn: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  avgWinRate: number;
  avgSharpeRatio: number;

  // Stock rankings
  stockResults: StockBacktestResult[];
  topPerformers: StockBacktestResult[];
  bottomPerformers: StockBacktestResult[];

  // Benchmark comparison
  benchmarkReturn?: number;
  alphaVsBenchmark?: number;
}

// =============================================================================
// DIAGNOSTIC SYSTEM TYPES / 诊断系统类型
// =============================================================================

/**
 * Diagnostic severity level
 * 诊断严重级别
 */
export type DiagnosticSeverity = "info" | "warning" | "error";

/**
 * Diagnostic result item
 * 诊断结果项
 */
export interface DiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  message: string; // Chinese message
  messageEn: string; // English message
  currentValue: string; // Current value display
  suggestion: string; // Improvement suggestion
  relatedParams?: string[]; // Related strategy parameters
}

/**
 * Strategy highlight (positive findings)
 * 策略亮点
 */
export interface StrategyHighlight {
  id: string;
  message: string;
  messageEn: string;
  value: string;
}

/**
 * Complete diagnostic report
 * 完整诊断报告
 */
export interface DiagnosticReport {
  timestamp: number;
  issues: DiagnosticItem[];
  highlights: StrategyHighlight[];
  overallScore: number; // 0-100 overall health score
  riskLevel: "low" | "medium" | "high";
}

// =============================================================================
// SENSITIVITY ANALYSIS TYPES / 敏感性分析类型
// =============================================================================

/**
 * Single parameter sensitivity test result
 * 单参数敏感性测试结果
 */
export interface ParameterSensitivityPoint {
  paramValue: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

/**
 * Single parameter sensitivity analysis result
 * 单参数敏感性分析结果
 */
export interface SingleParameterSensitivity {
  paramName: string;
  paramLabel: string; // Display label (显示标签)
  baseValue: number;
  testRange: { min: number; max: number; step: number };
  results: ParameterSensitivityPoint[];
  optimalValue: number;
  optimalReturn: number;
  recommendation: string;
  stabilityScore: number; // 0-100, higher = more stable
}

/**
 * Dual parameter heatmap cell
 * 双参数热力图单元格
 */
export interface HeatmapCell {
  param1Value: number;
  param2Value: number;
  totalReturn: number;
  isOptimal: boolean;
}

/**
 * Dual parameter sensitivity analysis result
 * 双参数敏感性分析结果
 */
export interface DualParameterSensitivity {
  param1Name: string;
  param1Label: string;
  param1Values: number[];
  param2Name: string;
  param2Label: string;
  param2Values: number[];
  heatmapData: HeatmapCell[][];
  optimalCombination: {
    param1: number;
    param2: number;
    return: number;
  };
}

/**
 * Complete sensitivity analysis report
 * 完整敏感性分析报告
 */
export interface SensitivityReport {
  singleParams: SingleParameterSensitivity[];
  dualParams?: DualParameterSensitivity;
  overallRecommendation: string;
  parameterStability: "stable" | "moderate" | "unstable";
}

// =============================================================================
// UNIFIED BACKTEST REQUEST/RESPONSE / 统一回测请求响应
// =============================================================================

/**
 * Strategy type for backtest
 * 回测策略类型
 */
export type StrategyType = "builtin" | "custom" | "nlp";

/**
 * Unified backtest request
 * 统一回测请求
 */
export interface UnifiedBacktestRequest {
  // Target selection
  target: BacktestTarget;

  // Strategy configuration
  strategy: {
    type: StrategyType;
    builtinId?: string; // e.g., "macd_golden_cross"
    customCode?: string; // Custom strategy code
    nlpDescription?: string; // Natural language description
    params?: Record<string, number>; // Strategy parameters
  };

  // Backtest configuration
  config: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    holdingDays?: number;
    commission?: number;
    slippage?: number;
    timeframe?: "1d" | "60m" | "30m" | "15m" | "5m";
  };

  // Advanced options
  options?: {
    includeTransactionCosts?: boolean;
    calculateSensitivity?: boolean;
    sensitivityParams?: Array<{
      name: string;
      values: number[];
    }>;
    includeDiagnostics?: boolean;
    includeBenchmarkComparison?: boolean;
    benchmarkSymbol?: string;
  };
}

/**
 * Backtest progress update (for WebSocket)
 * 回测进度更新
 */
export interface BacktestProgress {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  phase:
    | "init"
    | "fetching_data"
    | "running_backtest"
    | "calculating_stats"
    | "generating_report";
  progress: number; // 0-100
  message?: string;
  currentStock?: string;
  currentStockIndex?: number;
  totalStocks?: number;
  partialResults?: Partial<UnifiedBacktestResult>;
  error?: string;
}

/**
 * Unified backtest result
 * 统一回测结果
 */
export interface UnifiedBacktestResult {
  // Job info
  jobId: string;
  timestamp: number;
  executionTime: number;

  // Target info
  target: BacktestTarget;

  // Aggregated metrics (4 categories)
  returnMetrics: ReturnMetrics;
  riskMetrics: RiskMetrics;
  tradingMetrics: TradingMetrics;

  // Equity curve
  equityCurve: Array<{
    date: string;
    equity: number;
    benchmark?: number;
    drawdown: number;
  }>;

  // Mode-specific results
  sectorResult?: SectorAggregatedResult; // For sector mode
  stockResults?: StockBacktestResult[]; // For portfolio mode

  // Detailed trades (for stock mode or drill-down)
  trades?: DetailedTrade[];

  // Diagnostics
  diagnostics?: DiagnosticReport;

  // Sensitivity analysis
  sensitivity?: SensitivityReport;

  // Configuration used
  config: BacktestConfig;
  strategy: ParsedStrategy;
}

// =============================================================================
// COMPARISON TYPES / 对比类型
// =============================================================================

/**
 * Backtest comparison item
 * 回测对比项
 */
export interface ComparisonItem {
  id: string;
  name: string;
  result: UnifiedBacktestResult;
  color?: string; // For chart display
}

/**
 * Metric comparison row
 * 指标对比行
 */
export interface MetricComparison {
  metricName: string;
  metricLabel: string;
  values: Array<{
    itemId: string;
    value: number | string;
    isBest?: boolean;
    isWorst?: boolean;
  }>;
}

/**
 * Complete comparison report
 * 完整对比报告
 */
export interface ComparisonReport {
  items: ComparisonItem[];
  metricComparisons: MetricComparison[];
  winner: {
    byReturn: string;
    byRisk: string;
    bySharpRatio: string;
    overall: string;
  };
}

// =============================================================================
// BACKWARD COMPATIBILITY / 向后兼容
// =============================================================================

/**
 * Legacy trade record (for backward compatibility)
 * 旧版交易记录（向后兼容）
 */
export interface BacktestTrade {
  id: string;
  type: "buy" | "sell";
  price: number;
  size: number;
  timestamp: number;
  reason: string;
  pnl?: number;
  pnlPercent?: number;
}

/**
 * Legacy backtest result (for backward compatibility)
 * 旧版回测结果（向后兼容）
 */
export interface BacktestResult {
  // Summary metrics
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalTrades: number;

  // Detailed metrics
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldingPeriod: number;
  maxSingleWin: number;
  maxSingleLoss: number;

  // Time series data
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];

  // Config info
  config: BacktestConfig;
  strategy: ParsedStrategy;
  executionTime: number;

  // Enhanced data (optional, for gradual migration)
  enhanced?: EnhancedBacktestResult;

  // Backtest metadata (Phase 14 UX enhancement)
  // 回测元数据（Phase 14 用户体验增强）
  backtestMeta?: {
    // Target information / 标的信息
    targetSymbol: string; // Stock code (股票代码, e.g., "600519")
    targetName: string; // Stock name (股票名称, e.g., "贵州茅台")
    targetMarket?: string; // Market (市场, e.g., "SH"/"SZ"/"BJ")

    // Data source information / 数据来源信息
    dataSource: string; // Data source description (数据来源描述)
    dataSourceType: "historical" | "simulated" | "mixed"; // Data type (数据类型)

    // Time range information / 时间范围信息
    timeRange: {
      start: string; // Start date (开始日期, ISO format)
      end: string; // End date (结束日期, ISO format)
      totalDays: number; // Total calendar days (总天数)
      tradingDays: number; // Effective trading days (有效交易日)
      weekendDays: number; // Weekend days excluded (排除周末天数)
      holidayDays: number; // Holiday days excluded (排除节假日天数)
    };

    // Data quality information / 数据质量信息
    dataQuality: {
      completeness: number; // Data completeness 0-1 (数据完整性 0-1)
      missingDays: number; // Number of missing trading days (缺失交易日数量)
      missingDates?: string[]; // List of missing dates (缺失日期列表)
      dataPoints: number; // Total data points (总数据点数)
    };

    // Trading cost configuration / 交易成本配置
    tradingCosts: {
      commission: number; // Commission rate (手续费率)
      commissionType: "percent" | "fixed"; // Commission type (手续费类型)
      slippage: number; // Slippage rate (滑点率)
      slippageType: "percent" | "fixed"; // Slippage type (滑点类型)
      stampDuty?: number; // Stamp duty rate (印花税率, 仅卖出时)
    };

    // Capital configuration / 资金配置
    capitalConfig: {
      initialCapital: number; // Initial capital (初始资金)
      leverageRatio?: number; // Leverage ratio (杠杆倍数, optional)
      marginRequirement?: number; // Margin requirement (保证金比例, optional)
    };

    // Execution configuration / 执行配置
    executionConfig: {
      priceType: "close" | "open" | "vwap"; // Execution price type (执行价类型)
      orderType: "market" | "limit"; // Order type (订单类型)
      timeframe: string; // Timeframe (时间周期, e.g., "1d")
    };

    // Generation timestamp / 生成时间戳
    generatedAt: number; // Unix timestamp (生成时间)
    version: string; // Backtest engine version (回测引擎版本)
  };
}
