/**
 * Financial Display Data Types
 * 金融数据展示类型定义
 *
 * Defines unified interfaces for financial data rendering in UI
 * with support for accessibility, responsive display, and localization.
 *
 * @module lib/financial/types
 */

import type Decimal from "decimal.js";

// =============================================================================
// DIRECTION TYPES
// =============================================================================

/**
 * Direction of price movement
 * 价格变动方向
 */
export type Direction = "up" | "down" | "neutral";

// =============================================================================
// FINANCIAL DATA TYPES
// =============================================================================

/**
 * Types of financial data with different precision requirements
 * 不同精度要求的金融数据类型
 */
export type FinancialDataType = "price" | "percent" | "ratio";

// =============================================================================
// PRECISION CONFIGURATION
// =============================================================================

/**
 * Decimal precision for each data type
 * 各数据类型的小数精度
 */
export const PRECISION: Record<FinancialDataType, number> = {
  price: 2,   // ¥15.20
  percent: 2, // 32.50%
  ratio: 3,   // 1.234
};

// =============================================================================
// DIRECTION SYMBOL MAPPING
// =============================================================================

/**
 * Arrow symbols for direction indication
 * 方向指示箭头符号
 */
export const DIRECTION_ARROWS: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  neutral: "-",
};

/**
 * Sign symbols for direction indication
 * 方向指示符号
 */
export const DIRECTION_SIGNS: Record<Direction, string> = {
  up: "+",
  down: "-",
  neutral: "",
};

/**
 * Color tokens for direction indication
 * 方向指示颜色令牌
 */
export const DIRECTION_COLORS: Record<Direction, string> = {
  up: "text-profit",
  down: "text-loss",
  neutral: "text-muted",
};

/**
 * Accessibility labels for direction
 * 方向无障碍标签
 */
export const DIRECTION_ARIA_LABELS: Record<Direction, string> = {
  up: "上涨",
  down: "下跌",
  neutral: "持平",
};

// =============================================================================
// FINANCIAL DISPLAY DATA INTERFACE
// =============================================================================

/**
 * Responsive text variants for different viewport sizes
 * 不同视口尺寸的响应式文本变体
 */
export interface ResponsiveText {
  /** Full text for desktop (桌面端完整文本) */
  full: string;
  /** Compact text for mobile (移动端紧凑文本) */
  compact: string;
}

/**
 * Unified financial display data structure
 * 统一的金融数据展示结构
 *
 * This interface provides all necessary data for rendering financial values
 * with consistent formatting, accessibility, and styling.
 */
export interface FinancialDisplayData {
  /** Raw Decimal value for precise calculations (精确计算用原始 Decimal 值) */
  raw: Decimal;

  /** Formatted string for display (展示用格式化字符串) */
  formatted: string;

  /** Price movement direction (价格变动方向) */
  direction: Direction;

  /** Accessible label for screen readers (屏幕阅读器无障碍标签) */
  ariaLabel: string;

  /** Tailwind color class token (Tailwind 颜色类令牌) */
  colorToken: string;

  /** Responsive text variants (响应式文本变体) */
  responsive: ResponsiveText;
}

// =============================================================================
// FORMAT OPTIONS
// =============================================================================

/**
 * Options for formatting financial data
 * 金融数据格式化选项
 */
export interface FinancialFormatOptions {
  /** Label prefix for full text (完整文本的标签前缀) */
  label?: string;

  /** Whether to show arrow indicator (是否显示箭头指示) */
  showArrow?: boolean;

  /** Custom precision override (自定义精度覆盖) */
  precision?: number;
}
