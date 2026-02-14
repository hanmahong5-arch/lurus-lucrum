/**
 * Tests for Suggestion Parser
 *
 * Validates extraction of actionable parameter suggestions
 * from AI advisor response text. Pure function, no side effects.
 */
import { describe, it, expect } from "vitest";
import {
  parseSuggestions,
  type AiSuggestion,
} from "../suggestion-parser";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const RESPONSE_WITH_SINGLE_SUGGESTION = `
Based on your backtest results, the max drawdown of 28% is quite high.

[SUGGESTION]
param: stop_loss_pct
value: 0.05
rationale: Based on historical drawdown analysis, a tighter stop-loss can reduce large drawdowns.
impact: Expected to reduce max drawdown by approximately 30%.
[/SUGGESTION]

This should help control risk while maintaining most of the upside potential.
`;

const RESPONSE_WITH_MULTIPLE_SUGGESTIONS = `
I have analyzed your strategy and have two recommendations:

[SUGGESTION]
param: fast_period
value: 5
rationale: The current fast period is too long for this volatile market.
impact: Faster signal response, potentially improving win rate by 10%.
[/SUGGESTION]

Additionally:

[SUGGESTION]
param: slow_period
value: 20
rationale: Shortening the slow period aligns better with recent market cycles.
impact: Better trend detection, expected Sharpe ratio improvement of 0.2.
[/SUGGESTION]

Let me know if you want to apply these changes.
`;

const RESPONSE_WITHOUT_SUGGESTIONS = `
This strategy uses a dual moving average crossover approach. The KDJ indicator
combined with volume analysis provides decent signal quality. The backtest shows
a reasonable Sharpe ratio of 1.2, though the win rate could be improved.

Overall, the strategy is suitable for trending markets but may underperform
in ranging conditions.
`;

const RESPONSE_WITH_MALFORMED_SUGGESTION = `
Here is my analysis:

[SUGGESTION]
param: stop_loss_pct
This is missing value and other fields.
[/SUGGESTION]

The above suggestion is incomplete.
`;

const RESPONSE_WITH_BOOLEAN_SUGGESTION = `
I recommend enabling trailing stop:

[SUGGESTION]
param: use_trailing_stop
value: true
rationale: Trailing stops lock in profits during strong trends.
impact: Expected to capture 15% more profit on winning trades.
[/SUGGESTION]
`;

const RESPONSE_WITH_STRING_SUGGESTION = `
Consider changing the exit strategy:

[SUGGESTION]
param: exit_method
value: atr_trailing
rationale: ATR-based trailing exit adapts to market volatility.
impact: More adaptive exits should improve consistency across market regimes.
[/SUGGESTION]
`;

const RESPONSE_WITH_DISPLAY_TEXT = `
My recommendation:

[SUGGESTION]
param: stop_loss_pct
value: 0.05
display: Set stop-loss to 5%
rationale: Tighter stop-loss reduces large drawdowns.
impact: Expected ~30% drawdown reduction.
[/SUGGESTION]
`;

// =============================================================================
// TESTS: Basic Parsing
// =============================================================================

describe("parseSuggestions", () => {
  describe("basic parsing", () => {
    it("extracts a single suggestion from response text", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      expect(suggestions).toHaveLength(1);
    });

    it("extracts param name correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      expect(suggestions[0]!.param).toBe("stop_loss_pct");
    });

    it("extracts numeric value correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      expect(suggestions[0]!.value).toBe(0.05);
    });

    it("extracts rationale correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      expect(suggestions[0]!.rationale).toContain("historical drawdown");
    });

    it("extracts impact correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      expect(suggestions[0]!.impact).toContain("30%");
    });
  });

  // ===========================================================================
  // TESTS: Multiple Suggestions
  // ===========================================================================

  describe("multiple suggestions", () => {
    it("extracts multiple suggestions from response", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MULTIPLE_SUGGESTIONS);
      expect(suggestions).toHaveLength(2);
    });

    it("extracts distinct param names for each suggestion", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MULTIPLE_SUGGESTIONS);
      const params = suggestions.map((s) => s.param);
      expect(params).toContain("fast_period");
      expect(params).toContain("slow_period");
    });

    it("extracts correct values for each suggestion", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MULTIPLE_SUGGESTIONS);
      const fastPeriod = suggestions.find((s) => s.param === "fast_period");
      const slowPeriod = suggestions.find((s) => s.param === "slow_period");
      expect(fastPeriod!.value).toBe(5);
      expect(slowPeriod!.value).toBe(20);
    });
  });

  // ===========================================================================
  // TESTS: No Suggestions
  // ===========================================================================

  describe("no suggestions", () => {
    it("returns empty array when response has no suggestions", () => {
      const suggestions = parseSuggestions(RESPONSE_WITHOUT_SUGGESTIONS);
      expect(suggestions).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      const suggestions = parseSuggestions("");
      expect(suggestions).toEqual([]);
    });

    it("returns empty array for null-like input", () => {
      // Type safety: parser should handle edge cases gracefully
      const suggestions = parseSuggestions(undefined as unknown as string);
      expect(suggestions).toEqual([]);
    });
  });

  // ===========================================================================
  // TESTS: Malformed Input
  // ===========================================================================

  describe("malformed input", () => {
    it("skips suggestions missing required fields", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MALFORMED_SUGGESTION);
      expect(suggestions).toEqual([]);
    });
  });

  // ===========================================================================
  // TESTS: Value Type Detection
  // ===========================================================================

  describe("value type detection", () => {
    it("parses boolean value correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_BOOLEAN_SUGGESTION);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.value).toBe(true);
    });

    it("parses string value correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_STRING_SUGGESTION);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.value).toBe("atr_trailing");
    });

    it("parses integer value correctly", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MULTIPLE_SUGGESTIONS);
      const fastPeriod = suggestions.find((s) => s.param === "fast_period");
      expect(fastPeriod!.value).toBe(5);
    });
  });

  // ===========================================================================
  // TESTS: Display Text
  // ===========================================================================

  describe("display text", () => {
    it("uses display field when present", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_DISPLAY_TEXT);
      expect(suggestions[0]!.display).toBe("Set stop-loss to 5%");
    });

    it("generates default display text when display field is absent", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      // Default display should include param name and value
      expect(suggestions[0]!.display).toContain("stop_loss_pct");
      expect(suggestions[0]!.display).toContain("0.05");
    });
  });

  // ===========================================================================
  // TESTS: Suggestion Shape
  // ===========================================================================

  describe("suggestion shape", () => {
    it("returned suggestions conform to AiSuggestion interface", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_SINGLE_SUGGESTION);
      const s = suggestions[0]!;
      expect(typeof s.param).toBe("string");
      expect(s.value).toBeDefined();
      expect(typeof s.rationale).toBe("string");
      expect(typeof s.impact).toBe("string");
      expect(typeof s.display).toBe("string");
      expect(typeof s.id).toBe("string");
      expect(s.id.length).toBeGreaterThan(0);
    });

    it("generates unique ids for multiple suggestions", () => {
      const suggestions = parseSuggestions(RESPONSE_WITH_MULTIPLE_SUGGESTIONS);
      const ids = suggestions.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(suggestions.length);
    });
  });
});
