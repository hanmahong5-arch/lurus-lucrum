/**
 * Financial Data Formatters
 * 金融数据格式化工具
 *
 * Provides formatting functions for financial data with Decimal.js precision.
 * All calculations use Decimal.js to avoid JavaScript floating-point issues.
 *
 * @module lib/financial/formatters
 */

import Decimal from "decimal.js";
import {
  type Direction,
  type FinancialDataType,
  type FinancialDisplayData,
  type FinancialFormatOptions,
  PRECISION,
  DIRECTION_ARROWS,
  DIRECTION_SIGNS,
  DIRECTION_COLORS,
  DIRECTION_ARIA_LABELS,
} from "./types";

// =============================================================================
// DECIMAL CONFIGURATION
// =============================================================================

// Configure Decimal for financial calculations.
// This is the canonical config — other modules must NOT call Decimal.set().
const FINANCIAL_DECIMAL_CONFIG = {
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 15,
} as const;
Decimal.set(FINANCIAL_DECIMAL_CONFIG);

/**
 * Verify Decimal global config has not been tampered with.
 * Call this in critical financial paths if needed.
 */
export function assertDecimalConfig(): void {
  if (
    Decimal.precision !== FINANCIAL_DECIMAL_CONFIG.precision ||
    Decimal.rounding !== FINANCIAL_DECIMAL_CONFIG.rounding
  ) {
    throw new Error(
      `Decimal.js global config mismatch: expected precision=${FINANCIAL_DECIMAL_CONFIG.precision}, ` +
      `rounding=${FINANCIAL_DECIMAL_CONFIG.rounding}, ` +
      `got precision=${Decimal.precision}, rounding=${Decimal.rounding}. ` +
      `Another module may have called Decimal.set() — this is forbidden for financial calculations.`
    );
  }
}

// =============================================================================
// VALUE CONVERSION
// =============================================================================

/**
 * Convert input value to Decimal
 * 将输入值转换为 Decimal
 */
