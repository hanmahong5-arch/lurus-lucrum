/**
 * K-line Data Validator
 * K线数据验证器
 *
 * Validates K-line data quality to ensure correct:
 * - Time sequence (ascending order)
 * - OHLC relationships (high >= low, etc.)
 * - Time intervals match timeframe
 * - Trading hours compliance
 * - No duplicate timestamps
 */

import { getChinaTime } from './time-utils';
import {
  getTimeframeInterval,
  isWithinTradingHours,
  isIntradayTimeframe,
  type KLineTimeFrame,
} from './time-parser';
import type { KLineData } from '../data-service/types';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'TIME_SEQUENCE' | 'OHLC_RELATIONSHIP' | 'DUPLICATE_TIME' | 'INVALID_DATA';
  message: string;
  index?: number;
  bar?: KLineData;
}

export interface ValidationWarning {
  type: 'TIME_GAP' | 'TRADING_HOURS' | 'SUSPICIOUS_PRICE';
  message: string;
  index?: number;
  bar?: KLineData;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate K-line data quality
 * 验证K线数据质量
 *
 * @param data - K-line data array
 * @param timeframe - K-line timeframe
 * @param symbol - Stock symbol (for logging)
 * @returns Validation result with errors and warnings
 */
export function validateKLineData(
  data: KLineData[],
  timeframe: KLineTimeFrame,
  symbol: string = 'unknown'
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check 0: Empty data
  if (data.length === 0) {
    errors.push({
      type: 'INVALID_DATA',
      message: 'Empty data array',
    });
    return { valid: false, errors, warnings };
  }

  // Check 1: Time sequence must be ascending
  // 检查时间序列必须递增
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    if (!prev || !curr) {
      errors.push({
        type: 'INVALID_DATA',
        message: `Null bar at index ${i}`,
        index: i,
      });
      continue;
    }

    if (curr.time <= prev.time) {
      errors.push({
        type: 'TIME_SEQUENCE',
        message: `Time sequence error at index ${i}: ${prev.time} -> ${curr.time}`,
        index: i,
        bar: curr,
      });
    }
  }

  // Check 2: OHLC relationships must be valid
  // 检查OHLC关系必须有效
  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    if (!bar) continue;

    // High must be >= Low
    if (bar.high < bar.low) {
      errors.push({
        type: 'OHLC_RELATIONSHIP',
        message: `Invalid OHLC at ${i}: high ${bar.high} < low ${bar.low}`,
        index: i,
        bar,
      });
    }

    // High must be >= Open and Close
    if (bar.high < bar.open || bar.high < bar.close) {
      errors.push({
        type: 'OHLC_RELATIONSHIP',
        message: `Invalid high at ${i}: ${bar.high} < open/close`,
        index: i,
        bar,
      });
    }

    // Low must be <= Open and Close
    if (bar.low > bar.open || bar.low > bar.close) {
      errors.push({
        type: 'OHLC_RELATIONSHIP',
        message: `Invalid low at ${i}: ${bar.low} > open/close`,
        index: i,
        bar,
      });
    }

    // Prices must be positive
    if (
      bar.open <= 0 ||
      bar.high <= 0 ||
      bar.low <= 0 ||
      bar.close <= 0
    ) {
      errors.push({
        type: 'INVALID_DATA',
        message: `Non-positive price at ${i}`,
        index: i,
        bar,
      });
    }

    // Volume must be non-negative
    if (bar.volume < 0) {
      errors.push({
        type: 'INVALID_DATA',
        message: `Negative volume at ${i}: ${bar.volume}`,
        index: i,
        bar,
      });
    }

