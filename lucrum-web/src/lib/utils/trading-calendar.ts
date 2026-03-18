/**
 * Trading Calendar Utility
 * 交易日历工具
 *
 * Provides utilities for calculating trading days in China A-share market.
 * Handles weekends and Chinese public holidays.
 *
 * 提供中国A股市场交易日计算的工具函数
 * 处理周末和中国法定节假日
 */

// =============================================================================
// HOLIDAY DATA / 节假日数据
// =============================================================================

/**
 * China A-share market holidays (non-trading days)
 * 中国A股市场节假日(非交易日)
 *
 * Format: YYYY-MM-DD
 * Data source: China Securities Regulatory Commission (CSRC)
 */

// 2024年节假日
const HOLIDAYS_2024: string[] = [
  // 元旦 New Year's Day
  "2024-01-01",
  // 春节 Spring Festival
  "2024-02-09",
  "2024-02-10",
  "2024-02-11",
  "2024-02-12",
  "2024-02-13",
  "2024-02-14",
  "2024-02-15",
  "2024-02-16",
  "2024-02-17",
  // 清明节 Qingming Festival
  "2024-04-04",
  "2024-04-05",
  "2024-04-06",
  // 劳动节 Labor Day
  "2024-05-01",
  "2024-05-02",
  "2024-05-03",
  "2024-05-04",
  "2024-05-05",
  // 端午节 Dragon Boat Festival
  "2024-06-08",
  "2024-06-09",
  "2024-06-10",
  // 中秋节 Mid-Autumn Festival
  "2024-09-15",
  "2024-09-16",
  "2024-09-17",
  // 国庆节 National Day
  "2024-10-01",
  "2024-10-02",
  "2024-10-03",
  "2024-10-04",
  "2024-10-05",
  "2024-10-06",
  "2024-10-07",
];

// 2025年节假日
const HOLIDAYS_2025: string[] = [
  // 元旦 New Year's Day
  "2025-01-01",
  // 春节 Spring Festival
  "2025-01-28",
  "2025-01-29",
  "2025-01-30",
  "2025-01-31",
  "2025-02-01",
  "2025-02-02",
  "2025-02-03",
  "2025-02-04",
  // 清明节 Qingming Festival
  "2025-04-04",
  "2025-04-05",
  "2025-04-06",
  // 劳动节 Labor Day
  "2025-05-01",
  "2025-05-02",
  "2025-05-03",
  "2025-05-04",
  "2025-05-05",
  // 端午节 Dragon Boat Festival
  "2025-05-31",
  "2025-06-01",
  "2025-06-02",
  // 中秋节 & 国庆节 Mid-Autumn & National Day (combined)
  "2025-10-01",
  "2025-10-02",
  "2025-10-03",
  "2025-10-04",
  "2025-10-05",
  "2025-10-06",
  "2025-10-07",
  "2025-10-08",
];

// 2026年节假日 (预估，实际以官方公布为准)
const HOLIDAYS_2026: string[] = [
  // 元旦 New Year's Day
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  // 春节 Spring Festival (预估)
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  // 清明节 Qingming Festival
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  // 劳动节 Labor Day
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  // 端午节 Dragon Boat Festival
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  // 中秋节 Mid-Autumn Festival
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  // 国庆节 National Day
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
];

// Combine all holidays into a Set for fast lookup
// 将所有节假日合并到Set中以便快速查找
const ALL_HOLIDAYS = new Set<string>([
  ...HOLIDAYS_2024,
  ...HOLIDAYS_2025,
  ...HOLIDAYS_2026,
]);

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Format a Date object to YYYY-MM-DD string
 * 将Date对象格式化为YYYY-MM-DD字符串
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date string to Date object (handles both YYYY-MM-DD and timestamps)
 * 解析日期字符串为Date对象(支持YYYY-MM-DD格式和时间戳)
 */
function parseDate(dateInput: string | number | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(dateInput.getTime());
  }
  if (typeof dateInput === "number") {
    // Assume Unix timestamp in seconds
    return new Date(dateInput * 1000);
  }
  // Parse YYYY-MM-DD format
  const parts = dateInput.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0] ?? "0", 10);
    const month = parseInt(parts[1] ?? "1", 10) - 1;
    const day = parseInt(parts[2] ?? "1", 10);
    return new Date(year, month, day);
  }
  return new Date(dateInput);
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * 检查日期是否为周末
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a Chinese public holiday
 * 检查日期是否为中国法定节假日
 */
