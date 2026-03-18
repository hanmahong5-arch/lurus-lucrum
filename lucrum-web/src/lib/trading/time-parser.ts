/**
 * Time Parser for Chinese Market Data
 * 中国市场数据时间解析器
 *
 * Handles timezone conversions, K-line time alignment, and trading hour validation
 * for Chinese stock market (UTC+8).
 *
 * Core principles:
 * - All Chinese market times are in UTC+8 (China Standard Time)
 * - Unix timestamps are always in UTC
 * - K-line bars align to period boundaries (e.g., 9:35:00, not 9:35:27)
 * - Trading hours: 9:30-11:30 (morning), 13:00-15:00 (afternoon)
 */

import { getChinaTime } from './time-utils';

// ============================================================================
// Types
// ============================================================================

export type KLineTimeFrame =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '60m'
  | '1d'
  | '1w'
  | '1M';

// ============================================================================
// Constants
// ============================================================================

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8 in milliseconds

// Trading hours in minutes from midnight
const TRADING_HOURS = {
  MORNING_START: 9 * 60 + 30, // 09:30
  MORNING_END: 11 * 60 + 30, // 11:30
  AFTERNOON_START: 13 * 60, // 13:00
  AFTERNOON_END: 15 * 60, // 15:00
} as const;

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Parse Chinese market time string to Unix timestamp (seconds)
 * 解析中国市场时间字符串为Unix时间戳（秒）
 *
 * Handles various formats:
 * - "2026-01-21 09:35:00" (full datetime)
 * - "2026-01-21" (date only, defaults to 00:00:00)
 * - "2026/01/21 09:35" (alternative format)
 *
 * CRITICAL: This function assumes the input time is in UTC+8 (China timezone)
 * and returns a UTC Unix timestamp.
 *
 * @param timeStr - Time string in China timezone
 * @returns Unix timestamp in seconds (UTC)
 *
 * @example
 * parseChinaTimeToUnix("2026-01-21 09:35:00") // Returns UTC timestamp for 2026-01-21 01:35:00 UTC
 */
export function parseChinaTimeToUnix(timeStr: string): number {
  // Remove any existing timezone info and trim
  const cleanStr = timeStr.replace(/\s*GMT.*$/, '').trim();

  // Parse components using a flexible regex
  // Supports both - and / as separators
  const parts = cleanStr.split(/[\s-:/]+/);

  const year = parseInt(parts[0] ?? '0', 10);
  const month = parseInt(parts[1] ?? '1', 10) - 1; // JS months are 0-indexed
  const day = parseInt(parts[2] ?? '1', 10);
  const hour = parseInt(parts[3] ?? '0', 10);
  const minute = parseInt(parts[4] ?? '0', 10);
  const second = parseInt(parts[5] ?? '0', 10);

  // Create UTC date, then adjust for China timezone
  // The input represents China time (UTC+8), so we need to subtract 8 hours
  // to get the correct UTC timestamp
  const utcDate = Date.UTC(year, month, day, hour, minute, second);
  const timestamp = utcDate - CHINA_OFFSET_MS;

  return Math.floor(timestamp / 1000); // Return Unix seconds
}

/**
 * Align timestamp to K-line bar start time
 * 将时间戳对齐到K线起始时间
 *
 * Examples:
 * - 1m: 09:35:27 -> 09:35:00
 * - 5m: 09:37:00 -> 09:35:00
 * - 15m: 09:47:00 -> 09:45:00
 * - 1d: 2026-01-21 14:30:00 -> 2026-01-21 00:00:00
 *
 * IMPORTANT: All alignment operations are performed in China timezone (UTC+8)
 *
 * @param timestamp - Unix timestamp in seconds (UTC)
 * @param timeframe - K-line timeframe
 * @returns Aligned Unix timestamp in seconds (UTC)
 */
