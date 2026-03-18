/**
 * Backtest Error Handling System
 * 回测错误处理系统
 *
 * Provides standardized error codes, messages, and utilities
 * 提供标准化的错误代码、消息和工具
 *
 * @module lib/backtest/core/errors
 */

import type { ErrorInfo } from "./interfaces";

// =============================================================================
// ERROR CODES / 错误代码
// =============================================================================

/**
 * Error codes for backtest system
 * 回测系统错误代码
 *
 * Format: BTXXX where:
 * - BT1XX: Validation errors (验证错误)
 * - BT2XX: Data errors (数据错误)
 * - BT3XX: Calculation errors (计算错误)
 * - BT4XX: Engine errors (引擎错误)
 * - BT5XX: Network errors (网络错误)
 * - BT9XX: System errors (系统错误)
 */
export enum BacktestErrorCode {
  // Validation errors (BT1XX) / 验证错误
  INVALID_REQUEST = "BT100",
  INVALID_TARGET = "BT101",
  INVALID_DATE_RANGE = "BT102",
  INVALID_CAPITAL = "BT103",
  INVALID_STRATEGY = "BT104",
  EMPTY_PORTFOLIO = "BT105",
  PORTFOLIO_TOO_LARGE = "BT106",
  INVALID_SYMBOL = "BT107",
  INVALID_PARAMS = "BT108",
  DUPLICATE_SYMBOL = "BT109",

  // Data errors (BT2XX) / 数据错误
  DATA_FETCH_FAILED = "BT200",
  INSUFFICIENT_DATA = "BT201",
  DATA_QUALITY_ISSUE = "BT202",
  SYMBOL_NOT_FOUND = "BT203",
  SYMBOL_DELISTED = "BT204",
  SYMBOL_SUSPENDED = "BT205",
  NO_TRADING_DAYS = "BT206",
  DATA_TOO_OLD = "BT207",

  // Calculation errors (BT3XX) / 计算错误
  CALCULATION_ERROR = "BT300",
  DIVISION_BY_ZERO = "BT301",
  PRECISION_OVERFLOW = "BT302",
  INVALID_METRIC = "BT303",
  NO_TRADES = "BT304",

  // Engine errors (BT4XX) / 引擎错误
  ENGINE_TIMEOUT = "BT400",
  ENGINE_UNAVAILABLE = "BT401",
  JOB_NOT_FOUND = "BT402",
  JOB_CANCELLED = "BT403",
  ENGINE_BUSY = "BT404",
  STRATEGY_ERROR = "BT405",

  // Network errors (BT5XX) / 网络错误
  NETWORK_ERROR = "BT500",
  API_RATE_LIMITED = "BT501",
  API_UNAUTHORIZED = "BT502",
  API_TIMEOUT = "BT503",

  // System errors (BT9XX) / 系统错误
  INTERNAL_ERROR = "BT900",
  NOT_IMPLEMENTED = "BT901",
  UNKNOWN_ERROR = "BT999",
}

// =============================================================================
// ERROR MESSAGES / 错误消息
// =============================================================================

/**
 * Error message mapping with Chinese, English and suggestions
 * 错误消息映射（含中英文和建议）
 */
export const ERROR_MESSAGES: Record<
  BacktestErrorCode,
  { zh: string; en: string; suggestion: string }
