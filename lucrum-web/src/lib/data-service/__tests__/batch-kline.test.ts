/**
 * Batch K-Line Data Fetcher - Comprehensive Tests
 * 批量K线数据获取器 - 全面测试
 *
 * Covers:
 * - Multi-source failover (EastMoney → Sina)
 * - Retry with exponential backoff
 * - Timeout handling
 * - Batch concurrency control
 * - Date range filtering
 * - Price adjustment (forward/backward)
 * - Edge cases (empty data, partial failures, all failures)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock data sources BEFORE importing the module under test
vi.mock("../sources/eastmoney", () => ({
  getKLineData: vi.fn(),
}));
vi.mock("../sources/sina", () => ({
  getKLineData: vi.fn(),
}));
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  batchGetKlines,
  batchGetKlinesWithDateRange,
  filterByDateRange,
  adjustPrices,
} from "../batch-kline";
import { getKLineData as mockEastmoney } from "../sources/eastmoney";
import { getKLineData as mockSina } from "../sources/sina";
import { logger } from "../logger";
import type { KLineData, ApiResponse } from "../types";

// =============================================================================
// TEST HELPERS / 测试辅助
// =============================================================================

const DAY_SECONDS = 86400;
const BASE_TIME = 1704067200; // 2024-01-01 00:00:00 UTC

/** Create deterministic K-line array */
function createKlines(
  count: number,
  basePrice: number = 10,
  startTime: number = BASE_TIME,
): KLineData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * DAY_SECONDS,
    open: +(basePrice + i * 0.1).toFixed(2),
    high: +(basePrice + i * 0.1 + 0.5).toFixed(2),
    low: +(basePrice + i * 0.1 - 0.3).toFixed(2),
    close: +(basePrice + (i + 1) * 0.1).toFixed(2),
    volume: 100000 + i * 1000,
    amount: (100000 + i * 1000) * basePrice,
  }));
}

/** Create a successful API response */
function successResponse(data: KLineData[]): ApiResponse<KLineData[]> {
  return {
    success: true,
    data,
    source: "test",
    cached: false,
    timestamp: Date.now(),
    latency: 50,
  };
}

/** Create a failed API response */
function failResponse(error: string): ApiResponse<KLineData[]> {
  return {
    success: false,
    data: null,
    error,
    source: "test",
    cached: false,
    timestamp: Date.now(),
    latency: 0,
  };
}

/** Short retry config for fast tests */
const FAST_RETRY = { maxRetries: 1, baseDelay: 1, maxDelay: 2 };

// =============================================================================
// TESTS
// =============================================================================