export function alignToBarStart(
  timestamp: number,
  timeframe: KLineTimeFrame
): number {
  // Convert Unix seconds to China time Date object
  const chinaDate = getChinaTime(new Date(timestamp * 1000));

  const year = chinaDate.getFullYear();
  const month = chinaDate.getMonth();
  const date = chinaDate.getDate();
  const hours = chinaDate.getHours();
  const minutes = chinaDate.getMinutes();

  let alignedDate: Date;

  switch (timeframe) {
    case '1m':
      // Align to minute boundary
      alignedDate = new Date(
        Date.UTC(year, month, date, hours - 8, minutes, 0, 0)
      );
      break;

    case '5m': {
      // Align to 5-minute boundary (0, 5, 10, ..., 55)
      const alignedMinute = Math.floor(minutes / 5) * 5;
      alignedDate = new Date(
        Date.UTC(year, month, date, hours - 8, alignedMinute, 0, 0)
      );
      break;
    }

    case '15m': {
      // Align to 15-minute boundary (0, 15, 30, 45)
      const alignedMinute = Math.floor(minutes / 15) * 15;
      alignedDate = new Date(
        Date.UTC(year, month, date, hours - 8, alignedMinute, 0, 0)
      );
      break;
    }

    case '30m': {
      // Align to 30-minute boundary (0, 30)
      const alignedMinute = Math.floor(minutes / 30) * 30;
      alignedDate = new Date(
        Date.UTC(year, month, date, hours - 8, alignedMinute, 0, 0)
      );
      break;
    }

    case '60m': {
      // Align to hour boundary
      alignedDate = new Date(Date.UTC(year, month, date, hours - 8, 0, 0, 0));
      break;
    }

    case '1d':
      // Align to day boundary (00:00 China time)
      alignedDate = new Date(Date.UTC(year, month, date, 0 - 8, 0, 0, 0));
      break;

    case '1w': {
      // Align to week start (Monday 00:00 China time)
      const dayOfWeek = chinaDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      alignedDate = new Date(
        Date.UTC(year, month, date - daysToMonday, 0 - 8, 0, 0, 0)
      );
      break;
    }

    case '1M':
      // Align to month start (1st day, 00:00 China time)
      alignedDate = new Date(Date.UTC(year, month, 1, 0 - 8, 0, 0, 0));
      break;

    default:
      alignedDate = new Date(timestamp * 1000);
  }

  return Math.floor(alignedDate.getTime() / 1000);
}

/**
 * Check if timestamp should create a new bar
 * 检查是否应该创建新的K线bar
 *
 * Handles lunch break: 11:30-13:00 should not have bars, but crossing
 * the lunch break should create a new bar.
 *
 * @param lastBarTime - Previous bar timestamp (Unix seconds)
 * @param currentTime - Current tick timestamp (Unix seconds)
 * @param timeframe - K-line timeframe
 * @returns True if should create new bar
 */