> = {
  // Validation errors
  [BacktestErrorCode.INVALID_REQUEST]: {
    zh: "请求参数无效",
    en: "Invalid request parameters",
    suggestion: "请检查所有必填参数是否正确填写",
  },
  [BacktestErrorCode.INVALID_TARGET]: {
    zh: "请选择回测标的",
    en: "Please select a backtest target",
    suggestion: "在标的选择区选择板块、个股或组合",
  },
  [BacktestErrorCode.INVALID_DATE_RANGE]: {
    zh: "日期范围无效",
    en: "Invalid date range",
    suggestion: "结束日期必须晚于开始日期，且不能超过今天",
  },
  [BacktestErrorCode.INVALID_CAPITAL]: {
    zh: "初始资金无效",
    en: "Invalid initial capital",
    suggestion: "初始资金必须大于10,000元且小于1000亿元",
  },
  [BacktestErrorCode.INVALID_STRATEGY]: {
    zh: "策略配置无效",
    en: "Invalid strategy configuration",
    suggestion: "请检查策略类型和参数是否正确",
  },
  [BacktestErrorCode.EMPTY_PORTFOLIO]: {
    zh: "组合中没有股票",
    en: "Portfolio is empty",
    suggestion: "请至少添加一只股票到组合中",
  },
  [BacktestErrorCode.PORTFOLIO_TOO_LARGE]: {
    zh: "组合股票数量超过限制",
    en: "Portfolio has too many stocks",
    suggestion: "组合最多支持50只股票，请减少股票数量",
  },
  [BacktestErrorCode.INVALID_SYMBOL]: {
    zh: "股票代码格式无效",
    en: "Invalid stock symbol format",
    suggestion: "股票代码应为6位数字",
  },
  [BacktestErrorCode.INVALID_PARAMS]: {
    zh: "策略参数无效",
    en: "Invalid strategy parameters",
    suggestion: "请检查参数值是否在有效范围内",
  },
  [BacktestErrorCode.DUPLICATE_SYMBOL]: {
    zh: "组合中存在重复股票",
    en: "Duplicate stocks in portfolio",
    suggestion: "请移除重复的股票",
  },

  // Data errors
  [BacktestErrorCode.DATA_FETCH_FAILED]: {
    zh: "数据获取失败",
    en: "Failed to fetch data",
    suggestion: "请检查网络连接或稍后重试",
  },
  [BacktestErrorCode.INSUFFICIENT_DATA]: {
    zh: "数据不足，无法完成回测",
    en: "Insufficient data for backtest",
    suggestion: "请扩大日期范围或选择数据更完整的标的",
  },
  [BacktestErrorCode.DATA_QUALITY_ISSUE]: {
    zh: "数据质量问题",
    en: "Data quality issues detected",
    suggestion: "数据存在缺失或异常，回测结果可能不准确",
  },
  [BacktestErrorCode.SYMBOL_NOT_FOUND]: {
    zh: "未找到该股票",
    en: "Stock symbol not found",
    suggestion: "请检查股票代码是否正确",
  },
  [BacktestErrorCode.SYMBOL_DELISTED]: {
    zh: "该股票已退市",
    en: "Stock has been delisted",
    suggestion: "请选择其他在市股票",
  },
  [BacktestErrorCode.SYMBOL_SUSPENDED]: {
    zh: "该股票长期停牌",
    en: "Stock is suspended for long period",
    suggestion: "该股票在回测期间大部分时间停牌，无法有效回测",
  },
  [BacktestErrorCode.NO_TRADING_DAYS]: {
    zh: "选定期间无交易日",
    en: "No trading days in selected period",
    suggestion: "请选择包含交易日的日期范围",
  },
  [BacktestErrorCode.DATA_TOO_OLD]: {
    zh: "数据过于陈旧",
    en: "Data is too old",
    suggestion: "部分股票历史数据不足，建议调整回测起始日期",
  },

  // Calculation errors
  [BacktestErrorCode.CALCULATION_ERROR]: {
    zh: "指标计算错误",
    en: "Metrics calculation error",
    suggestion: "请联系技术支持",
  },
  [BacktestErrorCode.DIVISION_BY_ZERO]: {
    zh: "计算错误：除数为零",
    en: "Calculation error: division by zero",
    suggestion: "数据异常导致计算失败，请检查输入参数",
  },
  [BacktestErrorCode.PRECISION_OVERFLOW]: {
    zh: "数值精度溢出",
    en: "Numeric precision overflow",
    suggestion: "资金或收益率数值超出计算范围",
  },
  [BacktestErrorCode.INVALID_METRIC]: {
    zh: "指标值异常",
    en: "Invalid metric value",
    suggestion: "部分指标无法正常计算，请检查数据",
  },
  [BacktestErrorCode.NO_TRADES]: {
    zh: "回测期间无交易信号",
    en: "No trade signals during backtest period",
    suggestion: "策略在该标的/时间段内未产生任何交易信号，请调整策略参数或选择其他标的",
  },

  // Engine errors
  [BacktestErrorCode.ENGINE_TIMEOUT]: {
    zh: "回测执行超时",
    en: "Backtest execution timeout",
    suggestion: "请减少回测范围或稍后重试",
  },
  [BacktestErrorCode.ENGINE_UNAVAILABLE]: {
    zh: "回测引擎暂不可用",
    en: "Backtest engine is unavailable",
    suggestion: "系统维护中，请稍后重试",
  },
  [BacktestErrorCode.JOB_NOT_FOUND]: {
    zh: "未找到回测任务",
    en: "Backtest job not found",
    suggestion: "任务可能已过期或被清理",
  },
  [BacktestErrorCode.JOB_CANCELLED]: {
    zh: "回测已取消",
    en: "Backtest was cancelled",
    suggestion: "您已取消此次回测",
  },
  [BacktestErrorCode.ENGINE_BUSY]: {
    zh: "回测引擎繁忙",
    en: "Backtest engine is busy",
    suggestion: "当前用户较多，请稍后重试",
  },
  [BacktestErrorCode.STRATEGY_ERROR]: {
    zh: "策略执行错误",
    en: "Strategy execution error",
    suggestion: "策略代码存在错误，请检查策略逻辑",
  },

  // Network errors
  [BacktestErrorCode.NETWORK_ERROR]: {
    zh: "网络连接失败",
    en: "Network connection failed",
    suggestion: "请检查网络连接后重试",
  },
  [BacktestErrorCode.API_RATE_LIMITED]: {
    zh: "请求过于频繁",
    en: "Request rate limited",
    suggestion: "请稍后再试",
  },
  [BacktestErrorCode.API_UNAUTHORIZED]: {
    zh: "未授权访问",
    en: "Unauthorized access",
    suggestion: "请重新登录",
  },
  [BacktestErrorCode.API_TIMEOUT]: {
    zh: "接口响应超时",
    en: "API response timeout",
    suggestion: "服务响应较慢，请稍后重试",
  },

  // System errors
  [BacktestErrorCode.INTERNAL_ERROR]: {
    zh: "系统内部错误",
    en: "Internal system error",
    suggestion: "请联系技术支持",
  },
  [BacktestErrorCode.NOT_IMPLEMENTED]: {
    zh: "功能暂未实现",
    en: "Feature not implemented",
    suggestion: "此功能即将上线",
  },
  [BacktestErrorCode.UNKNOWN_ERROR]: {
    zh: "未知错误",
    en: "Unknown error",
    suggestion: "请稍后重试或联系技术支持",
  },
};

