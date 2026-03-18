/**
 * Backtest Input Validators
 * 回测输入验证器
 *
 * Provides comprehensive validation using Zod schemas
 * 使用Zod schema提供全面的验证
 *
 * @module lib/backtest/core/validators
 */

import { z } from "zod";
import type { Result, ErrorInfo } from "./interfaces";
import {
  BacktestErrorCode,
  createBacktestError,
} from "./errors";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Minimum initial capital in CNY (最小初始资金，元) */
export const MIN_CAPITAL = 10000;

/** Maximum initial capital in CNY (最大初始资金，元) */
export const MAX_CAPITAL = 100_000_000_000; // 1000亿

/** Maximum stocks in portfolio (组合最大股票数) */
export const MAX_PORTFOLIO_SIZE = 50;

/** Minimum backtest days (最小回测天数) */
export const MIN_BACKTEST_DAYS = 5;

/** Maximum backtest years (最大回测年数) */
export const MAX_BACKTEST_YEARS = 20;

/** Valid markets (有效市场) */
export const VALID_MARKETS = ["SH", "SZ", "BJ"] as const;

/** Valid timeframes (有效时间周期) */
export const VALID_TIMEFRAMES = ["1d", "60m", "30m", "15m", "5m"] as const;

/** Valid strategy types (有效策略类型) */
export const VALID_STRATEGY_TYPES = ["builtin", "custom", "nlp"] as const;

// =============================================================================
// ZOD SCHEMAS / Zod Schema定义
// =============================================================================

/**
 * Stock symbol schema (6 digits)
 * 股票代码schema（6位数字）
 */
export const StockSymbolSchema = z
  .string()
  .regex(/^\d{6}$/, "股票代码必须为6位数字 / Stock symbol must be 6 digits");

/**
 * Date string schema (YYYY-MM-DD)
 * 日期字符串schema
 */
export const DateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "日期格式必须为YYYY-MM-DD / Date format must be YYYY-MM-DD"
  )
  .refine(
    (date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    },
    { message: "无效日期 / Invalid date" }
  );

/**
 * Sector filter schema
 * 板块过滤器schema
 */
export const SectorFilterSchema = z.object({
  excludeST: z.boolean().optional().default(true),
  excludeNew: z.boolean().optional().default(true),
  minMarketCap: z.number().positive().optional(),
  maxMarketCap: z.number().positive().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
});

/**
 * Sector target schema
 * 板块标的schema
 */
export const SectorTargetSchema = z.object({
  code: z.string().min(1, "板块代码不能为空 / Sector code is required"),
  name: z.string().min(1, "板块名称不能为空 / Sector name is required"),
  type: z.enum(["industry", "concept"]),
  stockCount: z.number().int().positive().optional(),
  filters: SectorFilterSchema.optional(),
});

/**
 * Stock target schema
 * 个股标的schema
 */
export const StockTargetSchema = z.object({
  symbol: StockSymbolSchema,
  name: z.string().min(1, "股票名称不能为空 / Stock name is required"),
  market: z.enum(VALID_MARKETS),
});

/**
 * Portfolio stock schema
 * 组合股票schema
 */
export const PortfolioStockSchema = z.object({
  symbol: StockSymbolSchema,
  name: z.string().min(1, "股票名称不能为空 / Stock name is required"),
  weight: z.number().min(0).max(100).optional(),
});

/**
 * Portfolio target schema
 * 组合标的schema
 */
export const PortfolioTargetSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string()
      .min(1, "组合名称不能为空 / Portfolio name is required")
      .max(50, "组合名称最多50个字符 / Portfolio name max 50 characters"),
    stocks: z
      .array(PortfolioStockSchema)
      .min(1, "组合至少需要1只股票 / Portfolio must have at least 1 stock")
      .max(
        MAX_PORTFOLIO_SIZE,
        `组合最多${MAX_PORTFOLIO_SIZE}只股票 / Portfolio max ${MAX_PORTFOLIO_SIZE} stocks`
      ),
  })
  .refine(
    (data) => {
      // Check for duplicate symbols
      const symbols = data.stocks.map((s) => s.symbol);
      return new Set(symbols).size === symbols.length;
    },
    { message: "组合中存在重复股票 / Duplicate stocks in portfolio" }
  );

/**
 * Backtest target schema
 * 回测标的schema
 */
export const BacktestTargetSchema = z
  .object({
    mode: z.enum(["sector", "stock", "portfolio"]),
    sector: SectorTargetSchema.optional(),
    stock: StockTargetSchema.optional(),
    portfolio: PortfolioTargetSchema.optional(),
  })
  .refine(
    (data) => {
      // Ensure correct field is present for mode
      switch (data.mode) {
        case "sector":
          return !!data.sector;
        case "stock":
          return !!data.stock;
        case "portfolio":
          return !!data.portfolio;
        default:
          return false;
      }
    },
    {
      message:
        "标的数据必须与选择的模式匹配 / Target data must match selected mode",
    }
  );