function isHoliday(date: Date): boolean {
  const dateStr = formatDateString(date);
  return ALL_HOLIDAYS.has(dateStr);
}

// =============================================================================
// PUBLIC API / 公共接口
// =============================================================================

/**
 * Check if a given date is a trading day
 * 检查给定日期是否为交易日
 *
 * A trading day is a day that is:
 * - Not a weekend (Saturday or Sunday)
 * - Not a Chinese public holiday
 *
 * @param date - The date to check (Date, string YYYY-MM-DD, or Unix timestamp)
 * @returns Whether the date is a trading day
 */
export function isTradingDay(date: string | number | Date): boolean {
  const d = parseDate(date);

  // Check weekend
  if (isWeekend(d)) {
    return false;
  }

  // Check holiday
  if (isHoliday(d)) {
    return false;
  }

  return true;
}

/**
 * Get the next trading day after a given date
 * 获取给定日期之后的下一个交易日
 *
 * @param date - The starting date
 * @param includeSelf - Whether to include the starting date if it's a trading day (default: false)
 * @returns The next trading day as a Date object
 */
export function getNextTradingDay(
  date: string | number | Date,
  includeSelf: boolean = false,
): Date {
  let d = parseDate(date);

  // If not including self, start from next day
  if (!includeSelf) {
    d.setDate(d.getDate() + 1);
  }

  // Find the next trading day (max 30 days to prevent infinite loop)
  let attempts = 0;
  while (!isTradingDay(d) && attempts < 30) {
    d.setDate(d.getDate() + 1);
    attempts++;
  }

  return d;
}

/**
 * Get the previous trading day before a given date
 * 获取给定日期之前的上一个交易日
 *
 * @param date - The starting date
 * @param includeSelf - Whether to include the starting date if it's a trading day (default: false)
 * @returns The previous trading day as a Date object
 */
export function getPreviousTradingDay(
  date: string | number | Date,
  includeSelf: boolean = false,
): Date {
  let d = parseDate(date);

  // If not including self, start from previous day
  if (!includeSelf) {
    d.setDate(d.getDate() - 1);
  }

  // Find the previous trading day (max 30 days to prevent infinite loop)
  let attempts = 0;
  while (!isTradingDay(d) && attempts < 30) {
    d.setDate(d.getDate() - 1);
    attempts++;
  }

  return d;
}

/**
 * Count the number of trading days between two dates (exclusive of end date)
 * 计算两个日期之间的交易日数量(不包括结束日期)
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns Number of trading days between the dates
 */