    // Check for suspicious price movements (>50% in one bar)
    const priceChange = Math.abs((bar.close - bar.open) / bar.open);
    if (priceChange > 0.5) {
      warnings.push({
        type: 'SUSPICIOUS_PRICE',
        message: `Large price change at ${i}: ${(priceChange * 100).toFixed(1)}%`,
        index: i,
        bar,
      });
    }
  }

  // Check 3: No duplicate timestamps
  // 检查无重复时间戳
  const seenTimes = new Set<number>();
  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    if (!bar) continue;

    if (seenTimes.has(bar.time)) {
      errors.push({
        type: 'DUPLICATE_TIME',
        message: `Duplicate timestamp at ${i}: ${bar.time}`,
        index: i,
        bar,
      });
    }
    seenTimes.add(bar.time);
  }

  // Check 4: Time gaps should align with timeframe
  // 检查时间间隔应符合周期
  const isIntraday = isIntradayTimeframe(timeframe);
  const expectedInterval = getTimeframeInterval(timeframe);

  if (isIntraday) {
    // For intraday, check time gaps more strictly
    const lunchBreak = 5400; // 90 minutes = 5400 seconds

    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      if (!prev || !curr) continue;

      const gap = curr.time - prev.time;

      // Allowed gaps: normal interval, lunch break, or overnight
      const isValidGap =
        gap === expectedInterval || // Normal interval
        gap === lunchBreak || // Lunch break
        gap === expectedInterval + lunchBreak || // Interval + lunch
        gap > 86400; // Overnight (next day)

      if (!isValidGap) {
        // Check if it's a weekend/holiday gap
        const prevDate = getChinaTime(new Date(prev.time * 1000));
        const currDate = getChinaTime(new Date(curr.time * 1000));

        const isSameDay =
          prevDate.getFullYear() === currDate.getFullYear() &&
          prevDate.getMonth() === currDate.getMonth() &&
          prevDate.getDate() === currDate.getDate();

        if (isSameDay) {
          warnings.push({
            type: 'TIME_GAP',
            message: `Unexpected time gap at ${i}: ${gap}s (expected ${expectedInterval}s or ${lunchBreak}s for lunch)`,
            index: i,
            bar: curr,
          });
        }
      }
    }
  }

  // Check 5: Trading hours compliance for intraday
  // 检查日内数据的交易时段合规性
  if (isIntraday) {
    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      if (!bar) continue;

      if (!isWithinTradingHours(bar.time, timeframe)) {
        warnings.push({
          type: 'TRADING_HOURS',
          message: `Bar at ${i} outside trading hours: ${formatTime(bar.time)}`,
          index: i,
          bar,
        });
      }
    }
  }

  // Log results
  if (errors.length > 0 || warnings.length > 0) {
    console.log(
      `[KLineValidator] ${symbol} ${timeframe}: ${errors.length} errors, ${warnings.length} warnings`
    );

    if (errors.length > 0) {
      console.error('[KLineValidator] Errors:', errors);
    }

    if (warnings.length > 5) {
      console.warn(
        `[KLineValidator] ${warnings.length} warnings (showing first 5):`,
        warnings.slice(0, 5)
      );
    } else if (warnings.length > 0) {
      console.warn('[KLineValidator] Warnings:', warnings);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format timestamp to readable time string
 * 格式化时间戳为可读字符串
 */
function formatTime(timestamp: number): string {
  const date = getChinaTime(new Date(timestamp * 1000));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Quick validation - only checks critical errors
 * 快速验证 - 仅检查关键错误
 *
 * Use this for performance-critical paths
 */
export function quickValidate(data: KLineData[]): boolean {
  if (data.length === 0) return false;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    if (!bar) return false;

    // Check OHLC relationships
    if (
      bar.high < bar.low ||
      bar.high < bar.open ||
      bar.high < bar.close ||
      bar.low > bar.open ||
      bar.low > bar.close
    ) {
      return false;
    }

    // Check for non-positive prices
    if (
      bar.open <= 0 ||
      bar.high <= 0 ||
      bar.low <= 0 ||
      bar.close <= 0
    ) {
      return false;
    }

    // Check time sequence (if not first bar)
    if (i > 0) {
      const prev = data[i - 1];
      if (prev && bar.time <= prev.time) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get validation summary
 * 获取验证摘要
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return `✅ Data validation passed (${result.warnings.length} warnings)`;
  }

  const errorTypes = result.errors.reduce(
    (acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const errorSummary = Object.entries(errorTypes)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  return `❌ Data validation failed: ${errorSummary}`;
}
