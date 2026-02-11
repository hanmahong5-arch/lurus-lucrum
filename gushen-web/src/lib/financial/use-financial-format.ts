/**
 * useFinancialFormat Hook
 * 金融数据格式化 Hook
 *
 * React hook for formatting financial data with memoization.
 * Provides FinancialDisplayData for use in components.
 *
 * @module lib/financial/use-financial-format
 */

"use client";

import { useMemo } from "react";
import Decimal from "decimal.js";
import {
  type FinancialDataType,
  type FinancialDisplayData,
  type FinancialFormatOptions,
} from "./types";
import { createFinancialDisplayData, toDecimal } from "./formatters";

/**
 * Hook for formatting financial data
 * 金融数据格式化 Hook
 *
 * @param value - The raw value (Decimal, string, or number)
 * @param type - The type of financial data ('price' | 'percent' | 'ratio')
 * @param options - Optional formatting options
 * @returns FinancialDisplayData object with all display properties
 *
 * @example
 * ```tsx
 * const data = useFinancialFormat(32.50, 'percent', {
 *   label: '总收益率',
 *   showArrow: true,
 * });
 * // → { formatted: '+32.50%', direction: 'up', ariaLabel: '总收益率 上涨 32.50%', ... }
 * ```
 */
export function useFinancialFormat(
  value: Decimal | string | number,
  type: FinancialDataType,
  options?: FinancialFormatOptions
): FinancialDisplayData {
  // Memoize the display data to avoid unnecessary recalculations
  const displayData = useMemo(() => {
    return createFinancialDisplayData(value, type, options ?? {});
  }, [
    // Convert value to string for stable comparison
    value instanceof Decimal ? value.toString() : String(value),
    type,
    options?.label,
    options?.showArrow,
    options?.precision,
  ]);

  return displayData;
}

/**
 * Hook for formatting multiple financial values
 * 多个金融数据格式化 Hook
 *
 * @param items - Array of value/type/options tuples
 * @returns Array of FinancialDisplayData objects
 *
 * @example
 * ```tsx
 * const [price, percent, ratio] = useFinancialFormatMany([
 *   [15.20, 'price'],
 *   [32.50, 'percent', { label: '收益率' }],
 *   [1.234, 'ratio'],
 * ]);
 * ```
 */
export function useFinancialFormatMany(
  items: Array<[Decimal | string | number, FinancialDataType, FinancialFormatOptions?]>
): FinancialDisplayData[] {
  const displayDataArray = useMemo(() => {
    return items.map(([value, type, options]) =>
      createFinancialDisplayData(value, type, options ?? {})
    );
  }, [
    // Create a stable key from all items
    items
      .map(([value, type, options]) => {
        const valueStr = value instanceof Decimal ? value.toString() : String(value);
        return `${valueStr}:${type}:${options?.label ?? ""}:${options?.showArrow ?? ""}:${options?.precision ?? ""}`;
      })
      .join("|"),
  ]);

  return displayDataArray;
}

// Re-export types and utilities for convenience
export { toDecimal, createFinancialDisplayData } from "./formatters";
export type {
  FinancialDisplayData,
  FinancialDataType,
  FinancialFormatOptions,
  Direction,
} from "./types";
