/**
 * Financial Formatters Tests
 * 金融格式化工具测试
 *
 * Tests for financial data formatting functions (Story 1.6)
 * Validates:
 * - Positive/negative/zero value formatting
 * - Precision rules (price/percent/ratio)
 * - Direction determination
 * - Aria label generation
 * - Decimal.js precision
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  toDecimal,
  getDirection,
  getColorToken,
  formatPrice,
  formatPercent,
  formatRatio,
  formatByType,
  formatWithSign,
  getAriaLabel,
  getResponsiveText,
  createFinancialDisplayData,
} from "../formatters";

describe("Financial Formatters - Story 1.6", () => {
  // ===========================================================================
  // toDecimal Tests
  // ===========================================================================
  describe("toDecimal", () => {
    it("should convert number to Decimal", () => {
      const result = toDecimal(123.45);
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe("123.45");
    });

    it("should convert string to Decimal", () => {
      const result = toDecimal("123.45");
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe("123.45");
    });

    it("should pass through Decimal unchanged", () => {
      const original = new Decimal("123.45");
      const result = toDecimal(original);
      expect(result.toString()).toBe("123.45");
    });

    it("should handle negative values", () => {
      const result = toDecimal(-123.45);
      expect(result.toString()).toBe("-123.45");
    });

    it("should handle zero", () => {
      const result = toDecimal(0);
      expect(result.isZero()).toBe(true);
    });
  });

  // ===========================================================================
  // getDirection Tests (AC-4)
  // ===========================================================================
  describe("getDirection", () => {
    it("should return 'up' for positive values", () => {
      expect(getDirection(32.5)).toBe("up");
      expect(getDirection("0.01")).toBe("up");
      expect(getDirection(new Decimal(100))).toBe("up");
    });

    it("should return 'down' for negative values", () => {
      expect(getDirection(-15.2)).toBe("down");
      expect(getDirection("-0.01")).toBe("down");
      expect(getDirection(new Decimal(-100))).toBe("down");
    });

    it("should return 'neutral' for zero", () => {
      expect(getDirection(0)).toBe("neutral");
      expect(getDirection("0")).toBe("neutral");
      expect(getDirection("0.00")).toBe("neutral");
      expect(getDirection(new Decimal(0))).toBe("neutral");
    });

    it("should handle very small positive values", () => {
      expect(getDirection(0.0000001)).toBe("up");
    });

    it("should handle very small negative values", () => {
      expect(getDirection(-0.0000001)).toBe("down");
    });
  });

  // ===========================================================================
  // getColorToken Tests (AC-4)
  // ===========================================================================
  describe("getColorToken", () => {
    it("should return text-profit for up direction", () => {
      expect(getColorToken("up")).toBe("text-profit");
    });

    it("should return text-loss for down direction", () => {
      expect(getColorToken("down")).toBe("text-loss");
    });

    it("should return text-muted for neutral direction", () => {
      expect(getColorToken("neutral")).toBe("text-muted");
    });
  });

  // ===========================================================================
  // formatPrice Tests (AC-2)
  // ===========================================================================
  describe("formatPrice", () => {
    it("should format price with 2 decimal places and ¥ prefix", () => {
      expect(formatPrice(15.2)).toBe("¥15.20");
      expect(formatPrice(100)).toBe("¥100.00");
      expect(formatPrice(0.5)).toBe("¥0.50");
    });

    it("should round to 2 decimal places", () => {
      expect(formatPrice(15.234)).toBe("¥15.23");
      expect(formatPrice(15.235)).toBe("¥15.24"); // ROUND_HALF_UP
      expect(formatPrice(15.2351)).toBe("¥15.24");
    });

    it("should handle negative prices (returns absolute value)", () => {
      // formatPrice returns absolute value; sign is added by formatWithSign
      expect(formatPrice(-15.2)).toBe("¥15.20");
    });

    it("should handle zero", () => {
      expect(formatPrice(0)).toBe("¥0.00");
    });

    it("should respect custom precision", () => {
      expect(formatPrice(15.2, 3)).toBe("¥15.200");
      expect(formatPrice(15.2, 0)).toBe("¥15");
    });

    it("should handle large numbers", () => {
      expect(formatPrice(1234567.89)).toBe("¥1234567.89");
    });
  });

  // ===========================================================================
  // formatPercent Tests (AC-2)
  // ===========================================================================
  describe("formatPercent", () => {
    it("should format percent with 2 decimal places and % suffix", () => {
      expect(formatPercent(32.5)).toBe("32.50%");
      expect(formatPercent(100)).toBe("100.00%");
      expect(formatPercent(0.5)).toBe("0.50%");
    });

    it("should use absolute value (no negative sign)", () => {
      expect(formatPercent(-15.2)).toBe("15.20%");
    });

    it("should round to 2 decimal places", () => {
      expect(formatPercent(32.234)).toBe("32.23%");
      expect(formatPercent(32.235)).toBe("32.24%"); // ROUND_HALF_UP
    });

    it("should handle zero", () => {
      expect(formatPercent(0)).toBe("0.00%");
    });

    it("should respect custom precision", () => {
      expect(formatPercent(32.5, 3)).toBe("32.500%");
      expect(formatPercent(32.5, 0)).toBe("33%");
    });
  });

  // ===========================================================================
  // formatRatio Tests (AC-2)
  // ===========================================================================
  describe("formatRatio", () => {
    it("should format ratio with 3 decimal places", () => {
      expect(formatRatio(1.234)).toBe("1.234");
      expect(formatRatio(0.5)).toBe("0.500");
      expect(formatRatio(2)).toBe("2.000");
    });

    it("should round to 3 decimal places", () => {
      expect(formatRatio(1.2344)).toBe("1.234");
      expect(formatRatio(1.2345)).toBe("1.235"); // ROUND_HALF_UP
    });

    it("should handle negative ratios (returns absolute value)", () => {
      // formatRatio returns absolute value; sign is added by formatWithSign
      expect(formatRatio(-1.234)).toBe("1.234");
    });

    it("should handle zero", () => {
      expect(formatRatio(0)).toBe("0.000");
    });

    it("should respect custom precision", () => {
      expect(formatRatio(1.234, 2)).toBe("1.23");
      expect(formatRatio(1.234, 4)).toBe("1.2340");
    });
  });

  // ===========================================================================
  // formatByType Tests (AC-2)
  // ===========================================================================
  describe("formatByType", () => {
    it("should delegate to formatPrice for price type", () => {
      expect(formatByType(15.2, "price")).toBe("¥15.20");
    });

    it("should delegate to formatPercent for percent type", () => {
      expect(formatByType(32.5, "percent")).toBe("32.50%");
    });

    it("should delegate to formatRatio for ratio type", () => {
      expect(formatByType(1.234, "ratio")).toBe("1.234");
    });

    it("should respect custom precision", () => {
      expect(formatByType(15.2, "price", 3)).toBe("¥15.200");
      expect(formatByType(32.5, "percent", 3)).toBe("32.500%");
      expect(formatByType(1.234, "ratio", 2)).toBe("1.23");
    });
  });

  // ===========================================================================
  // formatWithSign Tests (AC-4)
  // ===========================================================================
  describe("formatWithSign", () => {
    it("should add + sign for positive percent", () => {
      expect(formatWithSign(32.5, "percent")).toBe("+32.50%");
    });

    it("should add - sign for negative percent", () => {
      expect(formatWithSign(-32.5, "percent")).toBe("-32.50%");
    });

    it("should have no sign for zero percent", () => {
      expect(formatWithSign(0, "percent")).toBe("0.00%");
    });

    it("should add + sign after ¥ for positive price", () => {
      expect(formatWithSign(15.2, "price")).toBe("¥+15.20");
    });

    it("should add - sign after ¥ for negative price", () => {
      expect(formatWithSign(-15.2, "price")).toBe("¥-15.20");
    });

    it("should have no sign for zero price", () => {
      expect(formatWithSign(0, "price")).toBe("¥0.00");
    });

    it("should add + sign for positive ratio", () => {
      expect(formatWithSign(1.234, "ratio")).toBe("+1.234");
    });

    it("should add - sign for negative ratio", () => {
      expect(formatWithSign(-1.234, "ratio")).toBe("-1.234");
    });
  });

  // ===========================================================================
  // getAriaLabel Tests (AC-6, AC-8)
  // ===========================================================================
  describe("getAriaLabel", () => {
    it("should generate label with direction and value", () => {
      expect(getAriaLabel(32.5, "percent")).toBe("上涨 32.50%");
      expect(getAriaLabel(-15.2, "percent")).toBe("下跌 15.20%");
      expect(getAriaLabel(0, "percent")).toBe("持平 0.00%");
    });

    it("should include custom label prefix", () => {
      expect(getAriaLabel(32.5, "percent", "总收益率")).toBe("总收益率 上涨 32.50%");
      expect(getAriaLabel(-15.2, "price", "变动")).toBe("变动 下跌 ¥15.20");
    });

    it("should use absolute value in aria label", () => {
      expect(getAriaLabel(-32.5, "percent")).toBe("下跌 32.50%");
    });

    it("should work for all data types", () => {
      expect(getAriaLabel(15.2, "price")).toBe("上涨 ¥15.20");
      expect(getAriaLabel(1.234, "ratio")).toBe("上涨 1.234");
    });
  });

  // ===========================================================================
  // getResponsiveText Tests (AC-1)
  // ===========================================================================
  describe("getResponsiveText", () => {
    it("should return full and compact variants", () => {
      const result = getResponsiveText(32.5, "percent");
      expect(result.full).toBe("+32.50%");
      expect(result.compact).toBe("+32.50%");
    });

    it("should include label in full variant only", () => {
      const result = getResponsiveText(32.5, "percent", { label: "总收益率" });
      expect(result.full).toBe("总收益率 +32.50%");
      expect(result.compact).toBe("+32.50%");
    });

    it("should include arrow in full variant when showArrow is true", () => {
      const result = getResponsiveText(32.5, "percent", { showArrow: true });
      expect(result.full).toBe("↑ +32.50%");
      expect(result.compact).toBe("+32.50%");
    });

    it("should include both label and arrow", () => {
      const result = getResponsiveText(32.5, "percent", { label: "收益", showArrow: true });
      expect(result.full).toBe("收益 ↑ +32.50%");
      expect(result.compact).toBe("+32.50%");
    });

    it("should handle negative values", () => {
      const result = getResponsiveText(-15.2, "percent", { showArrow: true });
      expect(result.full).toBe("↓ -15.20%");
      expect(result.compact).toBe("-15.20%");
    });

    it("should handle neutral values", () => {
      const result = getResponsiveText(0, "percent", { showArrow: true });
      expect(result.full).toBe("- 0.00%");
      expect(result.compact).toBe("0.00%");
    });
  });

  // ===========================================================================
  // createFinancialDisplayData Tests (AC-1)
  // ===========================================================================
  describe("createFinancialDisplayData", () => {
    it("should create complete FinancialDisplayData for positive percent", () => {
      const result = createFinancialDisplayData(32.5, "percent", { label: "总收益率" });

      expect(result.raw).toBeInstanceOf(Decimal);
      expect(result.raw.toString()).toBe("32.5");
      expect(result.formatted).toBe("+32.50%");
      expect(result.direction).toBe("up");
      expect(result.ariaLabel).toBe("总收益率 上涨 32.50%");
      expect(result.colorToken).toBe("text-profit");
      expect(result.responsive.full).toBe("总收益率 +32.50%");
      expect(result.responsive.compact).toBe("+32.50%");
    });

    it("should create complete FinancialDisplayData for negative price", () => {
      const result = createFinancialDisplayData(-15.2, "price");

      expect(result.raw.toString()).toBe("-15.2");
      expect(result.formatted).toBe("¥-15.20");
      expect(result.direction).toBe("down");
      expect(result.ariaLabel).toBe("下跌 ¥15.20");
      expect(result.colorToken).toBe("text-loss");
    });

    it("should create complete FinancialDisplayData for zero value", () => {
      const result = createFinancialDisplayData(0, "percent");

      expect(result.raw.isZero()).toBe(true);
      expect(result.formatted).toBe("0.00%");
      expect(result.direction).toBe("neutral");
      expect(result.ariaLabel).toBe("持平 0.00%");
      expect(result.colorToken).toBe("text-muted");
    });

    it("should work with Decimal input", () => {
      const decimalValue = new Decimal("1.234567");
      const result = createFinancialDisplayData(decimalValue, "ratio");

      expect(result.raw.toString()).toBe("1.234567");
      expect(result.formatted).toBe("+1.235");
    });

    it("should work with string input", () => {
      const result = createFinancialDisplayData("32.5", "percent");

      expect(result.raw.toString()).toBe("32.5");
      expect(result.formatted).toBe("+32.50%");
    });

    it("should respect custom precision", () => {
      const result = createFinancialDisplayData(32.5, "percent", { precision: 3 });

      expect(result.formatted).toBe("+32.500%");
    });
  });

  // ===========================================================================
  // Decimal.js Precision Tests (AC-5)
  // ===========================================================================
  describe("Decimal.js Precision", () => {
    it("should avoid floating point issues with 0.1 + 0.2", () => {
      // JavaScript: 0.1 + 0.2 = 0.30000000000000004
      const a = toDecimal(0.1);
      const b = toDecimal(0.2);
      const sum = a.plus(b);

      expect(sum.toString()).toBe("0.3");
    });

    it("should handle very large numbers precisely", () => {
      const result = createFinancialDisplayData(12345678901234.56, "price");
      expect(result.formatted).toBe("¥+12345678901234.56");
    });

    it("should handle very small numbers precisely", () => {
      const result = createFinancialDisplayData(0.00000001, "ratio", { precision: 8 });
      expect(result.formatted).toBe("+0.00000001");
    });

    it("should round consistently using ROUND_HALF_UP", () => {
      // 0.5 should round up
      expect(formatPercent(32.345, 2)).toBe("32.35%");
      expect(formatPercent(32.344, 2)).toBe("32.34%");
      expect(formatPercent(32.3450, 2)).toBe("32.35%");
    });
  });
});
