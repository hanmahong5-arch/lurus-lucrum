/**
 * Trading Time Utilities
 * 交易时间工具
 *
 * Provides utilities for A-share market trading hours detection and display.
 * A股交易时间: 9:30-11:30, 13:00-15:00 (周一至周五，节假日除外)
 *
 * @module lib/trading/time-utils
 */

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Trading session status
 */
export type TradingStatus =
  | "pre_market" // 盘前 (9:15-9:25 集合竞价)
  | "call_auction" // 集合竞价 (9:25-9:30)
  | "morning_session" // 上午连续竞价 (9:30-11:30)
  | "lunch_break" // 午休 (11:30-13:00)
  | "afternoon_session" // 下午连续竞价 (13:00-14:57)
  | "closing_auction" // 收盘集合竞价 (14:57-15:00)
  | "after_hours" // 盘后 (15:00-)
  | "closed"; // 休市 (周末/节假日)

/**
 * Trading status info for display
 */
export interface TradingStatusInfo {
  status: TradingStatus;
  label: string; // 中文标签
  labelEn: string; // English label
  color: "green" | "yellow" | "red" | "gray"; // Status color
  isTrading: boolean; // Whether can place orders
  canTrade: boolean; // Whether market accepts orders
  nextEvent: string; // Next market event description
  nextEventTime: Date | null; // Time of next event
}

/**
 * Market hours configuration
 */
export interface MarketHours {
  preMarketStart: string; // "09:15"
  callAuctionEnd: string; // "09:30"
  morningStart: string; // "09:30"
  morningEnd: string; // "11:30"
  afternoonStart: string; // "13:00"
  closingAuctionStart: string; // "14:57"
  marketClose: string; // "15:00"
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/**
 * A-share market hours
 */
export const A_SHARE_HOURS: MarketHours = {
  preMarketStart: "09:15",
  callAuctionEnd: "09:30",
  morningStart: "09:30",
  morningEnd: "11:30",
  afternoonStart: "13:00",
  closingAuctionStart: "14:57",
  marketClose: "15:00",
};

/**
 * 2026 China public holidays (approximate - should be updated yearly)
 * 2026年中国法定节假日（需每年更新）
 */
const CHINA_HOLIDAYS_2026 = [
  // New Year / 元旦
  "2026-01-01",
  // Spring Festival / 春节 (approximate)
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  // Qingming / 清明节
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  // Labor Day / 劳动节
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  // Dragon Boat / 端午节
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  // Mid-Autumn / 中秋节
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  // National Day / 国庆节
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
];

// =============================================================================
// TIME PARSING / 时间解析
// =============================================================================

/**
 * Parse time string to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Get current time in China timezone (UTC+8)
 */
export function getChinaTime(date?: Date): Date {
  const d = date ?? new Date();
  // Convert to China timezone
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000);
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format time to HH:MM:SS
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// =============================================================================
// TRADING DAY DETECTION / 交易日检测
// =============================================================================

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Check if a date is a Chinese public holiday
 */
export function isHoliday(date: Date): boolean {
  const dateStr = formatDate(date);
  return CHINA_HOLIDAYS_2026.includes(dateStr);
}

/**
 * Check if a date is a trading day
 */
export function isTradingDay(date?: Date): boolean {
  const d = getChinaTime(date);
  return !isWeekend(d) && !isHoliday(d);
}

/**
 * Get the current or previous trading day
 */
export function getCurrentTradingDay(date?: Date): Date {
  let d = getChinaTime(date);

  // If after market close, use current day; otherwise check if it's a trading day
  const minutes = d.getHours() * 60 + d.getMinutes();
  const marketClose = parseTimeToMinutes(A_SHARE_HOURS.marketClose);

  // If it's a trading day and market is still open or just closed, use today
  if (isTradingDay(d)) {
    return d;
  }

  // Find the most recent trading day
  while (!isTradingDay(d)) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  }

  return d;
}

/**
 * Get the next trading day
 */
export function getNextTradingDay(date?: Date): Date {
  let d = getChinaTime(date);
  d = new Date(d.getTime() + 24 * 60 * 60 * 1000); // Start from tomorrow

  while (!isTradingDay(d)) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }

  return d;
}

// =============================================================================
// TRADING STATUS DETECTION / 交易状态检测
// =============================================================================

/**
 * Get current trading status
 */
export function getTradingStatus(date?: Date): TradingStatus {
  const d = getChinaTime(date);

  // Check if it's a trading day
  if (!isTradingDay(d)) {
    return "closed";
  }

  const minutes = d.getHours() * 60 + d.getMinutes();

  const preMarketStart = parseTimeToMinutes(A_SHARE_HOURS.preMarketStart);
  const callAuctionEnd = parseTimeToMinutes(A_SHARE_HOURS.callAuctionEnd);
  const morningEnd = parseTimeToMinutes(A_SHARE_HOURS.morningEnd);
  const afternoonStart = parseTimeToMinutes(A_SHARE_HOURS.afternoonStart);
  const closingAuctionStart = parseTimeToMinutes(
    A_SHARE_HOURS.closingAuctionStart
  );
  const marketClose = parseTimeToMinutes(A_SHARE_HOURS.marketClose);

  if (minutes < preMarketStart) {
    return "closed"; // Before pre-market
  } else if (minutes < callAuctionEnd - 5) {
    // 9:15-9:25
    return "pre_market";
  } else if (minutes < callAuctionEnd) {
    // 9:25-9:30
    return "call_auction";
  } else if (minutes < morningEnd) {
    // 9:30-11:30
    return "morning_session";
  } else if (minutes < afternoonStart) {
    // 11:30-13:00
    return "lunch_break";
  } else if (minutes < closingAuctionStart) {
    // 13:00-14:57
    return "afternoon_session";
  } else if (minutes < marketClose) {
    // 14:57-15:00
    return "closing_auction";
  } else {
    // After 15:00
    return "after_hours";
  }
}

