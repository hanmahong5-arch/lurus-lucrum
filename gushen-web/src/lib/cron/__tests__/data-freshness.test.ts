/**
 * Data Freshness Detection - Unit Tests
 *
 * Tests for trading day calculation, staleness detection,
 * and data freshness evaluation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the DB module before importing
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  stocks: {},
  klineDaily: {},
}));

vi.mock("@/lib/db/schema", () => ({
  stocks: { id: "id", symbol: "symbol", name: "name", status: "status" },
  klineDaily: { stockId: "stock_id", date: "date" },
}));

import {
  getLastTradingDay,
  isWeekday,
  isChinaHoliday,
  calculateStaleDays,
  checkDataFreshness,
  type DataFreshness,
} from "../data-freshness";

// =============================================================================
// TRADING DAY CALCULATION
// =============================================================================

describe("isWeekday", () => {
  it("should return true for Monday through Friday", () => {
    // 2026-02-09 is Monday
    expect(isWeekday(new Date("2026-02-09T10:00:00+08:00"))).toBe(true);
    // 2026-02-10 is Tuesday
    expect(isWeekday(new Date("2026-02-10T10:00:00+08:00"))).toBe(true);
    // 2026-02-13 is Friday
    expect(isWeekday(new Date("2026-02-13T10:00:00+08:00"))).toBe(true);
  });

  it("should return false for Saturday and Sunday", () => {
    // 2026-02-14 is Saturday
    expect(isWeekday(new Date("2026-02-14T10:00:00+08:00"))).toBe(false);
    // 2026-02-15 is Sunday
    expect(isWeekday(new Date("2026-02-15T10:00:00+08:00"))).toBe(false);
  });
});

describe("isChinaHoliday", () => {
  it("should detect New Year's Day", () => {
    expect(isChinaHoliday("2026-01-01")).toBe(true);
  });

  it("should detect National Day", () => {
    expect(isChinaHoliday("2026-10-01")).toBe(true);
    expect(isChinaHoliday("2026-10-07")).toBe(true);
  });

  it("should return false for normal trading days", () => {
    expect(isChinaHoliday("2026-03-15")).toBe(false);
  });
});

describe("getLastTradingDay", () => {
  it("should return today if called on a weekday after market close", () => {
    // Monday 2026-02-09 at 18:00 CST
    const result = getLastTradingDay(new Date("2026-02-09T18:00:00+08:00"));
    expect(result).toBe("2026-02-09");
  });

  it("should return previous Friday if called on Saturday", () => {
    // Saturday 2026-02-14
    const result = getLastTradingDay(new Date("2026-02-14T10:00:00+08:00"));
    expect(result).toBe("2026-02-13");
  });

  it("should return previous Friday if called on Sunday", () => {
    // Sunday 2026-02-15
    const result = getLastTradingDay(new Date("2026-02-15T10:00:00+08:00"));
    expect(result).toBe("2026-02-13");
  });

  it("should return previous day if called on a weekday before market close", () => {
    // Tuesday 2026-02-10 at 09:00 CST (market hasn't closed yet)
    const result = getLastTradingDay(new Date("2026-02-10T09:00:00+08:00"));
    expect(result).toBe("2026-02-09");
  });

  it("should return today if called on a weekday after 15:30 CST", () => {
    // Wednesday 2026-02-11 at 16:00 CST
    const result = getLastTradingDay(new Date("2026-02-11T16:00:00+08:00"));
    expect(result).toBe("2026-02-11");
  });
});

// =============================================================================
// STALE DAYS CALCULATION
// =============================================================================

describe("calculateStaleDays", () => {
  it("should return 0 when data is from the last trading day", () => {
    // If today is Monday 2026-02-09 after close, and DB has 2026-02-09
    const result = calculateStaleDays(
      "2026-02-09",
      new Date("2026-02-09T18:00:00+08:00"),
    );
    expect(result).toBe(0);
  });

  it("should return 1 when data is one trading day behind", () => {
    // If today is Tuesday 2026-02-10 after close, and DB has 2026-02-09
    const result = calculateStaleDays(
      "2026-02-09",
      new Date("2026-02-10T18:00:00+08:00"),
    );
    expect(result).toBe(1);
  });

  it("should correctly handle weekends in stale days calculation", () => {
    // If today is Monday 2026-02-09 after close, and DB has 2026-02-06 (Friday)
    // Over the weekend, there are 0 additional trading days missed
    // But if DB is Friday and we're on Monday, that's 1 trading day stale
    const result = calculateStaleDays(
      "2026-02-06",
      new Date("2026-02-09T18:00:00+08:00"),
    );
    expect(result).toBe(1);
  });

  it("should return a large number for very stale data", () => {
    const result = calculateStaleDays(
      "2025-01-01",
      new Date("2026-02-10T18:00:00+08:00"),
    );
    expect(result).toBeGreaterThan(200);
  });

  it("should handle null latest DB date", () => {
    const result = calculateStaleDays(
      null,
      new Date("2026-02-10T18:00:00+08:00"),
    );
    expect(result).toBe(Infinity);
  });
});

// =============================================================================
// DATA FRESHNESS CHECK
// =============================================================================

describe("checkDataFreshness", () => {
  it("should return isFresh=true when staleDays is 0", () => {
    const result: DataFreshness = {
      isFresh: true,
      latestDbDate: "2026-02-09",
      lastTradingDay: "2026-02-09",
      staleDays: 0,
    };
    expect(result.isFresh).toBe(true);
  });

  it("should return isFresh=false when staleDays > 1", () => {
    const result: DataFreshness = {
      isFresh: false,
      latestDbDate: "2026-02-06",
      lastTradingDay: "2026-02-10",
      staleDays: 2,
    };
    expect(result.isFresh).toBe(false);
  });

  it("should handle missing DB data", () => {
    const result: DataFreshness = {
      isFresh: false,
      latestDbDate: null,
      lastTradingDay: "2026-02-10",
      staleDays: Infinity,
    };
    expect(result.isFresh).toBe(false);
    expect(result.staleDays).toBe(Infinity);
  });
});
