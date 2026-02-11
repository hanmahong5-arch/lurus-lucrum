import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyLogicSummary } from "../strategy-logic-summary";

// =============================================================================
// TEST DATA
// =============================================================================

const defaultProps = {
  conditions: {
    buy: "KDJ \u5728 20 \u4EE5\u4E0B\u91D1\u53C9\u65F6",
    sell: "KDJ \u5728 80 \u4EE5\u4E0A\u6B7B\u53C9\u65F6",
    position: "\u6BCF\u6B21\u4E70\u5165 50% \u8D44\u91D1",
  },
  confidence: "high" as const,
  params: { "KDJ\u5468\u671F": "9", "\u5E73\u6ED1": "3", "\u4ED3\u4F4D": "50%" },
  code: 'class KDJStrategy(CtaTemplate):\n    """KDJ Strategy"""\n    kdj_period = 9',
};

// =============================================================================
// DEFAULT RENDERING
// =============================================================================

describe("StrategyLogicSummary", () => {
  describe("default rendering", () => {
    it("renders title", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByText("\u7B56\u7565\u903B\u8F91\u6458\u8981")).toBeInTheDocument();
    });

    it("renders condition list with correct items", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByText("\u4E70\u5165\u6761\u4EF6:")).toBeInTheDocument();
      expect(screen.getByText("\u5356\u51FA\u6761\u4EF6:")).toBeInTheDocument();
      expect(screen.getByText("\u4ED3\u4F4D\u63A7\u5236:")).toBeInTheDocument();
      expect(screen.getByText("KDJ \u5728 20 \u4EE5\u4E0B\u91D1\u53C9\u65F6")).toBeInTheDocument();
      expect(screen.getByText("KDJ \u5728 80 \u4EE5\u4E0A\u6B7B\u53C9\u65F6")).toBeInTheDocument();
      expect(screen.getByText("\u6BCF\u6B21\u4E70\u5165 50% \u8D44\u91D1")).toBeInTheDocument();
    });

    it("renders parameters summary", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByText("\u53C2\u6570:")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("renders data-testid for default state", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByTestId("strategy-logic-summary")).toBeInTheDocument();
    });

    it("does not show parameters section when params is empty", () => {
      render(<StrategyLogicSummary {...defaultProps} params={{}} />);
      expect(screen.queryByText("\u53C2\u6570:")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CODE COLLAPSIBLE
  // ===========================================================================

  describe("code collapse/expand", () => {
    it("shows collapsed trigger text initially", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByText("\u67E5\u770B\u751F\u6210\u4EE3\u7801")).toBeInTheDocument();
    });

    it("expands code area when trigger is clicked", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      const trigger = screen.getByText("\u67E5\u770B\u751F\u6210\u4EE3\u7801");
      fireEvent.click(trigger);
      expect(screen.getByText("\u6536\u8D77\u751F\u6210\u4EE3\u7801")).toBeInTheDocument();
    });

    it("collapses code area when trigger is clicked again", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      const trigger = screen.getByText("\u67E5\u770B\u751F\u6210\u4EE3\u7801");
      fireEvent.click(trigger);
      const collapseTrigger = screen.getByText("\u6536\u8D77\u751F\u6210\u4EE3\u7801");
      fireEvent.click(collapseTrigger);
      expect(screen.getByText("\u67E5\u770B\u751F\u6210\u4EE3\u7801")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CONFIDENCE BADGES
  // ===========================================================================

  describe("confidence badge", () => {
    it("renders high confidence badge with success variant", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="high" />);
      const badge = screen.getByText("\u9AD8");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("aria-label", "\u7F6E\u4FE1\u5EA6: \u9AD8");
    });

    it("renders medium confidence badge with warning variant", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="medium" />);
      const badge = screen.getByText("\u4E2D");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("aria-label", "\u7F6E\u4FE1\u5EA6: \u4E2D");
    });

    it("renders low confidence badge with danger variant", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="low" />);
      const badge = screen.getByText("\u4F4E");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("aria-label", "\u7F6E\u4FE1\u5EA6: \u4F4E");
    });

    it("applies correct variant class for high confidence", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="high" />);
      const badge = screen.getByText("\u9AD8");
      expect(badge.className).toContain("bg-profit");
    });

    it("applies correct variant class for medium confidence", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="medium" />);
      const badge = screen.getByText("\u4E2D");
      expect(badge.className).toContain("bg-warning");
    });

    it("applies correct variant class for low confidence", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="low" />);
      const badge = screen.getByText("\u4F4E");
      expect(badge.className).toContain("bg-loss");
    });
  });

  // ===========================================================================
  // LOADING STATE
  // ===========================================================================

  describe("loading state", () => {
    it("renders loading skeleton", () => {
      render(<StrategyLogicSummary {...defaultProps} state="loading" />);
      expect(screen.getByTestId("strategy-logic-summary-loading")).toBeInTheDocument();
    });

    it("has ai-pulse animation class", () => {
      render(<StrategyLogicSummary {...defaultProps} state="loading" />);
      const skeleton = screen.getByTestId("strategy-logic-summary-loading");
      expect(skeleton.className).toContain("animate-ai-pulse");
    });

    it("does not render conditions when loading", () => {
      render(<StrategyLogicSummary {...defaultProps} state="loading" />);
      expect(screen.queryByText("\u4E70\u5165\u6761\u4EF6:")).not.toBeInTheDocument();
    });

    it("has aria-label for loading state", () => {
      render(<StrategyLogicSummary {...defaultProps} state="loading" />);
      expect(
        screen.getByLabelText("AI \u6B63\u5728\u89E3\u6790\u7B56\u7565\u903B\u8F91")
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ERROR STATE
  // ===========================================================================

  describe("error state", () => {
    it("renders error message", () => {
      render(
        <StrategyLogicSummary
          {...defaultProps}
          state="error"
          errorMessage={"\u89E3\u6790\u5931\u8D25"}
        />
      );
      expect(screen.getByText("\u89E3\u6790\u5931\u8D25")).toBeInTheDocument();
    });

    it("renders default error message when not provided", () => {
      render(<StrategyLogicSummary {...defaultProps} state="error" />);
      expect(screen.getByText("\u7B56\u7565\u89E3\u6790\u5931\u8D25")).toBeInTheDocument();
    });

    it("renders error testid", () => {
      render(<StrategyLogicSummary {...defaultProps} state="error" />);
      expect(screen.getByTestId("strategy-logic-summary-error")).toBeInTheDocument();
    });

    it("shows code as fallback in error state", () => {
      render(<StrategyLogicSummary {...defaultProps} state="error" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ARIA ATTRIBUTES
  // ===========================================================================

  describe("accessibility", () => {
    it("condition list has role=list", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    it("condition items have role=listitem", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
    });

    it("confidence badge has aria-label", () => {
      render(<StrategyLogicSummary {...defaultProps} confidence="high" />);
      expect(screen.getByLabelText("\u7F6E\u4FE1\u5EA6: \u9AD8")).toBeInTheDocument();
    });

    it("collapsible trigger has aria-expanded", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      const trigger = screen.getByText("\u67E5\u770B\u751F\u6210\u4EE3\u7801");
      expect(trigger.closest("button")).toHaveAttribute("aria-expanded");
    });

    it("condition list has aria-label", () => {
      render(<StrategyLogicSummary {...defaultProps} />);
      expect(screen.getByLabelText("\u7B56\u7565\u6761\u4EF6\u5217\u8868")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CUSTOM CLASSNAME
  // ===========================================================================

  describe("className prop", () => {
    it("applies custom className", () => {
      render(<StrategyLogicSummary {...defaultProps} className="custom-class" />);
      const container = screen.getByTestId("strategy-logic-summary");
      expect(container.className).toContain("custom-class");
    });
  });
});
