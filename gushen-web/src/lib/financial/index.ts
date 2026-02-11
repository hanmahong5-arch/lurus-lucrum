/**
 * Financial Data Adapter Module
 * 金融数据适配器模块
 *
 * Exports all financial formatting utilities, types, and hooks.
 *
 * @module lib/financial
 */

// Types
export {
  type Direction,
  type FinancialDataType,
  type FinancialDisplayData,
  type FinancialFormatOptions,
  type ResponsiveText,
  PRECISION,
  DIRECTION_ARROWS,
  DIRECTION_SIGNS,
  DIRECTION_COLORS,
  DIRECTION_ARIA_LABELS,
} from "./types";

// Formatters
export {
  toDecimal,
  getDirection,
  getColorToken,
  formatPrice,
  formatPercent,
  formatRatio,
  formatByType,
  formatWithSign,
  getAriaLabel,
  getResponsiveText,
  createFinancialDisplayData,
} from "./formatters";

// Hook
export {
  useFinancialFormat,
  useFinancialFormatMany,
} from "./use-financial-format";
