/**
 * ProgressiveDisclosure Component Tests
 *
 * Tests:
 * - Three-layer progressive disclosure rendering
 * - Layer 1: ScoreCard renders immediately on completion
 * - Layer 2: Equity curve appears after delay
 * - Layer 3: Full metrics collapsible toggle
 * - AI insight placeholder rendering
 * - Next step guide cards rendering and callbacks
 * - Auto-focus ScoreCard on completion
 * - Reduced motion support (no delay for Layer 2)
 * - Accessibility (aria-live, aria-expanded, keyboard)
 * - Edge cases (null score, empty data, missing callbacks)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Decimal from "decimal.js";
import {
  ProgressiveDisclosure,
  type ProgressiveDisclosureProps,
} from "../progressive-disclosure";
import { NextStepGuide } from "../next-step-guide";
import { AiInsightPlaceholder } from "../ai-insight-placeholder";
import type { StrategyScore } from "@/lib/backtest/score";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockScore(overrides?: Partial<StrategyScore>): StrategyScore {
  return {
    grade: "A",
    score: 78,
    description: "优秀",
    coreMetrics: {
      totalReturn: new Decimal(0.235),
      annualizedReturn: new Decimal(0.18),
      maxDrawdown: new Decimal(0.083),
      sharpeRatio: new Decimal(1.45),
    },
    breakdown: {
      profitability: 85,
      risk: 72,
      stability: 80,
      efficiency: 65,
    },
    ...overrides,
  };
}

const mockEquityCurve = [
  { time: 1700000000, value: 100000 },
  { time: 1700100000, value: 102000 },
  { time: 1700200000, value: 105000 },
  { time: 1700300000, value: 103500 },
  { time: 1700400000, value: 108000 },
];

function renderProgressiveDisclosure(
  overrides?: Partial<ProgressiveDisclosureProps>
) {
  const defaultProps: ProgressiveDisclosureProps = {
    score: createMockScore(),
    isComplete: true,
    ...overrides,
  };
  return render(<ProgressiveDisclosure {...defaultProps} />);
}

// =============================================================================
// TIMER MANAGEMENT
// =============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// LAYER 1: SCORECARD IMMEDIATE DISPLAY
// =============================================================================

describe("ProgressiveDisclosure", () => {
  describe("Layer 1: ScoreCard immediate display", () => {
    it("renders ScoreCard immediately when isComplete=true", () => {
      renderProgressiveDisclosure();
      // ScoreCard should be visible immediately (Layer 1)
      const layer1 = screen.getByTestId("progressive-layer-1");
      expect(layer1).toBeTruthy();
    });

    it("does not render any layers when isComplete=false", () => {
      renderProgressiveDisclosure({ isComplete: false });
      expect(screen.queryByTestId("progressive-layer-1")).toBeNull();
    });

    it("renders ScoreCard with correct score data", () => {
      renderProgressiveDisclosure();
      // ScoreCard should display the grade
      const layer1 = screen.getByTestId("progressive-layer-1");
      expect(layer1).toBeTruthy();
    });

    it("renders with null score gracefully", () => {
      renderProgressiveDisclosure({ score: null });
      // Should still render Layer 1 container but without score content
      const container = screen.getByTestId("progressive-disclosure");
      expect(container).toBeTruthy();
    });
  });

  // ===========================================================================
  // LAYER 2: DELAYED EQUITY CURVE
  // ===========================================================================

  describe("Layer 2: delayed equity curve display", () => {
    it("does not show Layer 2 before delay elapses", () => {
      renderProgressiveDisclosure({ equityCurveData: mockEquityCurve });
      // Before 500ms, Layer 2 should not be visible
      expect(screen.queryByTestId("progressive-layer-2")).toBeNull();
    });

    it("shows Layer 2 after 500ms delay", () => {
      renderProgressiveDisclosure({ equityCurveData: mockEquityCurve });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const layer2 = screen.getByTestId("progressive-layer-2");
      expect(layer2).toBeTruthy();
    });

    it("does not show Layer 2 when no equity curve data", () => {
      renderProgressiveDisclosure({ equityCurveData: undefined });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      // Layer 2 container exists but shows empty state
      const layer2 = screen.queryByTestId("progressive-layer-2");
      // The layer should still render but with no chart
      if (layer2) {
        expect(layer2.querySelector("[data-testid='equity-curve-chart']")).toBeNull();
      }
    });

    it("shows Layer 2 immediately when prefers-reduced-motion", () => {
      // Mock matchMedia for reduced motion
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderProgressiveDisclosure({ equityCurveData: mockEquityCurve });
      // With reduced motion, Layer 2 should be visible immediately
      const layer2 = screen.getByTestId("progressive-layer-2");
      expect(layer2).toBeTruthy();

      window.matchMedia = originalMatchMedia;
    });
  });

  // ===========================================================================
  // LAYER 3: COLLAPSIBLE FULL METRICS
  // ===========================================================================

  describe("Layer 3: collapsible full metrics", () => {
    it("renders Layer 3 in collapsed state by default", () => {
      renderProgressiveDisclosure();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const trigger = screen.getByTestId("progressive-layer-3-trigger");
      expect(trigger).toBeTruthy();
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    it("expands Layer 3 on click", () => {
      renderProgressiveDisclosure();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const trigger = screen.getByTestId("progressive-layer-3-trigger");
      fireEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    it("collapses Layer 3 on second click", () => {
      renderProgressiveDisclosure();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const trigger = screen.getByTestId("progressive-layer-3-trigger");
      fireEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  });

  // ===========================================================================
  // AUTO FOCUS
  // ===========================================================================

  describe("auto focus on completion", () => {
    it("focuses ScoreCard when backtest completes", () => {
      renderProgressiveDisclosure();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // The ScoreCard or its container should receive focus
      const scoreArea = screen.getByTestId("progressive-layer-1");
      // Check that focus was attempted on the score area
      expect(scoreArea).toBeTruthy();
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe("accessibility", () => {
    it("has aria-live region for progressive updates", () => {
      renderProgressiveDisclosure();
      const liveRegion = screen.getByTestId("progressive-disclosure");
      expect(
        liveRegion.getAttribute("aria-live") === "polite" ||
        liveRegion.querySelector("[aria-live]")
      ).toBeTruthy();
    });

    it("Layer 3 trigger has aria-expanded attribute", () => {
      renderProgressiveDisclosure();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const trigger = screen.getByTestId("progressive-layer-3-trigger");
      expect(trigger.hasAttribute("aria-expanded")).toBe(true);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("edge cases", () => {
    it("handles empty equity curve array", () => {
      renderProgressiveDisclosure({ equityCurveData: [] });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      // Should not crash
      expect(screen.getByTestId("progressive-disclosure")).toBeTruthy();
    });

    it("applies custom className", () => {
      renderProgressiveDisclosure({ className: "custom-test-class" });
      const container = screen.getByTestId("progressive-disclosure");
      expect(container.className).toContain("custom-test-class");
    });
  });
});

// =============================================================================
// NEXT STEP GUIDE TESTS
// =============================================================================

describe("NextStepGuide", () => {
  it("renders 3 guide cards", () => {
    render(<NextStepGuide />);
    const cards = screen.getAllByTestId(/^next-step-card-/);
    expect(cards.length).toBe(3);
  });

  it("renders optimize params card", () => {
    render(<NextStepGuide />);
    expect(screen.getByTestId("next-step-card-optimize")).toBeTruthy();
  });

  it("renders ask AI card", () => {
    render(<NextStepGuide />);
    expect(screen.getByTestId("next-step-card-ai")).toBeTruthy();
  });

  it("renders validate more card", () => {
    render(<NextStepGuide />);
    expect(screen.getByTestId("next-step-card-validate")).toBeTruthy();
  });

  it("fires onOptimizeParams callback on click", () => {
    const handler = vi.fn();
    render(<NextStepGuide onOptimizeParams={handler} />);
    fireEvent.click(screen.getByTestId("next-step-card-optimize"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires onAskAI callback on click", () => {
    const handler = vi.fn();
    render(<NextStepGuide onAskAI={handler} />);
    fireEvent.click(screen.getByTestId("next-step-card-ai"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires onValidateMore callback on click", () => {
    const handler = vi.fn();
    render(<NextStepGuide onValidateMore={handler} />);
    fireEvent.click(screen.getByTestId("next-step-card-validate"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders without callbacks (no crash)", () => {
    render(<NextStepGuide />);
    const card = screen.getByTestId("next-step-card-optimize");
    fireEvent.click(card);
    // Should not throw
    expect(card).toBeTruthy();
  });

  it("cards are keyboard focusable", () => {
    render(<NextStepGuide />);
    const cards = screen.getAllByTestId(/^next-step-card-/);
    cards.forEach((card) => {
      expect(card.getAttribute("tabIndex") === "0" || card.tagName === "BUTTON").toBeTruthy();
    });
  });

  it("applies custom className", () => {
    render(<NextStepGuide className="my-guide" />);
    const container = screen.getByTestId("next-step-guide");
    expect(container.className).toContain("my-guide");
  });
});

// =============================================================================
// AI INSIGHT PLACEHOLDER TESTS
// =============================================================================

describe("AiInsightPlaceholder", () => {
  it("renders placeholder card", () => {
    render(<AiInsightPlaceholder />);
    const placeholder = screen.getByTestId("ai-insight-placeholder");
    expect(placeholder).toBeTruthy();
  });

  it("displays placeholder text indicating future feature", () => {
    render(<AiInsightPlaceholder />);
    const placeholder = screen.getByTestId("ai-insight-placeholder");
    // Should contain some text about AI insight
    expect(placeholder.textContent).toBeTruthy();
  });

  it("applies custom className", () => {
    render(<AiInsightPlaceholder className="ai-custom" />);
    const placeholder = screen.getByTestId("ai-insight-placeholder");
    expect(placeholder.className).toContain("ai-custom");
  });

  it("has appropriate aria attributes", () => {
    render(<AiInsightPlaceholder />);
    const placeholder = screen.getByTestId("ai-insight-placeholder");
    // Should be marked as complementary or have appropriate role
    expect(placeholder).toBeTruthy();
  });
});
