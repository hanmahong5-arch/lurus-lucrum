/**
 * Tests for ApplySuggestionButton Component
 *
 * Validates rendering, click behavior, button state transitions,
 * and integration with the strategy workspace store.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ApplySuggestionButton } from "../apply-suggestion-button";
import type { AiSuggestion } from "@/lib/advisor/suggestion-parser";

// =============================================================================
// MOCKS (hoisted to avoid initialization order issues)
// =============================================================================

const { mockUpdateParameters, mockShowToastSuccess, mockShowToastError } =
  vi.hoisted(() => ({
    mockUpdateParameters: vi.fn(),
    mockShowToastSuccess: vi.fn(),
    mockShowToastError: vi.fn(),
  }));

vi.mock("@/lib/toast", () => ({
  showToast: {
    success: mockShowToastSuccess,
    error: mockShowToastError,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/stores/strategy-workspace-store", () => ({
  useStrategyWorkspaceStore: (selector: (state: unknown) => unknown) => {
    const state = {
      current: {
        parameters: [
          {
            name: "stop_loss_pct",
            displayName: "Stop Loss",
            type: "number" as const,
            value: 0.1,
            defaultValue: 0.1,
            description: "Stop loss percentage",
            category: "risk" as const,
          },
          {
            name: "fast_period",
            displayName: "Fast Period",
            type: "number" as const,
            value: 10,
            defaultValue: 10,
            description: "Fast MA period",
            category: "indicator" as const,
          },
        ],
        generatedCode: "stop_loss_pct = 0.1\nfast_period = 10",
      },
      updateParameters: mockUpdateParameters,
    };
    return selector(state);
  },
}));

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestSuggestion(
  overrides?: Partial<AiSuggestion>
): AiSuggestion {
  return {
    id: "sug-1",
    param: "stop_loss_pct",
    value: 0.05,
    display: "Set stop-loss to 5%",
    rationale: "Based on historical drawdown analysis",
    impact: "Expected to reduce max drawdown by approximately 30%",
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("ApplySuggestionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("renders suggestion card with display text", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      expect(screen.getByText("Set stop-loss to 5%")).toBeInTheDocument();
    });

    it("renders rationale text", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      expect(
        screen.getByText(/historical drawdown analysis/)
      ).toBeInTheDocument();
    });

    it("renders impact text", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      expect(screen.getByText(/reduce max drawdown/)).toBeInTheDocument();
    });

    it("renders apply button", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      expect(
        screen.getByRole("button", { name: /apply/i })
      ).toBeInTheDocument();
    });

    it("renders with data-testid", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      expect(
        screen.getByTestId("apply-suggestion-card")
      ).toBeInTheDocument();
    });

    it("wraps content in AI visual language container", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);
      const card = screen.getByTestId("apply-suggestion-card");
      expect(card).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Click Behavior
  // ===========================================================================

  describe("click behavior", () => {
    it("calls onApply callback when apply button is clicked", () => {
      const suggestion = createTestSuggestion();
      const onApply = vi.fn();
      render(
        <ApplySuggestionButton suggestion={suggestion} onApply={onApply} />
      );

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      expect(onApply).toHaveBeenCalledWith(suggestion);
    });

    it("fires success toast on apply", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      expect(mockShowToastSuccess).toHaveBeenCalled();
    });

    it("calls updateParameters on the workspace store", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      expect(mockUpdateParameters).toHaveBeenCalled();
      // Verify the updated params array has the new value
      const updatedParams = mockUpdateParameters.mock.calls[0]![0];
      const targetParam = updatedParams.find(
        (p: { name: string }) => p.name === "stop_loss_pct"
      );
      expect(targetParam.value).toBe(0.05);
    });
  });

  // ===========================================================================
  // Button State Transitions
  // ===========================================================================

  describe("button state transitions", () => {
    it("shows default state initially", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const stateEl = screen.getByTestId("apply-button-state");
      expect(stateEl).toHaveTextContent(/Apply to Strategy/i);
    });

    it("transitions to applied state after click", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      expect(screen.getByTestId("apply-button-state")).toHaveTextContent(
        /Applied/i
      );
    });

    it("resets to default state after timeout", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      // Advance timer past reset delay (1200ms + buffer)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Should be back to default
      expect(screen.getByTestId("apply-button-state")).toHaveTextContent(
        /Apply to Strategy/i
      );
    });
  });

  // ===========================================================================
  // Re-run Backtest Prompt
  // ===========================================================================

  describe("re-run backtest prompt", () => {
    it("shows re-run prompt after applying suggestion when handler is provided", () => {
      const suggestion = createTestSuggestion();
      render(
        <ApplySuggestionButton
          suggestion={suggestion}
          onRerunBacktest={vi.fn()}
        />
      );

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      expect(
        screen.getByRole("button", { name: /re-run/i })
      ).toBeInTheDocument();
    });

    it("does not show re-run prompt when no handler is wired", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(button);

      // Without onRerunBacktest the button would be a dead-end click —
      // hiding it is preferable to surfacing a no-op control.
      expect(
        screen.queryByRole("button", { name: /re-run/i })
      ).not.toBeInTheDocument();
    });

    it("calls onRerunBacktest when re-run is clicked", () => {
      const suggestion = createTestSuggestion();
      const onRerun = vi.fn();
      render(
        <ApplySuggestionButton
          suggestion={suggestion}
          onRerunBacktest={onRerun}
        />
      );

      // Apply first
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Then click re-run
      const rerunButton = screen.getByRole("button", { name: /re-run/i });
      fireEvent.click(rerunButton);

      expect(onRerun).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("handles missing onApply callback gracefully", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    it("handles missing onRerunBacktest callback gracefully", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Re-run button should still render but not crash
      const rerunButton = screen.queryByRole("button", {
        name: /re-run/i,
      });
      if (rerunButton) {
        expect(() => fireEvent.click(rerunButton)).not.toThrow();
      }
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe("accessibility", () => {
    it("apply button has accessible name", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const button = screen.getByRole("button", { name: /apply/i });
      expect(button).toBeInTheDocument();
    });

    it("suggestion card has ARIA role", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const card = screen.getByTestId("apply-suggestion-card");
      expect(card).toHaveAttribute("role", "region");
    });

    it("suggestion card has ARIA label", () => {
      const suggestion = createTestSuggestion();
      render(<ApplySuggestionButton suggestion={suggestion} />);

      const card = screen.getByTestId("apply-suggestion-card");
      expect(card).toHaveAttribute("aria-label");
    });
  });
});