export function toDecimal(value: Decimal | string | number): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  // Guard against NaN and Infinity — degrade to zero
  if (typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

// =============================================================================
// DIRECTION DETERMINATION
// =============================================================================

/**
 * Determine price movement direction from value
 * 从值判断价格变动方向
 *
 * @param value - The numeric value to check
 * @returns Direction: 'up' for positive, 'down' for negative, 'neutral' for zero
 */
export function getDirection(value: Decimal | string | number): Direction {
  const decimal = toDecimal(value);

  if (decimal.isPositive() && !decimal.isZero()) {
    return "up";
  }
  if (decimal.isNegative()) {
    return "down";
  }
  return "neutral";
}

// =============================================================================
// COLOR TOKEN
// =============================================================================

/**
 * Get color token class for direction
 * 获取方向对应的颜色令牌类
 *
 * @param direction - The direction to get color for
 * @returns Tailwind color class string
 */
export function getColorToken(direction: Direction): string {
  return DIRECTION_COLORS[direction];
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format a value as price with currency symbol
 * 格式化价格值（带货币符号）
 *
 * @param value - The value to format
 * @param precision - Decimal places (default: 2)
 * @returns Formatted price string like "¥15.20"
 */
export function formatPrice(
  value: Decimal | string | number,
  precision: number = PRECISION.price
): string {
  const decimal = toDecimal(value);
  // Use absolute value - sign is handled separately by formatWithSign
  const formatted = decimal.abs().toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toFixed(precision);
  return `¥${formatted}`;
}

/**
 * Format a value as percentage
 * 格式化百分比值
 *
 * @param value - The value to format (already in percentage form, e.g., 32.5 for 32.5%)
 * @param precision - Decimal places (default: 2)
 * @returns Formatted percentage string like "32.50%"
 */
export function formatPercent(
  value: Decimal | string | number,
  precision: number = PRECISION.percent
): string {
  const decimal = toDecimal(value);
  const formatted = decimal.abs().toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toFixed(precision);
  return `${formatted}%`;
}

/**
 * Format a value as ratio (e.g., Sharpe ratio)
 * 格式化比率值（如夏普比率）
 *
 * @param value - The value to format
 * @param precision - Decimal places (default: 3)
 * @returns Formatted ratio string like "1.234"
 */
export function formatRatio(
  value: Decimal | string | number,
  precision: number = PRECISION.ratio
): string {
  const decimal = toDecimal(value);
  // Use absolute value - sign is handled separately by formatWithSign
  return decimal.abs().toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toFixed(precision);
}

/**
 * Format value based on data type
 * 根据数据类型格式化值
 *
 * @param value - The value to format
 * @param type - The type of financial data
 * @param customPrecision - Optional custom precision override
 * @returns Formatted string based on type
 */
export function formatByType(
  value: Decimal | string | number,
  type: FinancialDataType,
  customPrecision?: number
): string {
  const precision = customPrecision ?? PRECISION[type];

  switch (type) {
    case "price":
      return formatPrice(value, precision);
    case "percent":
      return formatPercent(value, precision);
    case "ratio":
      return formatRatio(value, precision);
    default:
      return formatRatio(value, precision);
  }
}

// =============================================================================
// SIGNED FORMATTING
// =============================================================================

/**
 * Format value with sign prefix for directional display
 * 格式化带符号前缀的方向性显示值
 *
 * @param value - The value to format
 * @param type - The type of financial data
 * @param customPrecision - Optional custom precision override
 * @returns Formatted string with sign like "+32.50%" or "-15.20"
 */
export function formatWithSign(
  value: Decimal | string | number,
  type: FinancialDataType,
  customPrecision?: number
): string {
  const decimal = toDecimal(value);
  const direction = getDirection(decimal);
  const sign = DIRECTION_SIGNS[direction];
  const formatted = formatByType(decimal, type, customPrecision);

  // For price, insert sign after currency symbol
  if (type === "price") {
    return formatted.replace("¥", `¥${sign}`);
  }

  return `${sign}${formatted}`;
}

// =============================================================================
// ARIA LABEL GENERATION
// =============================================================================

/**
 * Generate accessible label for financial value
 * 生成金融数值的无障碍标签
 *
 * @param value - The value
 * @param type - The type of financial data
 * @param label - Optional label prefix
 * @returns Accessible label string like "总收益率 上涨 32.50%"
 */
export function getAriaLabel(
  value: Decimal | string | number,
  type: FinancialDataType,
  label?: string
): string {
  const decimal = toDecimal(value);
  const direction = getDirection(decimal);
  const directionLabel = DIRECTION_ARIA_LABELS[direction];
  const formattedValue = formatByType(decimal.abs(), type);

  const parts: string[] = [];

  if (label) {
    parts.push(label);
  }

  parts.push(directionLabel);
  parts.push(formattedValue);

  return parts.join(" ");
}

// =============================================================================
// RESPONSIVE TEXT GENERATION
// =============================================================================

/**
 * Generate responsive text variants
 * 生成响应式文本变体
 *
 * @param value - The value
 * @param type - The type of financial data
 * @param options - Format options
 * @returns Object with full and compact text variants
 */
export function getResponsiveText(
  value: Decimal | string | number,
  type: FinancialDataType,
  options: FinancialFormatOptions = {}
): { full: string; compact: string } {
  const decimal = toDecimal(value);
  const direction = getDirection(decimal);
  const sign = DIRECTION_SIGNS[direction];
  const arrow = options.showArrow ? DIRECTION_ARROWS[direction] : "";
  const formattedValue = formatByType(decimal.abs(), type, options.precision);

  // Compact version: just sign + value (no arrow in compact)
  let compact: string;
  if (type === "price") {
    compact = formattedValue.replace("¥", `¥${sign}`);
  } else {
    compact = `${sign}${formattedValue}`;
  }

  // Full version: label + arrow + sign + value
  let full: string;
  if (options.label) {
    full = `${options.label} ${arrow ? arrow + " " : ""}${compact}`;
  } else {
    full = arrow ? `${arrow} ${compact}` : compact;
  }

  return { full: full.trim(), compact };
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

/**
 * Create FinancialDisplayData from raw value
 * 从原始值创建 FinancialDisplayData
 *
 * This is the main adapter function that transforms raw financial data
 * into a unified display structure.
 *
 * @param value - The raw value (Decimal, string, or number)
 * @param type - The type of financial data
 * @param options - Format options
 * @returns Complete FinancialDisplayData object
 */
export function createFinancialDisplayData(
  value: Decimal | string | number,
  type: FinancialDataType,
  options: FinancialFormatOptions = {}
): FinancialDisplayData {
  const decimal = toDecimal(value);
  const direction = getDirection(decimal);
  const colorToken = getColorToken(direction);
  const formatted = formatWithSign(decimal, type, options.precision);
  const ariaLabel = getAriaLabel(decimal, type, options.label);
  const responsive = getResponsiveText(decimal, type, options);

  return {
    raw: decimal,
    formatted,
    direction,
    ariaLabel,
    colorToken,
    responsive,
  };
}