export function shouldCreateNewBar(
  lastBarTime: number,
  currentTime: number,
  timeframe: KLineTimeFrame
): boolean {
  // For daily and above, simple interval check is fine
  if (['1d', '1w', '1M'].includes(timeframe)) {
    const intervalMap: Record<string, number> = {
      '1d': 86400,
      '1w': 604800,
      '1M': 2592000,
    };
    const interval = intervalMap[timeframe] ?? 86400;
    return currentTime - lastBarTime >= interval;
  }

  // For intraday: check if we crossed into a new bar period
  // accounting for lunch break
  const lastBarStart = alignToBarStart(lastBarTime, timeframe);
  const currentBarStart = alignToBarStart(currentTime, timeframe);

  if (currentBarStart <= lastBarStart) {
    return false; // Still in same bar
  }

  // Check if we skipped lunch break
  const lastChinaDate = getChinaTime(new Date(lastBarTime * 1000));
  const currentChinaDate = getChinaTime(new Date(currentTime * 1000));

  const lastHour = lastChinaDate.getHours();
  const lastMinute = lastChinaDate.getMinutes();
  const currentHour = currentChinaDate.getHours();
  const currentMinute = currentChinaDate.getMinutes();

  const lastTotalMinutes = lastHour * 60 + lastMinute;
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  // If last bar was before lunch and current is after lunch,
  // and they're on same day, it's valid
  if (
    lastTotalMinutes < TRADING_HOURS.MORNING_END &&
    currentTotalMinutes >= TRADING_HOURS.AFTERNOON_START
  ) {
    // Check if same trading day
    const lastDate = `${lastChinaDate.getFullYear()}-${lastChinaDate.getMonth()}-${lastChinaDate.getDate()}`;
    const currentDate = `${currentChinaDate.getFullYear()}-${currentChinaDate.getMonth()}-${currentChinaDate.getDate()}`;

    if (lastDate === currentDate) {
      return true; // Crossed lunch break on same day
    }
  }

  return currentBarStart > lastBarStart;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if timestamp is within trading hours
 * 检查时间戳是否在交易时段内
 *
 * Trading hours:
 * - Morning: 09:30 - 11:30
 * - Afternoon: 13:00 - 15:00
 *
 * @param timestamp - Unix timestamp in seconds (UTC)
 * @param timeframe - K-line timeframe
 * @returns True if within trading hours
 */
export function isWithinTradingHours(
  timestamp: number,
  timeframe: KLineTimeFrame
): boolean {
  // Daily and above don't need trading hour check
  if (['1d', '1w', '1M'].includes(timeframe)) {
    return true;
  }

  const chinaDate = getChinaTime(new Date(timestamp * 1000));
  const hours = chinaDate.getHours();
  const minutes = chinaDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  return (
    (totalMinutes >= TRADING_HOURS.MORNING_START &&
      totalMinutes < TRADING_HOURS.MORNING_END) ||
    (totalMinutes >= TRADING_HOURS.AFTERNOON_START &&
      totalMinutes <= TRADING_HOURS.AFTERNOON_END)
  );
}

/**
 * Get next trading time (skip lunch break if needed)
 * 获取下一个交易时间（如果需要则跳过午休）
 *
 * @param timestamp - Unix timestamp in seconds (UTC)
 * @param intervalSeconds - Time interval in seconds
 * @returns Next trading timestamp (Unix seconds)
 */
export function getNextTradingTime(
  timestamp: number,
  intervalSeconds: number
): number {
  const chinaDate = getChinaTime(new Date(timestamp * 1000));
  const hours = chinaDate.getHours();
  const minutes = chinaDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // If we're in morning session and next time would be in lunch break,
  // jump to afternoon start
  if (
    totalMinutes >= TRADING_HOURS.MORNING_START &&
    totalMinutes < TRADING_HOURS.MORNING_END
  ) {
    const nextTime = timestamp + intervalSeconds;
    const nextChinaDate = getChinaTime(new Date(nextTime * 1000));
    const nextHour = nextChinaDate.getHours();
    const nextMinute = nextChinaDate.getMinutes();
    const nextTotalMinutes = nextHour * 60 + nextMinute;

    if (
      nextTotalMinutes >= TRADING_HOURS.MORNING_END &&
      nextTotalMinutes < TRADING_HOURS.AFTERNOON_START
    ) {
      // Jump to afternoon start
      const afternoonStart = new Date(chinaDate);
      afternoonStart.setHours(13, 0, 0, 0);
      return Math.floor(afternoonStart.getTime() / 1000);
    }
  }

  return timestamp + intervalSeconds;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get timeframe interval in seconds
 * 获取时间周期的秒数
 *
 * @param timeframe - K-line timeframe
 * @returns Interval in seconds
 */
export function getTimeframeInterval(timeframe: KLineTimeFrame): number {
  const intervals: Record<KLineTimeFrame, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '60m': 3600,
    '1d': 86400,
    '1w': 604800,
    '1M': 2592000,
  };
  return intervals[timeframe] ?? 60;
}

/**
 * Check if timeframe is intraday
 * 检查是否为日内周期
 *
 * @param timeframe - K-line timeframe
 * @returns True if intraday
 */
export function isIntradayTimeframe(timeframe: KLineTimeFrame): boolean {
  return ['1m', '5m', '15m', '30m', '60m'].includes(timeframe);
}

/**
 * Format timestamp to China time string
 * 格式化时间戳为中国时间字符串
 *
 * @param timestamp - Unix timestamp in seconds (UTC)
 * @param includeTime - Include time component (default: true)
 * @returns Formatted time string
 *
 * @example
 * formatChinaTime(1737434100) // "2026-01-21 09:35:00"
 * formatChinaTime(1737434100, false) // "2026-01-21"
 */
export function formatChinaTime(
  timestamp: number,
  includeTime: boolean = true
): string {
  const chinaDate = getChinaTime(new Date(timestamp * 1000));

  const year = chinaDate.getFullYear();
  const month = String(chinaDate.getMonth() + 1).padStart(2, '0');
  const day = String(chinaDate.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(chinaDate.getHours()).padStart(2, '0');
  const minutes = String(chinaDate.getMinutes()).padStart(2, '0');
  const seconds = String(chinaDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
