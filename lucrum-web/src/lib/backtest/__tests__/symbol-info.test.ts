/**
 * Tests for symbol-info module
 * Covers all exported functions with focus on previously untested ones.
 */
import { describe, it, expect } from "vitest";
import {
  getSymbolName,
  formatSymbolDisplay,
  getQuantityUnit,
  getMarketName,
  formatQuantityWithLots,
  isSymbolMapped,
  getSymbolsByMarket,
  searchSymbols,
  SYMBOL_NAME_MAP,
} from "../symbol-info";

// =============================================================================
// getSymbolName
// =============================================================================
describe("getSymbolName", () => {
  it("returns empty string for empty input", () => {
    expect(getSymbolName("")).toBe("");
  });

  it("resolves A-share stock by exact code", () => {
    expect(getSymbolName("600519.SH")).toBe("贵州茅台");
  });

  it("resolves Shenzhen stock", () => {
    expect(getSymbolName("000858.SZ")).toBe("五粮液");
  });

  it("handles Yahoo Finance .SS suffix", () => {
    expect(getSymbolName("600519.SS")).toBe("贵州茅台");
  });

  it("resolves case-insensitively", () => {
    expect(getSymbolName("600519.sh")).toBe("贵州茅台");
  });

  it("resolves futures base code (e.g. AU2406 -> 黄金期货)", () => {
    expect(getSymbolName("AU2406")).toBe("黄金期货");
  });

  it("resolves crypto symbol", () => {
    expect(getSymbolName("BTC/USDT")).toBe("比特币");
  });

  it("returns original symbol when not found", () => {
    expect(getSymbolName("UNKNOWN123")).toBe("UNKNOWN123");
  });

  it("trims whitespace before lookup", () => {
    expect(getSymbolName("  600519.SH  ")).toBe("贵州茅台");
  });
});

// =============================================================================
// formatSymbolDisplay
// =============================================================================
describe("formatSymbolDisplay", () => {
  it("formats mapped symbol as 'name (code)'", () => {
    expect(formatSymbolDisplay("600519.SH")).toBe("贵州茅台 (600519)");
  });

  it("returns raw symbol when not mapped", () => {
    expect(formatSymbolDisplay("ZZZZZZ")).toBe("ZZZZZZ");
  });
});

// =============================================================================
// getQuantityUnit
// =============================================================================
describe("getQuantityUnit", () => {
  it("returns 股 for stock", () => {
    expect(getQuantityUnit("600519.SH")).toBe("股");
  });

  it("returns 股 for ETF", () => {
    expect(getQuantityUnit("510050.SH")).toBe("股");
  });

  it("returns 手 for futures", () => {
    expect(getQuantityUnit("AU2406")).toBe("手");
  });

  it("returns 个 for crypto", () => {
    expect(getQuantityUnit("BTC/USDT")).toBe("个");
  });
});

// =============================================================================
// getMarketName
// =============================================================================
describe("getMarketName", () => {
  it("returns empty for empty input", () => {
    expect(getMarketName("")).toBe("");
  });

  it("detects Shanghai by .SH suffix", () => {
    expect(getMarketName("600519.SH")).toBe("上海");
  });

  it("detects Shanghai by .SS suffix", () => {
    expect(getMarketName("600519.SS")).toBe("上海");
  });

  it("detects Shenzhen by .SZ suffix", () => {
    expect(getMarketName("000858.SZ")).toBe("深圳");
  });

  it("detects Beijing by .BJ suffix", () => {
    expect(getMarketName("830799.BJ")).toBe("北京");
  });

  it("detects Shanghai by 6xxxxx code pattern", () => {
    expect(getMarketName("600519")).toBe("上海");
  });

  it("detects Shenzhen by 0xxxxx code pattern", () => {
    expect(getMarketName("000858")).toBe("深圳");
  });

  it("detects Shenzhen by 3xxxxx code pattern", () => {
    expect(getMarketName("300750")).toBe("深圳");
  });

  it("detects Beijing by 8xxxxx code pattern", () => {
    expect(getMarketName("830799")).toBe("北京");
  });

  it("detects futures market", () => {
    expect(getMarketName("AU")).toBe("期货");
  });

  it("detects crypto market", () => {
    expect(getMarketName("BTC/USDT")).toBe("加密");
  });
});

// =============================================================================
// formatQuantityWithLots
// =============================================================================
describe("formatQuantityWithLots", () => {
  it("shows lots when lotSize > 1", () => {
    expect(formatQuantityWithLots(500, 100)).toBe("500股 (5手)");
  });

  it("omits lots display when lotSize is 1", () => {
    expect(formatQuantityWithLots(3, 1, "个")).toBe("3个");
  });

  it("floors partial lots", () => {
    expect(formatQuantityWithLots(150, 100)).toBe("150股 (1手)");
  });

  it("uses custom unit", () => {
    expect(formatQuantityWithLots(20, 10, "张")).toBe("20张 (2手)");
  });
});

// =============================================================================
// isSymbolMapped
// =============================================================================
describe("isSymbolMapped", () => {
  it("returns true for mapped symbol", () => {
    expect(isSymbolMapped("600519.SH")).toBe(true);
  });

  it("returns false for unmapped symbol", () => {
    expect(isSymbolMapped("XYZXYZ")).toBe(false);
  });
});

// =============================================================================
// getSymbolsByMarket
// =============================================================================
describe("getSymbolsByMarket", () => {
  it("filters Shanghai symbols", () => {
    const shSymbols = getSymbolsByMarket("SH");
    expect(shSymbols.length).toBeGreaterThan(0);
    expect(shSymbols.every((s) => s.endsWith(".SH"))).toBe(true);
  });

  it("filters Beijing symbols", () => {
    const bjSymbols = getSymbolsByMarket("BJ");
    expect(bjSymbols.length).toBeGreaterThan(0);
    expect(bjSymbols[0]!.endsWith(".BJ")).toBe(true);
  });
});

// =============================================================================
// searchSymbols
// =============================================================================
describe("searchSymbols", () => {
  it("returns empty for empty query", () => {
    expect(searchSymbols("")).toEqual([]);
  });

  it("finds by partial code", () => {
    const results = searchSymbols("600519");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toBe("贵州茅台");
  });

  it("finds by Chinese name", () => {
    const results = searchSymbols("茅台");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.symbol).toBe("600519.SH");
  });

  it("is case-insensitive for code search", () => {
    const results = searchSymbols("btc/usdt");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toBe("比特币");
  });

  it("respects limit parameter", () => {
    const results = searchSymbols("6", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