/**
 * Backtest config schema
 * 回测配置schema
 */
export const BacktestConfigSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    initialCapital: z
      .number()
      .min(MIN_CAPITAL, `初始资金最少${MIN_CAPITAL}元 / Minimum capital: ${MIN_CAPITAL}`)
      .max(MAX_CAPITAL, `初始资金最多${MAX_CAPITAL}元 / Maximum capital: ${MAX_CAPITAL}`),
    commission: z
      .number()
      .min(0, "手续费率不能为负 / Commission cannot be negative")
      .max(0.01, "手续费率不能超过1% / Commission cannot exceed 1%")
      .optional()
      .default(0.0003),
    slippage: z
      .number()
      .min(0, "滑点率不能为负 / Slippage cannot be negative")
      .max(0.05, "滑点率不能超过5% / Slippage cannot exceed 5%")
      .optional()
      .default(0.001),
    timeframe: z.enum(VALID_TIMEFRAMES).optional().default("1d"),
    holdingDays: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start < end;
    },
    { message: "结束日期必须晚于开始日期 / End date must be after start date" }
  )
  .refine(
    (data) => {
      const end = new Date(data.endDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return end <= today;
    },
    { message: "结束日期不能超过今天 / End date cannot be in the future" }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= MIN_BACKTEST_DAYS;
    },
    {
      message: `回测周期至少${MIN_BACKTEST_DAYS}天 / Backtest period must be at least ${MIN_BACKTEST_DAYS} days`,
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffYears =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return diffYears <= MAX_BACKTEST_YEARS;
    },
    {
      message: `回测周期不能超过${MAX_BACKTEST_YEARS}年 / Backtest period cannot exceed ${MAX_BACKTEST_YEARS} years`,
    }
  );

/**
 * Strategy schema
 * 策略schema
 */
export const StrategySchema = z
  .object({
    type: z.enum(VALID_STRATEGY_TYPES),
    builtinId: z.string().optional(),
    customCode: z.string().optional(),
    nlpDescription: z.string().optional(),
    params: z.record(z.number()).optional(),
  })
  .refine(
    (data) => {
      switch (data.type) {
        case "builtin":
          return !!data.builtinId;
        case "custom":
          return !!data.customCode && data.customCode.length > 0;
        case "nlp":
          return !!data.nlpDescription && data.nlpDescription.length > 0;
        default:
          return false;
      }
    },
    {
      message:
        "策略配置必须与类型匹配 / Strategy configuration must match type",
    }
  );

/**
 * Backtest options schema
 * 回测选项schema
 */
export const BacktestOptionsSchema = z.object({
  includeTransactionCosts: z.boolean().optional().default(true),
  calculateSensitivity: z.boolean().optional().default(false),
  sensitivityParams: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.number()),
      })
    )
    .optional(),
  includeDiagnostics: z.boolean().optional().default(true),
  includeBenchmarkComparison: z.boolean().optional().default(false),
  benchmarkSymbol: z.string().optional(),
});

/**
 * Unified backtest request schema
 * 统一回测请求schema
 */
export const UnifiedBacktestRequestSchema = z.object({
  target: BacktestTargetSchema,
  config: BacktestConfigSchema,
  strategy: StrategySchema,
  options: BacktestOptionsSchema.optional(),
});

// =============================================================================
// TYPE EXPORTS / 类型导出
// =============================================================================

export type ValidatedTarget = z.infer<typeof BacktestTargetSchema>;
export type ValidatedConfig = z.infer<typeof BacktestConfigSchema>;
export type ValidatedStrategy = z.infer<typeof StrategySchema>;
export type ValidatedRequest = z.infer<typeof UnifiedBacktestRequestSchema>;

// =============================================================================
// VALIDATION FUNCTIONS / 验证函数
// =============================================================================

/**
 * Validate backtest request
 * 验证回测请求
 */