/**
 * Get detailed trading status info for display
 */
export function getTradingStatusInfo(date?: Date): TradingStatusInfo {
  const status = getTradingStatus(date);
  const d = getChinaTime(date);

  switch (status) {
    case "pre_market":
      return {
        status,
        label: "集合竞价",
        labelEn: "Pre-market Auction",
        color: "yellow",
        isTrading: false,
        canTrade: true,
        nextEvent: "开盘",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.morningStart),
      };

    case "call_auction":
      return {
        status,
        label: "集合竞价",
        labelEn: "Call Auction",
        color: "yellow",
        isTrading: false,
        canTrade: false, // 9:25-9:30 不能撤单
        nextEvent: "开盘",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.morningStart),
      };

    case "morning_session":
      return {
        status,
        label: "交易中",
        labelEn: "Trading",
        color: "green",
        isTrading: true,
        canTrade: true,
        nextEvent: "午休",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.morningEnd),
      };

    case "lunch_break":
      return {
        status,
        label: "午间休市",
        labelEn: "Lunch Break",
        color: "yellow",
        isTrading: false,
        canTrade: true,
        nextEvent: "下午开盘",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.afternoonStart),
      };

    case "afternoon_session":
      return {
        status,
        label: "交易中",
        labelEn: "Trading",
        color: "green",
        isTrading: true,
        canTrade: true,
        nextEvent: "收盘集合竞价",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.closingAuctionStart),
      };

    case "closing_auction":
      return {
        status,
        label: "收盘竞价",
        labelEn: "Closing Auction",
        color: "yellow",
        isTrading: false,
        canTrade: true,
        nextEvent: "收盘",
        nextEventTime: getTimeToday(d, A_SHARE_HOURS.marketClose),
      };

    case "after_hours":
      return {
        status,
        label: "已收盘",
        labelEn: "Market Closed",
        color: "gray",
        isTrading: false,
        canTrade: false,
        nextEvent: "下一交易日开盘",
        nextEventTime: getNextOpenTime(d),
      };

    case "closed":
    default:
      return {
        status: "closed",
        label: "休市",
        labelEn: "Closed",
        color: "gray",
        isTrading: false,
        canTrade: false,
        nextEvent: "下一交易日开盘",
        nextEventTime: getNextOpenTime(d),
      };
  }
}

/**
 * Get a specific time on a given day
 */
function getTimeToday(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

/**
 * Get the next market open time
 */
export function getNextOpenTime(date?: Date): Date {
  const d = getChinaTime(date);
  const status = getTradingStatus(d);

  // If we're before morning session on a trading day
  if (
    isTradingDay(d) &&
    (status === "pre_market" || status === "call_auction")
  ) {
    return getTimeToday(d, A_SHARE_HOURS.morningStart);
  }

  // If we're in lunch break
  if (status === "lunch_break") {
    return getTimeToday(d, A_SHARE_HOURS.afternoonStart);
  }

  // Otherwise, find next trading day
  const nextDay = getNextTradingDay(d);
  return getTimeToday(nextDay, A_SHARE_HOURS.morningStart);
}

/**
 * Get time remaining until next event in milliseconds
 */
export function getTimeToNextEvent(date?: Date): number {
  const info = getTradingStatusInfo(date);
  if (!info.nextEventTime) return 0;

  const d = getChinaTime(date);
  return info.nextEventTime.getTime() - d.getTime();
}

// =============================================================================
// CONVENIENCE FUNCTIONS / 便捷函数
// =============================================================================

/**
 * Check if market is currently open for trading
 */
export function isMarketOpen(date?: Date): boolean {
  const status = getTradingStatus(date);
  return status === "morning_session" || status === "afternoon_session";
}

/**
 * Check if market accepts orders (including pre-market)
 */
export function canPlaceOrder(date?: Date): boolean {
  const info = getTradingStatusInfo(date);
  return info.canTrade;
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "即将";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * Get display timestamp for market data
 * Returns appropriate label based on trading status
 */
export function getDataTimestampLabel(date?: Date): string {
  const d = getChinaTime(date);
  const status = getTradingStatus(d);

  if (status === "morning_session" || status === "afternoon_session") {
    return `实时 ${formatTime(d)}`;
  } else if (status === "lunch_break") {
    return `上午收盘 11:30`;
  } else if (status === "after_hours" || status === "closing_auction") {
    return `收盘 ${formatDate(d)}`;
  } else {
    const lastTradingDay = getCurrentTradingDay(d);
    return `收盘 ${formatDate(lastTradingDay)}`;
  }
}
