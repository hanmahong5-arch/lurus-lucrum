/**
 * Tests for Token Tracker utility
 *
 * Validates token estimation, budget computation, threshold detection,
 * and usage tracking for AI advisor conversations.
 */
import { describe, it, expect } from "vitest";
import {
  estimateMessageTokens,
  computeBudgetUsage,
  getUsageLevel,
  isNearExhaustion,
  isExhausted,
  formatTokenCount,
  CONVERSATION_TOKEN_BUDGET,
  TOKEN_WARNING_THRESHOLD,
  TOKEN_EXHAUSTION_THRESHOLD,
} from "../token-tracker";

// =============================================================================
// estimateMessageTokens
// =============================================================================

describe("estimateMessageTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateMessageTokens("")).toBe(0);
  });

  it("estimates tokens for English text", () => {
    // ~4 chars per token for English
    const text = "Hello, how are you doing today?";
    const tokens = estimateMessageTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length); // Should be compressed
  });

  it("estimates tokens for Chinese text", () => {
    // ~1.5 chars per token for Chinese
    const text = "你好，今天市场表现如何？";
    const tokens = estimateMessageTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeGreaterThan(text.length / 2); // Chinese tokens are denser
  });

  it("estimates tokens for mixed Chinese/English text", () => {
    const text = "分析一下 600519 贵州茅台 的 Sharpe Ratio";
    const tokens = estimateMessageTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it("handles very long text", () => {
    const longText = "A".repeat(10000);
    const tokens = estimateMessageTokens(longText);
    expect(tokens).toBeGreaterThan(2000);
    expect(tokens).toBeLessThan(5000);
  });
});

// =============================================================================
// computeBudgetUsage
// =============================================================================

describe("computeBudgetUsage", () => {
  it("returns zero usage for empty messages", () => {
    const usage = computeBudgetUsage([]);
    expect(usage.used).toBe(0);
    expect(usage.total).toBe(CONVERSATION_TOKEN_BUDGET);
    expect(usage.percentage).toBe(0);
    expect(usage.remaining).toBe(CONVERSATION_TOKEN_BUDGET);
  });

  it("computes usage for a list of messages", () => {
    // Use a smaller budget to ensure percentage > 0 with moderate messages
    const messages = [
      { role: "user" as const, content: "What is value investing?" },
      {
        role: "assistant" as const,
        content:
          "Value investing is a strategy that involves picking stocks that appear to be trading for less than their intrinsic value. This approach was popularized by Benjamin Graham and further refined by Warren Buffett.",
      },
    ];
    const usage = computeBudgetUsage(messages, 500);
    expect(usage.used).toBeGreaterThan(0);
    expect(usage.percentage).toBeGreaterThan(0);
    expect(usage.percentage).toBeLessThanOrEqual(100);
    expect(usage.remaining).toBe(usage.total - usage.used);
  });

  it("respects custom budget", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
    ];
    const usage = computeBudgetUsage(messages, 100);
    expect(usage.total).toBe(100);
  });

  it("caps percentage at 100", () => {
    // Create messages that would exceed the budget
    const longMessage = "A".repeat(50000);
    const messages = [{ role: "user" as const, content: longMessage }];
    const usage = computeBudgetUsage(messages, 100);
    expect(usage.percentage).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// getUsageLevel
// =============================================================================

describe("getUsageLevel", () => {
  it("returns 'low' for usage below 70%", () => {
    expect(getUsageLevel(0)).toBe("low");
    expect(getUsageLevel(30)).toBe("low");
    expect(getUsageLevel(69)).toBe("low");
  });

  it("returns 'medium' for usage between 70% and 90%", () => {
    expect(getUsageLevel(70)).toBe("medium");
    expect(getUsageLevel(80)).toBe("medium");
    expect(getUsageLevel(89)).toBe("medium");
  });

  it("returns 'high' for usage above 90%", () => {
    expect(getUsageLevel(90)).toBe("high");
    expect(getUsageLevel(95)).toBe("high");
    expect(getUsageLevel(100)).toBe("high");
  });
});

// =============================================================================
// isNearExhaustion / isExhausted
// =============================================================================

describe("isNearExhaustion", () => {
  it("returns false below warning threshold", () => {
    expect(isNearExhaustion(TOKEN_WARNING_THRESHOLD - 1)).toBe(false);
  });

  it("returns true at warning threshold", () => {
    expect(isNearExhaustion(TOKEN_WARNING_THRESHOLD)).toBe(true);
  });

  it("returns true above warning threshold", () => {
    expect(isNearExhaustion(95)).toBe(true);
  });
});

describe("isExhausted", () => {
  it("returns false below exhaustion threshold", () => {
    expect(isExhausted(TOKEN_EXHAUSTION_THRESHOLD - 1)).toBe(false);
  });

  it("returns true at exhaustion threshold", () => {
    expect(isExhausted(TOKEN_EXHAUSTION_THRESHOLD)).toBe(true);
  });
});

// =============================================================================
// formatTokenCount
// =============================================================================

describe("formatTokenCount", () => {
  it("formats small numbers without comma", () => {
    expect(formatTokenCount(500)).toBe("500");
  });

  it("formats thousands with comma", () => {
    expect(formatTokenCount(1500)).toBe("1,500");
  });

  it("formats large numbers correctly", () => {
    expect(formatTokenCount(12345)).toBe("12,345");
  });

  it("handles zero", () => {
    expect(formatTokenCount(0)).toBe("0");
  });
});

// =============================================================================
// CONSTANTS
// =============================================================================

describe("constants", () => {
  it("defines reasonable budget", () => {
    expect(CONVERSATION_TOKEN_BUDGET).toBeGreaterThan(1000);
  });

  it("defines warning threshold at 90", () => {
    expect(TOKEN_WARNING_THRESHOLD).toBe(90);
  });

  it("defines exhaustion threshold at 100", () => {
    expect(TOKEN_EXHAUSTION_THRESHOLD).toBe(100);
  });
});