describe("batch-kline", () => {
  const eastmoney = mockEastmoney as ReturnType<typeof vi.fn>;
  const sina = mockSina as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // 1. Multi-source failover / 多数据源故障转移
  // ===========================================================================

  describe("multi-source failover / 多数据源故障转移", () => {
    it("should use primary source (EastMoney) when available", async () => {
      console.log("[Step 1] Primary source responds OK → should use EastMoney");
      const klines = createKlines(5);
      eastmoney.mockResolvedValue(successResponse(klines));

      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] success=${result.statistics.successCount}, failed=${result.statistics.failedCount}`);
      expect(result.data.size).toBe(1);
      expect(result.data.get("600519")).toHaveLength(5);
      expect(eastmoney).toHaveBeenCalled();
      expect(sina).not.toHaveBeenCalled();
    });

    it("should fallback to Sina when EastMoney fails", async () => {
      console.log("[Step 1] EastMoney fails all retries");
      eastmoney.mockResolvedValue(failResponse("EastMoney API error"));

      console.log("[Step 2] Sina responds OK → should use Sina as fallback");
      const klines = createKlines(5, 20);
      sina.mockResolvedValue(successResponse(klines));

      const result = await batchGetKlines(["000001"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] success=${result.statistics.successCount}, source used=sina`);
      expect(result.data.size).toBe(1);
      expect(result.data.get("000001")).toHaveLength(5);
      expect(eastmoney).toHaveBeenCalled();
      expect(sina).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("fallback source"),
      );
    });

    it("should return failure when ALL sources fail (no mock degradation)", async () => {
      console.log("[Step 1] EastMoney fails");
      eastmoney.mockResolvedValue(failResponse("EastMoney down"));

      console.log("[Step 2] Sina also fails");
      sina.mockResolvedValue(failResponse("Sina down"));

      console.log("[Step 3] Expect explicit failure, NOT mock data");
      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      expect(result.data.size).toBe(0);
      expect(result.errors.size).toBe(1);
      expect(result.errors.get("600519")).toContain("All data sources failed");
      console.log(`[Result] Correctly failed: ${result.errors.get("600519")}`);
    });

    it("should fallback to Sina on EastMoney timeout (exception path)", async () => {
      console.log("[Step 1] EastMoney throws timeout error");
      eastmoney.mockRejectedValue(new Error("Request timeout"));

      console.log("[Step 2] Sina responds OK");
      const klines = createKlines(3);
      sina.mockResolvedValue(successResponse(klines));

      const result = await batchGetKlines(["601398"], "1d", 3, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] success=${result.statistics.successCount}, fallback used`);
      expect(result.data.size).toBe(1);
      expect(result.statistics.successCount).toBe(1);
    });
  });

  // ===========================================================================
  // 2. Retry mechanism / 重试机制
  // ===========================================================================

  describe("retry mechanism / 重试机制", () => {
    it("should retry failed requests with exponential backoff", async () => {
      console.log("[Step 1] First attempt fails");
      eastmoney
        .mockResolvedValueOnce(failResponse("Temporary error"))
        .mockResolvedValueOnce(successResponse(createKlines(5)));

      console.log("[Step 2] Second attempt succeeds");
      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: { maxRetries: 2, baseDelay: 1, maxDelay: 5 },
        timeout: 5000,
      });

      expect(result.data.size).toBe(1);
      // EastMoney called twice (first fail, second success)
      expect(eastmoney).toHaveBeenCalledTimes(2);
      expect(sina).not.toHaveBeenCalled();
      console.log(`[Result] Recovered on retry, Sina not needed`);
    });

    it("should exhaust retries before trying next source", async () => {
      console.log("[Step 1] EastMoney fails all 3 attempts");
      eastmoney.mockResolvedValue(failResponse("Persistent error"));

      console.log("[Step 2] Sina succeeds on first attempt");
      sina.mockResolvedValue(successResponse(createKlines(5)));

      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: { maxRetries: 2, baseDelay: 1, maxDelay: 2 },
        timeout: 5000,
      });

      // EastMoney: 1 initial + 2 retries = 3
      expect(eastmoney).toHaveBeenCalledTimes(3);
      // Sina: 1 initial only (succeeds)
      expect(sina).toHaveBeenCalledTimes(1);
      expect(result.data.size).toBe(1);
      console.log(`[Result] EastMoney: 3 attempts, Sina: 1 attempt → success`);
    });

    it("should invoke onError callback on each failure", async () => {
      const onError = vi.fn();
      eastmoney.mockRejectedValue(new Error("Network error"));
      sina.mockResolvedValue(successResponse(createKlines(3)));

      await batchGetKlines(["600519"], "1d", 3, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
        onError,
      });

      console.log(`[Result] onError called ${onError.mock.calls.length} times`);
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0]![0]).toBe("600519");
      expect(onError.mock.calls[0]![1]).toBeInstanceOf(Error);
    });
  });

  // ===========================================================================
  // 3. Batch concurrency / 批量并发
  // ===========================================================================

  describe("batch concurrency / 批量并发", () => {
    it("should process multiple symbols with concurrency control", async () => {
      const symbols = ["600519", "000001", "601398", "600036", "000858"];
      console.log(`[Step 1] Fetching ${symbols.length} symbols concurrently`);

      eastmoney.mockImplementation((symbol: string) =>
        Promise.resolve(successResponse(createKlines(5, Number(symbol.slice(0, 2))))),
      );

      const progressCalls: [number, number, string][] = [];
      const result = await batchGetKlines(symbols, "1d", 5, {
        concurrency: 3,
        retryConfig: FAST_RETRY,
        timeout: 5000,
        onProgress: (completed, total, symbol) => {
          progressCalls.push([completed, total, symbol]);
          console.log(`  [Progress] ${completed}/${total} - ${symbol}`);
        },
      });

      expect(result.data.size).toBe(5);
      expect(result.statistics.successCount).toBe(5);
      expect(result.statistics.failedCount).toBe(0);
      expect(progressCalls).toHaveLength(5);
      console.log(`[Result] All ${result.data.size} symbols fetched`);
    });

    it("should handle partial failures in a batch", async () => {
      console.log("[Step 1] 2/3 symbols succeed, 1 fails from all sources");

      eastmoney.mockImplementation((symbol: string) => {
        if (symbol === "FAIL01") return Promise.resolve(failResponse("Not found"));
        return Promise.resolve(successResponse(createKlines(5)));
      });
      sina.mockImplementation((symbol: string) => {
        if (symbol === "FAIL01") return Promise.resolve(failResponse("Not found on Sina"));
        return Promise.resolve(successResponse(createKlines(5)));
      });

      const result = await batchGetKlines(
        ["600519", "FAIL01", "000001"],
        "1d",
        5,
        { retryConfig: FAST_RETRY, timeout: 5000 },
      );

      console.log(`[Result] success=${result.statistics.successCount}, failed=${result.statistics.failedCount}`);
      expect(result.data.size).toBe(2);
      expect(result.errors.size).toBe(1);
      expect(result.errors.has("FAIL01")).toBe(true);
    });

    it("should deduplicate symbols", async () => {
      eastmoney.mockResolvedValue(successResponse(createKlines(3)));

      const result = await batchGetKlines(
        ["600519", "600519", "600519"],
        "1d",
        3,
        { retryConfig: FAST_RETRY, timeout: 5000 },
      );

      console.log(`[Result] Deduped to ${result.statistics.totalSymbols} symbol(s)`);
      expect(result.statistics.totalSymbols).toBe(1);
      expect(eastmoney).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 4. Date range filtering / 日期范围过滤
  // ===========================================================================

  describe("filterByDateRange", () => {
    it("should filter K-lines within date range", () => {
      // Create 10 days starting 2024-01-01
      const klines = createKlines(10);
      console.log(`[Step 1] ${klines.length} K-lines, filtering 2024-01-03 to 2024-01-07`);

      const filtered = filterByDateRange(klines, "2024-01-03", "2024-01-07");

      console.log(`[Result] ${filtered.length} K-lines after filtering`);
      // filterByDateRange includes endDate boundary (+86400s), so 6 bars match
      expect(filtered.length).toBe(6);
      expect(filtered[0]!.time).toBeGreaterThanOrEqual(
        new Date("2024-01-03").getTime() / 1000,
      );
    });

    it("should return empty array when range has no data", () => {
      const klines = createKlines(5); // Jan 1-5
      const filtered = filterByDateRange(klines, "2025-01-01", "2025-12-31");

      console.log(`[Result] No data in future range: ${filtered.length} items`);
      expect(filtered).toHaveLength(0);
    });

    it("should include end date boundary (inclusive)", () => {
      const klines = createKlines(3); // Jan 1,2,3
      const filtered = filterByDateRange(klines, "2024-01-03", "2024-01-03");

      console.log(`[Result] Single-day filter: ${filtered.length} items`);
      expect(filtered.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 5. batchGetKlinesWithDateRange / 带日期的批量获取
  // ===========================================================================

  describe("batchGetKlinesWithDateRange", () => {
    it("should fetch and filter by date range", async () => {
      console.log("[Step 1] Fetch 200 K-lines, filter to 5-day range");
      // Return K-lines spanning a wide range
      const wideKlines = createKlines(200);
      eastmoney.mockResolvedValue(successResponse(wideKlines));

      const result = await batchGetKlinesWithDateRange(
        ["600519"],
        "1d",
        "2024-01-03",
        "2024-01-07",
        { retryConfig: FAST_RETRY, timeout: 5000 },
      );

      console.log(`[Result] Filtered to ${result.statistics.totalKlines} K-lines`);
      expect(result.data.size).toBe(1);
      const klines = result.data.get("600519")!;
      expect(klines.length).toBeLessThanOrEqual(10); // Filtered down
    });

    it("should exclude symbols with no data in date range", async () => {
      console.log("[Step 1] K-lines outside requested date range");
      const oldKlines = createKlines(5, 10, 946684800); // Year 2000
      eastmoney.mockResolvedValue(successResponse(oldKlines));

      const result = await batchGetKlinesWithDateRange(
        ["600519"],
        "1d",
        "2024-06-01",
        "2024-06-30",
        { retryConfig: FAST_RETRY, timeout: 5000 },
      );

      console.log(`[Result] successCount=${result.statistics.successCount} (data outside range)`);
      expect(result.data.size).toBe(0);
    });
  });

  // ===========================================================================
  // 6. Price adjustment / 复权处理
  // ===========================================================================

  describe("adjustPrices / 复权处理", () => {
    it("should return unchanged data when type is 'none'", () => {
      const klines = createKlines(5);
      const result = adjustPrices(klines, "none");
      expect(result).toEqual(klines);
    });

    it("should return unchanged data when no adjustment points detected", () => {
      // Smooth price series with no gaps > 8%
      const klines = createKlines(10, 50);
      const result = adjustPrices(klines, "forward");
      expect(result).toEqual(klines);
    });

    it("should detect and adjust for dividend gap (forward)", () => {
      console.log("[Step 1] Create K-lines with a 10% ex-dividend drop");
      const klines: KLineData[] = [
        { time: BASE_TIME, open: 100, high: 102, low: 99, close: 100, volume: 10000 },
        { time: BASE_TIME + DAY_SECONDS, open: 100.5, high: 101, low: 99.5, close: 101, volume: 10000 },
        // Ex-dividend: previous close 101, new open 89 (>8% gap)
        { time: BASE_TIME + 2 * DAY_SECONDS, open: 89, high: 90, low: 88, close: 89.5, volume: 15000 },
        { time: BASE_TIME + 3 * DAY_SECONDS, open: 89.5, high: 91, low: 89, close: 90, volume: 10000 },
      ];

      const adjusted = adjustPrices(klines, "forward");

      console.log(`[Step 2] Pre-dividend prices should be adjusted down`);
      // Pre-dividend klines (index 0,1) should be scaled down
      expect(adjusted[0]!.close).toBeLessThan(100);
      // Post-dividend klines (index 2,3) should be unchanged
      expect(adjusted[2]!.close).toBeCloseTo(89.5, 1);
      expect(adjusted[3]!.close).toBeCloseTo(90, 1);
      console.log(`[Result] Pre-dividend close: ${adjusted[0]!.close} (adjusted from 100)`);
    });

    it("should handle empty/single-element arrays gracefully", () => {
      expect(adjustPrices([], "forward")).toEqual([]);
      const single = [createKlines(1)[0]!];
      expect(adjustPrices(single, "backward")).toEqual(single);
    });
  });

  // ===========================================================================
  // 7. Edge cases / 边缘场景
  // ===========================================================================

  describe("edge cases / 边缘场景", () => {
    it("should handle empty symbol list", async () => {
      const result = await batchGetKlines([], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] Empty input → ${result.data.size} results`);
      expect(result.data.size).toBe(0);
      expect(result.errors.size).toBe(0);
      expect(eastmoney).not.toHaveBeenCalled();
    });

    it("should handle source returning empty data array", async () => {
      eastmoney.mockResolvedValue(successResponse([]));

      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
        skipEmpty: true,
      });

      console.log(`[Result] Empty data with skipEmpty=true → excluded`);
      expect(result.data.size).toBe(0); // Skipped because empty
    });

    it("should include empty data when skipEmpty=false", async () => {
      eastmoney.mockResolvedValue(successResponse([]));

      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
        skipEmpty: false,
      });

      console.log(`[Result] Empty data with skipEmpty=false → included`);
      expect(result.data.size).toBe(1);
      expect(result.data.get("600519")).toHaveLength(0);
    });

    it("should calculate correct statistics", async () => {
      eastmoney.mockImplementation((symbol: string) => {
        if (symbol === "BAD") return Promise.resolve(failResponse("Error"));
        return Promise.resolve(successResponse(createKlines(10)));
      });
      sina.mockResolvedValue(failResponse("Also error"));

      const result = await batchGetKlines(
        ["600519", "BAD", "000001"],
        "1d",
        10,
        { retryConfig: FAST_RETRY, timeout: 5000 },
      );

      const stats = result.statistics;
      console.log(`[Result] total=${stats.totalSymbols}, ok=${stats.successCount}, fail=${stats.failedCount}, klines=${stats.totalKlines}`);
      expect(stats.totalSymbols).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failedCount).toBe(1);
      expect(stats.totalKlines).toBe(20); // 2 * 10
      expect(stats.totalTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle exceptions thrown by data source", async () => {
      eastmoney.mockRejectedValue(new TypeError("fetch failed"));
      sina.mockRejectedValue(new Error("Sina also down"));

      const result = await batchGetKlines(["600519"], "1d", 5, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] Both sources threw → errors: ${result.errors.get("600519")}`);
      expect(result.data.size).toBe(0);
      expect(result.errors.size).toBe(1);
    });
  });

  // ===========================================================================
  // 8. Business scenarios / 业务场景
  // ===========================================================================

  describe("business scenarios / 业务场景", () => {
    it("should handle sector-wide batch (30+ stocks)", async () => {
      const symbols = Array.from({ length: 30 }, (_, i) =>
        String(600000 + i).padStart(6, "0"),
      );
      console.log(`[Step 1] Batch fetching ${symbols.length} sector stocks`);

      eastmoney.mockImplementation((symbol: string) =>
        Promise.resolve(successResponse(createKlines(120, 10 + Number(symbol.slice(-2))))),
      );

      const result = await batchGetKlines(symbols, "1d", 120, {
        concurrency: 10,
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] ${result.statistics.successCount}/30 stocks, ${result.statistics.totalKlines} total K-lines`);
      expect(result.statistics.successCount).toBe(30);
      expect(result.statistics.totalKlines).toBe(30 * 120);
    });

    it("should handle mixed success/failure in realistic scenario", async () => {
      console.log("[Step 1] Realistic scenario: 5 stocks, 2 fail EastMoney but recover via Sina");

      const failSet = new Set(["600036", "000858"]);

      eastmoney.mockImplementation((symbol: string) => {
        if (failSet.has(symbol)) return Promise.resolve(failResponse("Rate limited"));
        return Promise.resolve(successResponse(createKlines(60)));
      });

      sina.mockImplementation((symbol: string) => {
        if (failSet.has(symbol)) return Promise.resolve(successResponse(createKlines(60, 30)));
        return Promise.resolve(successResponse(createKlines(60)));
      });

      const symbols = ["600519", "000001", "600036", "000858", "601398"];
      const result = await batchGetKlines(symbols, "1d", 60, {
        retryConfig: FAST_RETRY,
        timeout: 5000,
      });

      console.log(`[Result] All 5 fetched: ${result.statistics.successCount} success, ${result.statistics.failedCount} failed`);
      expect(result.statistics.successCount).toBe(5);
      expect(result.statistics.failedCount).toBe(0);
    });
  });
});