export function validateBacktestRequest(
  request: unknown
): Result<ValidatedRequest> {
  const result = UnifiedBacktestRequestSchema.safeParse(request);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const errorCode = mapZodErrorToCode(firstError?.path || []);

    return {
      success: false,
      error: createBacktestError(errorCode, {
        zodErrors: result.error.errors,
        field: firstError?.path.join("."),
        message: firstError?.message,
      }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate target only
 * 仅验证标的
 */
export function validateTarget(target: unknown): Result<ValidatedTarget> {
  const result = BacktestTargetSchema.safeParse(target);

  if (!result.success) {
    return {
      success: false,
      error: createBacktestError(BacktestErrorCode.INVALID_TARGET, {
        zodErrors: result.error.errors,
      }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate config only
 * 仅验证配置
 */
export function validateConfig(config: unknown): Result<ValidatedConfig> {
  const result = BacktestConfigSchema.safeParse(config);

  if (!result.success) {
    const firstError = result.error.errors[0];
    let errorCode = BacktestErrorCode.INVALID_REQUEST;

    if (firstError?.path.includes("startDate") || firstError?.path.includes("endDate")) {
      errorCode = BacktestErrorCode.INVALID_DATE_RANGE;
    } else if (firstError?.path.includes("initialCapital")) {
      errorCode = BacktestErrorCode.INVALID_CAPITAL;
    }

    return {
      success: false,
      error: createBacktestError(errorCode, {
        zodErrors: result.error.errors,
      }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate strategy only
 * 仅验证策略
 */
export function validateStrategy(strategy: unknown): Result<ValidatedStrategy> {
  const result = StrategySchema.safeParse(strategy);

  if (!result.success) {
    return {
      success: false,
      error: createBacktestError(BacktestErrorCode.INVALID_STRATEGY, {
        zodErrors: result.error.errors,
      }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Map Zod error path to BacktestErrorCode
 * 将Zod错误路径映射到BacktestErrorCode
 */
function mapZodErrorToCode(path: (string | number)[]): BacktestErrorCode {
  const pathStr = path.join(".");

  if (pathStr.includes("target")) {
    if (pathStr.includes("portfolio.stocks")) {
      if (pathStr.includes("length") || path.length === 0) {
        return BacktestErrorCode.EMPTY_PORTFOLIO;
      }
      return BacktestErrorCode.PORTFOLIO_TOO_LARGE;
    }
    if (pathStr.includes("symbol")) {
      return BacktestErrorCode.INVALID_SYMBOL;
    }
    return BacktestErrorCode.INVALID_TARGET;
  }

  if (pathStr.includes("config")) {
    if (pathStr.includes("Date")) {
      return BacktestErrorCode.INVALID_DATE_RANGE;
    }
    if (pathStr.includes("initialCapital")) {
      return BacktestErrorCode.INVALID_CAPITAL;
    }
    return BacktestErrorCode.INVALID_REQUEST;
  }

  if (pathStr.includes("strategy")) {
    if (pathStr.includes("params")) {
      return BacktestErrorCode.INVALID_PARAMS;
    }
    return BacktestErrorCode.INVALID_STRATEGY;
  }

  return BacktestErrorCode.INVALID_REQUEST;
}

// =============================================================================
// SAFE MATH UTILITIES / 安全数学工具
// =============================================================================

/**
 * Safe division with zero check
 * 安全除法（检查除零）
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  defaultValue: number = 0
): number {
  if (denominator === 0 || !isFinite(denominator)) {
    return defaultValue;
  }
  const result = numerator / denominator;
  return isFinite(result) ? result : defaultValue;
}

/**
 * Safe percentage calculation
 * 安全百分比计算
 */
export function safePercent(
  part: number,
  whole: number,
  decimalPlaces: number = 2
): number {
  const result = safeDivide(part, whole, 0) * 100;
  return sanitizeMetric(result, { decimalPlaces });
}

/**
 * Validate and sanitize metric value
 * 验证并清理指标值
 */
export function sanitizeMetric(
  value: number,
  options: {
    min?: number;
    max?: number;
    defaultValue?: number;
    decimalPlaces?: number;
  } = {}
): number {
  const {
    min = -Infinity,
    max = Infinity,
    defaultValue = 0,
    decimalPlaces = 4,
  } = options;

  // Handle invalid values
  if (!isFinite(value) || isNaN(value)) {
    return defaultValue;
  }

  // Clamp to range
  const clamped = Math.max(min, Math.min(max, value));

  // Round to decimal places
  return Number(clamped.toFixed(decimalPlaces));
}

/**
 * Check if value is valid number
 * 检查值是否为有效数字
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && !isNaN(value);
}

/**
 * Ensure value is in valid range
 * 确保值在有效范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// =============================================================================
// DATE UTILITIES / 日期工具
// =============================================================================

/**
 * Get default start date (1 year ago)
 * 获取默认开始日期（1年前）
 */
export function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return formatDateString(date);
}

/**
 * Get today's date string
 * 获取今天的日期字符串
 */
export function getToday(): string {
  return formatDateString(new Date());
}

/**
 * Format date to YYYY-MM-DD string
 * 将日期格式化为YYYY-MM-DD字符串
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse date string to Date object
 * 将日期字符串解析为Date对象
 */
export function parseDateString(dateStr: string): Date | null {
  const result = DateStringSchema.safeParse(dateStr);
  if (!result.success) return null;
  return new Date(dateStr);
}

/**
 * Calculate trading days between dates (approximate)
 * 计算日期间的交易日数量（近似）
 */
export function estimateTradingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  // Approximate: 250 trading days per year, ~70% of calendar days
  return Math.floor(totalDays * 0.7);
}