// =============================================================================
// ERROR UTILITIES / 错误工具函数
// =============================================================================

/**
 * Create standardized error info
 * 创建标准化错误信息
 */
export function createBacktestError(
  code: BacktestErrorCode,
  details?: unknown,
  overrides?: Partial<Omit<ErrorInfo, "code">>
): ErrorInfo {
  const msg =
    ERROR_MESSAGES[code] || ERROR_MESSAGES[BacktestErrorCode.UNKNOWN_ERROR];

  return {
    code,
    message: overrides?.message || msg.zh,
    messageEn: overrides?.messageEn || msg.en,
    details,
    recoverable: isRecoverableError(code),
    suggestedAction: overrides?.suggestedAction || msg.suggestion,
  };
}

/**
 * Check if error is recoverable (user can retry)
 * 检查错误是否可恢复（用户可以重试）
 */
export function isRecoverableError(code: BacktestErrorCode): boolean {
  // System errors (BT9XX) are generally not recoverable
  if (code.startsWith("BT9")) return false;

  // Specific non-recoverable errors
  const nonRecoverable = [
    BacktestErrorCode.SYMBOL_DELISTED,
    BacktestErrorCode.NOT_IMPLEMENTED,
  ];

  return !nonRecoverable.includes(code);
}

/**
 * Get error severity level
 * 获取错误严重级别
 */