export function getTradingDaysBetween(
  startDate: string | number | Date,
  endDate: string | number | Date,
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  // Ensure start <= end
  if (start > end) {
    return -getTradingDaysBetween(endDate, startDate);
  }

  let count = 0;
  const current = new Date(start.getTime());

  while (current < end) {
    if (isTradingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Add trading days to a date
 * 在日期上添加交易日
 *
 * @param date - The starting date
 * @param days - Number of trading days to add (can be negative)
 * @returns The resulting date after adding trading days
 */
export function addTradingDays(
  date: string | number | Date,
  days: number,
): Date {
  let d = parseDate(date);

  if (days === 0) {
    return d;
  }

  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);

  // Max iterations to prevent infinite loop
  const maxIterations = Math.abs(days) * 3 + 30;
  let iterations = 0;

  while (remaining > 0 && iterations < maxIterations) {
    d.setDate(d.getDate() + step);
    if (isTradingDay(d)) {
      remaining--;
    }
    iterations++;
  }

  return d;
}

/**
 * Get all trading days between two dates
 * 获取两个日期之间的所有交易日
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns Array of trading day strings in YYYY-MM-DD format
 */
export function getTradingDaysInRange(
  startDate: string | number | Date,
  endDate: string | number | Date,
): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  // Ensure start <= end
  if (start > end) {
    return getTradingDaysInRange(endDate, startDate).reverse();
  }

  const tradingDays: string[] = [];
  const current = new Date(start.getTime());

  while (current <= end) {
    if (isTradingDay(current)) {
      tradingDays.push(formatDateString(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return tradingDays;
}

/**
 * Validate if a date range is valid for backtesting
 * 验证日期范围是否适用于回测
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @param minTradingDays - Minimum required trading days (default: 20)
 * @returns Validation result object
 */
export function validateDateRange(
  startDate: string | number | Date,
  endDate: string | number | Date,
  minTradingDays: number = 20,
): {
  isValid: boolean;
  error?: string;
  tradingDays: number;
  startDate: string;
  endDate: string;
  adjustedStart?: string;
  adjustedEnd?: string;
} {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  // Check if end is after start
  if (end < start) {
    return {
      isValid: false,
      error: "结束日期必须晚于开始日期",
      tradingDays: 0,
      startDate: formatDateString(start),
      endDate: formatDateString(end),
    };
  }

  // Adjust to trading days
  const adjustedStart = getNextTradingDay(start, true);
  const adjustedEnd = getPreviousTradingDay(end, true);

  // Check if adjusted range is valid
  if (adjustedStart > adjustedEnd) {
    return {
      isValid: false,
      error: "调整后的日期范围内没有交易日",
      tradingDays: 0,
      startDate: formatDateString(start),
      endDate: formatDateString(end),
      adjustedStart: formatDateString(adjustedStart),
      adjustedEnd: formatDateString(adjustedEnd),
    };
  }

  // Count trading days
  const tradingDays = getTradingDaysBetween(adjustedStart, adjustedEnd) + 1;

  // Check minimum trading days
  if (tradingDays < minTradingDays) {
    return {
      isValid: false,
      error: `交易日数量不足: ${tradingDays}天 (最少需要${minTradingDays}天)`,
      tradingDays,
      startDate: formatDateString(start),
      endDate: formatDateString(end),
      adjustedStart: formatDateString(adjustedStart),
      adjustedEnd: formatDateString(adjustedEnd),
    };
  }

  return {
    isValid: true,
    tradingDays,
    startDate: formatDateString(start),
    endDate: formatDateString(end),
    adjustedStart: formatDateString(adjustedStart),
    adjustedEnd: formatDateString(adjustedEnd),
  };
}

/**
 * Get holiday information for a date
 * 获取日期的节假日信息
 *
 * @param date - The date to check
 * @returns Holiday name if it's a holiday, null otherwise
 */
export function getHolidayInfo(date: string | number | Date): string | null {
  const d = parseDate(date);
  const dateStr = formatDateString(d);

  if (!ALL_HOLIDAYS.has(dateStr)) {
    return null;
  }

  const month = d.getMonth() + 1;
  const day = d.getDate();

  // Determine holiday name based on date
  if (month === 1 && day <= 3) return "元旦";
  if (month === 1 && day >= 28) return "春节";
  if (month === 2 && day <= 17) return "春节";
  if (month === 4 && day >= 4 && day <= 6) return "清明节";
  if (month === 5 && day <= 5) return "劳动节";
  if (month === 5 && day >= 31) return "端午节";
  if (month === 6 && day <= 21) return "端午节";
  if (month === 9 && day >= 15 && day <= 27) return "中秋节";
  if (month === 10 && day <= 8) return "国庆节";

  return "节假日";
}

/**
 * Check if holiday data is available for a year
 * 检查某年的节假日数据是否可用
 *
 * @param year - The year to check
 * @returns Whether holiday data is available
 */
export function isHolidayDataAvailable(year: number): boolean {
  return year >= 2024 && year <= 2026;
}

/**
 * Format date for display (supports Chinese locale)
 * 格式化日期用于显示(支持中文)
 *
 * @param date - The date to format
 * @param format - Format style: 'short' | 'long' | 'full'
 * @returns Formatted date string
 */
export function formatDateDisplay(
  date: string | number | Date,
  format: "short" | "long" | "full" = "short",
): string {
  const d = parseDate(date);

  if (format === "short") {
    return formatDateString(d);
  }

  if (format === "long") {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const weekday = weekdays[d.getDay()] ?? "";
    return `${formatDateString(d)} ${weekday}`;
  }

  if (format === "full") {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const weekday = weekdays[d.getDay()] ?? "";
    const holiday = getHolidayInfo(d);
    const tradingStatus = isTradingDay(d) ? "交易日" : "非交易日";
    const holidayStr = holiday ? ` (${holiday})` : "";
    return `${formatDateString(d)} ${weekday} - ${tradingStatus}${holidayStr}`;
  }

  return formatDateString(d);
}
