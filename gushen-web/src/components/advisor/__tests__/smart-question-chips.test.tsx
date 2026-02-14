/**
 * Tests for SmartQuestionChips Component
 *
 * Validates rendering, interaction, and context-aware behavior
 * of the smart question recommendation chips.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SmartQuestionChips } from "../smart-question-chips";
import type { QuestionContext } from "@/lib/advisor/question-generator";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestContext(
  overrides?: Partial<QuestionContext>
): QuestionContext {
  return {
    scoreBreakdown: {
      profitability: 70,
      risk: 45,
      stability: 60,
      efficiency: 80,
    },
    totalReturn: 0.25,
    annualizedReturn: 0.18,
    maxDrawdown: 0.22,
    sharpeRatio: 1.1,
    winRate: 0.55,
    totalTrades: 20,
    maxDrawdownDuration: 45,
    profitFactor: 1.8,
    ...overrides,
  };
}

// =============================================================================
// TESTS: Rendering
// =============================================================================

describe("SmartQuestionChips", () => {
  describe("rendering with context", () => {
    it("renders 3 question chips when context is provided", () => {
      const ctx = createTestContext();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={vi.fn()} />
      );
      const chips = screen.getAllByRole("button");
      expect(chips).toHaveLength(3);
    });

    it("renders chips as clickable badges", () => {
      const ctx = createTestContext();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={vi.fn()} />
      );
      const chips = screen.getAllByRole("button");
      for (const chip of chips) {
        expect(chip).toBeEnabled();
      }
    });

    it("renders with data-testid attribute", () => {
      const ctx = createTestContext();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={vi.fn()} />
      );
      expect(
        screen.getByTestId("smart-question-chips")
      ).toBeInTheDocument();
    });

    it("renders AI visual language container", () => {
      const ctx = createTestContext();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={vi.fn()} />
      );
      const container = screen.getByTestId("smart-question-chips");
      expect(container).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // TESTS: No context / fallback
  // ===========================================================================

  describe("no context fallback", () => {
    it("does not render chips when context is null", () => {
      render(
        <SmartQuestionChips context={null} onQuestionSelect={vi.fn()} />
      );
      expect(
        screen.queryByTestId("smart-question-chips")
      ).not.toBeInTheDocument();
    });

    it("does not render chips when context is undefined", () => {
      render(
        <SmartQuestionChips context={undefined} onQuestionSelect={vi.fn()} />
      );
      expect(
        screen.queryByTestId("smart-question-chips")
      ).not.toBeInTheDocument();
    });

    it("renders fallback guidance text when no context", () => {
      render(
        <SmartQuestionChips
          context={null}
          onQuestionSelect={vi.fn()}
          showFallback
        />
      );
      expect(
        screen.getByText(/输入任何投资相关问题/)
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // TESTS: Click interaction
  // ===========================================================================

  describe("click interaction", () => {
    it("calls onQuestionSelect with question text when chip is clicked", () => {
      const ctx = createTestContext();
      const onSelect = vi.fn();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={onSelect} />
      );

      const chips = screen.getAllByRole("button");
      fireEvent.click(chips[0]!);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(typeof onSelect.mock.calls[0]![0]).toBe("string");
      expect(onSelect.mock.calls[0]![0].length).toBeGreaterThan(0);
    });

    it("passes different question text for each chip", () => {
      const ctx = createTestContext();
      const onSelect = vi.fn();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={onSelect} />
      );

      const chips = screen.getAllByRole("button");
      fireEvent.click(chips[0]!);
      fireEvent.click(chips[1]!);
      fireEvent.click(chips[2]!);

      expect(onSelect).toHaveBeenCalledTimes(3);
      const texts = onSelect.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      const uniqueTexts = new Set(texts);
      expect(uniqueTexts.size).toBe(3);
    });
  });

  // ===========================================================================
  // TESTS: Accessibility
  // ===========================================================================

  describe("accessibility", () => {
    it("chips have accessible labels", () => {
      const ctx = createTestContext();
      render(
        <SmartQuestionChips context={ctx} onQuestionSelect={vi.fn()} />
      );
      const chips = screen.getAllByRole("button");
      for (const chip of chips) {
        // Each chip should have visible text content
        expect(chip.textContent).toBeTruthy();
      }
    });
  });
});
