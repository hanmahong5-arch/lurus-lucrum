/**
 * FinancialValue Component
 * 金融数值展示组件
 *
 * Renders financial data with consistent styling, accessibility,
 * and responsive display variants.
 *
 * Features:
 * - Monospace font with tabular numbers for alignment
 * - Triple encoding for direction (color + arrow + sign)
 * - Accessible labels for screen readers
 * - Responsive variants (full/compact)
 * - Reduced motion support
 *
 * @module components/financial/financial-value
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { FinancialDisplayData, FinancialDataType } from "@/lib/financial/types";
import { DIRECTION_ARROWS } from "@/lib/financial/types";
import { createFinancialDisplayData } from "@/lib/financial/formatters";

// =============================================================================
// TYPES
// =============================================================================

export interface FinancialValueProps {
  /** Financial display data from useFinancialFormat hook */
  data: FinancialDisplayData;

  /** Display variant: 'full' shows label, 'compact' shows only value */
  variant?: "full" | "compact";

  /** Whether to show arrow indicator (↑/↓/-) */
  showArrow?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Font size class override */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
}

// =============================================================================
// SIZE MAPPING
// =============================================================================

const SIZE_CLASSES: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * FinancialValue Component
 * 金融数值展示组件
 *
 * Renders formatted financial data with proper styling and accessibility.
 *
 * @example
 * ```tsx
 * const data = useFinancialFormat(32.50, 'percent', { label: '总收益率' });
 * <FinancialValue data={data} variant="full" showArrow />
 * // Renders: ↑ 总收益率 +32.50%
 * ```
 */
export function FinancialValue({
  data,
  variant = "full",
  showArrow = false,
  className,
  size = "base",
}: FinancialValueProps) {
  const displayText = variant === "full" ? data.responsive.full : data.responsive.compact;
  const arrow = showArrow ? DIRECTION_ARROWS[data.direction] : null;

  return (
    <span
      className={cn(
        // Mandatory typography for financial data
        "font-mono tabular-nums",
        // Color based on direction
        data.colorToken,
        // Size class
        SIZE_CLASSES[size],
        // Transitions with reduced motion support
        "transition-colors duration-200 ease-in-out",
        "motion-reduce:transition-none",
        // Custom classes
        className
      )}
      aria-label={data.ariaLabel}
    >
      {showArrow && arrow && (
        <span className="mr-1" aria-hidden="true">
          {arrow}
        </span>
      )}
      <span>{displayText}</span>
    </span>
  );
}

// =============================================================================
// SIMPLE VALUE COMPONENT (NO HOOK REQUIRED)
// =============================================================================

export interface SimpleFinancialValueProps {
  /** The numeric value to display */
  value: number | string;

  /** Type of financial data */
  type: FinancialDataType;

  /** Whether to show sign prefix (+/-) */
  showSign?: boolean;

  /** Whether to show arrow indicator */
  showArrow?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Font size class */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
}

/**
 * SimpleFinancialValue Component
 * 简化金融数值组件
 *
 * A simpler component that doesn't require the hook.
 * Useful for static values that don't need full FinancialDisplayData.
 *
 * @example
 * ```tsx
 * <SimpleFinancialValue value={32.50} type="percent" showSign showArrow />
 * // Renders: ↑ +32.50%
 * ```
 */
export function SimpleFinancialValue({
  value,
  type,
  showSign = true,
  showArrow = false,
  className,
  size = "base",
}: SimpleFinancialValueProps) {
  // Memoize the financial display data
  const data = useMemo(
    () => createFinancialDisplayData(value, type, { showArrow }),
    [value, type, showArrow]
  );

  const displayText = showSign ? data.formatted : data.responsive.compact.replace(/([¥]?)[+-]/, "$1");
  const arrow = showArrow ? DIRECTION_ARROWS[data.direction] : null;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        data.colorToken,
        SIZE_CLASSES[size],
        "transition-colors duration-200 ease-in-out",
        "motion-reduce:transition-none",
        className
      )}
      aria-label={data.ariaLabel}
    >
      {showArrow && arrow && (
        <span className="mr-1" aria-hidden="true">
          {arrow}
        </span>
      )}
      <span>{displayText}</span>
    </span>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default FinancialValue;