export function getErrorSeverity(
  code: BacktestErrorCode
): "info" | "warning" | "error" {
  // Info level - user action needed but not critical
  const infoErrors = [
    BacktestErrorCode.NO_TRADES,
    BacktestErrorCode.JOB_CANCELLED,
    BacktestErrorCode.NOT_IMPLEMENTED,
  ];
  if (infoErrors.includes(code)) return "info";

  // Warning level - can proceed with caution
  const warningErrors = [
    BacktestErrorCode.DATA_QUALITY_ISSUE,
    BacktestErrorCode.INSUFFICIENT_DATA,
    BacktestErrorCode.SYMBOL_SUSPENDED,
    BacktestErrorCode.ENGINE_BUSY,
    BacktestErrorCode.API_RATE_LIMITED,
  ];
  if (warningErrors.includes(code)) return "warning";

  // Error level - cannot proceed
  return "error";
}

/**
 * Format error for display
 * 格式化错误用于显示
 */
export function formatError(error: ErrorInfo, locale: "zh" | "en" = "zh"): string {
  const message = locale === "zh" ? error.message : error.messageEn;
  return `[${error.code}] ${message}`;
}

/**
 * Format error with suggestion
 * 格式化错误并附带建议
 */
export function formatErrorWithSuggestion(
  error: ErrorInfo,
  locale: "zh" | "en" = "zh"
): string {
  const formatted = formatError(error, locale);
  if (error.suggestedAction) {
    return `${formatted}\n${locale === "zh" ? "建议" : "Suggestion"}: ${error.suggestedAction}`;
  }
  return formatted;
}

// =============================================================================
// ERROR CLASS / 错误类
// =============================================================================

/**
 * Backtest Error class for throwing
 * 回测错误类（用于抛出）
 */
export class BacktestError extends Error {
  public readonly code: BacktestErrorCode;
  public readonly errorInfo: ErrorInfo;

  constructor(code: BacktestErrorCode, details?: unknown) {
    const errorInfo = createBacktestError(code, details);
    super(errorInfo.message);
    this.name = "BacktestError";
    this.code = code;
    this.errorInfo = errorInfo;
  }

  /**
   * Get error info for API response
   * 获取用于API响应的错误信息
   */
  toErrorInfo(): ErrorInfo {
    return this.errorInfo;
  }

  /**
   * Check if error is recoverable
   * 检查错误是否可恢复
   */
  isRecoverable(): boolean {
    return isRecoverableError(this.code);
  }

  /**
   * Get error severity
   * 获取错误严重级别
   */
  getSeverity(): "info" | "warning" | "error" {
    return getErrorSeverity(this.code);
  }
}

// =============================================================================
// ERROR HANDLING UTILITIES / 错误处理工具
// =============================================================================

/**
 * Wrap async function with error handling
 * 使用错误处理包装异步函数
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  defaultError: BacktestErrorCode = BacktestErrorCode.UNKNOWN_ERROR
): Promise<{ success: true; data: T } | { success: false; error: ErrorInfo }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof BacktestError) {
      return { success: false, error: error.errorInfo };
    }
    return {
      success: false,
      error: createBacktestError(
        defaultError,
        error instanceof Error ? error.message : error
      ),
    };
  }
}

/**
 * Assert condition or throw backtest error
 * 断言条件或抛出回测错误
 */
export function assertBacktest(
  condition: boolean,
  code: BacktestErrorCode,
  details?: unknown
): asserts condition {
  if (!condition) {
    throw new BacktestError(code, details);
  }
}

/**
 * Type guard for ErrorInfo
 * ErrorInfo 类型守卫
 */
export function isErrorInfo(value: unknown): value is ErrorInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "messageEn" in value
  );
}
