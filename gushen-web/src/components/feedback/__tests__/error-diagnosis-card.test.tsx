/**
 * ErrorDiagnosisCard Component Tests
 *
 * Tests:
 * - Error card rendering with correct structure
 * - Error category icons for each BT code prefix (BT1XX-BT9XX)
 * - Bilingual messages (Chinese primary, English secondary)
 * - Error message three elements (what, why, suggestion)
 * - Action buttons render and fire callbacks
 * - Close button callback
 * - Collapsible details section (expand/collapse)
 * - Accessibility (role="alert", aria-expanded, aria-label)
 * - Defensive handling of missing optional fields
 * - Severity-based visual treatment
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ErrorDiagnosisCard,
  type ErrorDiagnosisProps,
  type ErrorAction,
} from "../error-diagnosis-card";
import type { ErrorInfo } from "@/lib/backtest/core/interfaces";

// =============================================================================
// TEST FIXTURES
// =============================================================================

/** Create a standard ErrorInfo fixture */
function createErrorInfo(overrides: Partial<ErrorInfo> = {}): ErrorInfo {
  return {
    code: "BT300",
    message: "\u6307\u6807\u8BA1\u7B97\u9519\u8BEF",
    messageEn: "Metrics calculation error",
    recoverable: true,
    suggestedAction: "\u8BF7\u8054\u7CFB\u6280\u672F\u652F\u6301",
    ...overrides,
  };
}

/** Create standard action buttons */
function createActions(clickHandlers?: {
  apply?: () => void;
  change?: () => void;
}): ErrorAction[] {
  return [
    {
      label: "\u5E94\u7528\u5EFA\u8BAE",
      onClick: clickHandlers?.apply ?? vi.fn(),
      variant: "primary" as const,
    },
    {
      label: "\u6362\u80A1\u7968",
      onClick: clickHandlers?.change ?? vi.fn(),
      variant: "secondary" as const,
    },
  ];
}

/** Render helper with defaults */
function renderCard(props: Partial<ErrorDiagnosisProps> = {}) {
  const defaultProps: ErrorDiagnosisProps = {
    error: createErrorInfo(),
    ...props,
  };
  return render(<ErrorDiagnosisCard {...defaultProps} />);
}

// =============================================================================
// TESTS: Basic Rendering
// =============================================================================

describe("ErrorDiagnosisCard", () => {
  describe("basic rendering", () => {
    it("renders with error code and failure title", () => {
      renderCard();

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("BT300")).toBeDefined();
      expect(screen.getByText("\u56DE\u6D4B\u5931\u8D25")).toBeDefined();
    });

    it("renders error message (Chinese primary)", () => {
      renderCard({
        error: createErrorInfo({
          message: "\u6570\u636E\u83B7\u53D6\u5931\u8D25",
        }),
      });

      expect(screen.getByText("\u6570\u636E\u83B7\u53D6\u5931\u8D25")).toBeDefined();
    });

    it("renders English message as cause", () => {
      renderCard({
        error: createErrorInfo({
          messageEn: "Failed to fetch market data",
        }),
      });

      expect(screen.getByText("Failed to fetch market data")).toBeDefined();
    });

    it("renders suggestion when present", () => {
      renderCard({
        error: createErrorInfo({
          suggestedAction: "\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u540E\u91CD\u8BD5",
        }),
      });

      expect(screen.getByText("\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u540E\u91CD\u8BD5")).toBeDefined();
    });

    it("renders section labels: problem, cause, suggestion", () => {
      renderCard();

      expect(screen.getByText("\u95EE\u9898")).toBeDefined();
      expect(screen.getByText("\u539F\u56E0")).toBeDefined();
      expect(screen.getByText("\u5EFA\u8BAE")).toBeDefined();
    });

    it("does not render suggestion section when suggestedAction is missing", () => {
      renderCard({
        error: createErrorInfo({ suggestedAction: undefined }),
      });

      // "建议" label should not appear
      expect(screen.queryByText("\u5EFA\u8BAE")).toBeNull();
    });

    it("does not render cause section when messageEn is empty", () => {
      renderCard({
        error: createErrorInfo({ messageEn: "" }),
      });

      expect(screen.queryByText("\u539F\u56E0")).toBeNull();
    });
  });

  // ===========================================================================
  // TESTS: Error Categories & Icons
  // ===========================================================================

  describe("error categories", () => {
    const categoryCases = [
      { code: "BT100", expectedLabel: "\u9A8C\u8BC1\u9519\u8BEF" },
      { code: "BT201", expectedLabel: "\u6570\u636E\u9519\u8BEF" },
      { code: "BT300", expectedLabel: "\u8BA1\u7B97\u9519\u8BEF" },
      { code: "BT400", expectedLabel: "\u5F15\u64CE\u9519\u8BEF" },
      { code: "BT500", expectedLabel: "\u7F51\u7EDC\u9519\u8BEF" },
      { code: "BT900", expectedLabel: "\u7CFB\u7EDF\u9519\u8BEF" },
    ];

    categoryCases.forEach(({ code, expectedLabel }) => {
      it(`renders category label "${expectedLabel}" for code ${code}`, () => {
        renderCard({
          error: createErrorInfo({ code }),
        });

        expect(screen.getByText(expectedLabel)).toBeDefined();
      });
    });

    it("falls back to unknown category for unrecognized code prefix", () => {
      renderCard({
        error: createErrorInfo({ code: "XX999" }),
      });

      expect(screen.getByText("\u672A\u77E5\u9519\u8BEF")).toBeDefined();
    });

    it("falls back gracefully for empty code", () => {
      renderCard({
        error: createErrorInfo({ code: "" }),
      });

      expect(screen.getByText("\u672A\u77E5\u9519\u8BEF")).toBeDefined();
    });
  });

  // ===========================================================================
  // TESTS: Action Buttons
  // ===========================================================================

  describe("action buttons", () => {
    it("renders action buttons when provided", () => {
      renderCard({ actions: createActions() });

      expect(screen.getByText("\u5E94\u7528\u5EFA\u8BAE")).toBeDefined();
      expect(screen.getByText("\u6362\u80A1\u7968")).toBeDefined();
    });

    it("fires onClick callback when action button is clicked", () => {
      const applyFn = vi.fn();
      const changeFn = vi.fn();
      renderCard({
        actions: createActions({ apply: applyFn, change: changeFn }),
      });

      fireEvent.click(screen.getByText("\u5E94\u7528\u5EFA\u8BAE"));
      expect(applyFn).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText("\u6362\u80A1\u7968"));
      expect(changeFn).toHaveBeenCalledTimes(1);
    });

    it("does not render action section when actions is empty array", () => {
      const { container } = renderCard({ actions: [] });

      // No button elements except possibly the close/expand buttons
      const buttons = container.querySelectorAll("button");
      // Only the expand/collapse button should exist (no close, no actions)
      const actionButtonLabels = ["\u5E94\u7528\u5EFA\u8BAE", "\u6362\u80A1\u7968"];
      actionButtonLabels.forEach((label) => {
        expect(screen.queryByText(label)).toBeNull();
      });
    });

    it("does not render action section when actions is undefined", () => {
      renderCard({ actions: undefined });

      expect(screen.queryByText("\u5E94\u7528\u5EFA\u8BAE")).toBeNull();
    });
  });

  // ===========================================================================
  // TESTS: Close Button
  // ===========================================================================

  describe("close button", () => {
    it("renders close button when onClose is provided", () => {
      const closeFn = vi.fn();
      renderCard({ onClose: closeFn });

      const closeButton = screen.getByLabelText("\u5173\u95ED\u9519\u8BEF\u8BCA\u65AD\u5361");
      expect(closeButton).toBeDefined();
    });

    it("fires onClose callback when close button is clicked", () => {
      const closeFn = vi.fn();
      renderCard({ onClose: closeFn });

      fireEvent.click(screen.getByLabelText("\u5173\u95ED\u9519\u8BEF\u8BCA\u65AD\u5361"));
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it("does not render close button when onClose is not provided", () => {
      renderCard({ onClose: undefined });

      expect(screen.queryByLabelText("\u5173\u95ED\u9519\u8BEF\u8BCA\u65AD\u5361")).toBeNull();
    });
  });

  // ===========================================================================
  // TESTS: Collapsible Details
  // ===========================================================================

  describe("collapsible details", () => {
    it("shows expand button when details are available", () => {
      renderCard({
        error: createErrorInfo({ messageEn: "Some English message" }),
      });

      expect(screen.getByText("\u5C55\u5F00\u8BE6\u60C5")).toBeDefined();
    });

    it("expands details on click and updates aria-expanded", () => {
      renderCard({
        error: createErrorInfo({
          messageEn: "Calculation failed",
          details: "Stack trace here",
        }),
      });

      const toggleButton = screen.getByText("\u5C55\u5F00\u8BE6\u60C5");
      expect(toggleButton.getAttribute("aria-expanded")).toBe("false");

      fireEvent.click(toggleButton);

      // After expanding, button text changes
      const collapseButton = screen.getByText("\u6536\u8D77\u8BE6\u60C5");
      expect(collapseButton.getAttribute("aria-expanded")).toBe("true");

      // Details content visible
      expect(screen.getByText("Stack trace here")).toBeDefined();
    });

    it("collapses details on second click", () => {
      renderCard({
        error: createErrorInfo({
          messageEn: "Error occurred",
          details: "Debug info",
        }),
      });

      // Expand
      fireEvent.click(screen.getByText("\u5C55\u5F00\u8BE6\u60C5"));
      expect(screen.getByText("Debug info")).toBeDefined();

      // Collapse
      fireEvent.click(screen.getByText("\u6536\u8D77\u8BE6\u60C5"));
      expect(screen.queryByText("Debug info")).toBeNull();
    });

    it("starts expanded when defaultExpanded is true", () => {
      renderCard({
        error: createErrorInfo({
          messageEn: "Pre-expanded error",
          details: "Visible from start",
        }),
        defaultExpanded: true,
      });

      expect(screen.getByText("Visible from start")).toBeDefined();
      expect(screen.getByText("\u6536\u8D77\u8BE6\u60C5").getAttribute("aria-expanded")).toBe("true");
    });

    it("shows recoverable status in details", () => {
      renderCard({
        error: createErrorInfo({ recoverable: true }),
        defaultExpanded: true,
      });

      expect(screen.getByText("\u53EF\u6062\u590D:")).toBeDefined();
      expect(screen.getByText("\u662F")).toBeDefined();
    });

    it("shows non-recoverable status in details", () => {
      renderCard({
        error: createErrorInfo({ recoverable: false }),
        defaultExpanded: true,
      });

      expect(screen.getByText("\u5426")).toBeDefined();
    });

    it("displays object details as JSON", () => {
      renderCard({
        error: createErrorInfo({
          details: { field: "dateRange", min: "2020-01-01" },
        }),
        defaultExpanded: true,
      });

      // JSON.stringify output should be in the DOM
      const detailsElement = screen.getByText(/dateRange/);
      expect(detailsElement).toBeDefined();
    });

    it("does not show expand button when no details available", () => {
      renderCard({
        error: createErrorInfo({
          messageEn: "",
          details: undefined,
        }),
      });

      expect(screen.queryByText("\u5C55\u5F00\u8BE6\u60C5")).toBeNull();
    });
  });

  // ===========================================================================
  // TESTS: Accessibility
  // ===========================================================================

  describe("accessibility", () => {
    it("has role='alert' on root element", () => {
      renderCard();

      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
    });

    it("has aria-label with category and message", () => {
      renderCard({
        error: createErrorInfo({
          code: "BT200",
          message: "\u6570\u636E\u83B7\u53D6\u5931\u8D25",
        }),
      });

      const alert = screen.getByRole("alert");
      expect(alert.getAttribute("aria-label")).toBe(
        "\u6570\u636E\u9519\u8BEF: \u6570\u636E\u83B7\u53D6\u5931\u8D25",
      );
    });

    it("error code has aria-label", () => {
      renderCard({
        error: createErrorInfo({ code: "BT403" }),
      });

      const codeElement = screen.getByLabelText("Error code: BT403");
      expect(codeElement).toBeDefined();
    });

    it("expand button has aria-expanded attribute", () => {
      renderCard({
        error: createErrorInfo({ messageEn: "Some message" }),
      });

      const expandButton = screen.getByText("\u5C55\u5F00\u8BE6\u60C5");
      expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("expand button has aria-controls pointing to details section", () => {
      renderCard({
        error: createErrorInfo({ messageEn: "Some message" }),
      });

      const expandButton = screen.getByText("\u5C55\u5F00\u8BE6\u60C5");
      expect(expandButton.getAttribute("aria-controls")).toBe("error-details");
    });

    it("action buttons are keyboard accessible (type='button')", () => {
      renderCard({ actions: createActions() });

      const buttons = screen.getAllByRole("button");
      // At least the action buttons should have type="button"
      const actionButton = screen.getByText("\u5E94\u7528\u5EFA\u8BAE");
      expect(actionButton.getAttribute("type")).toBe("button");
    });
  });

  // ===========================================================================
  // TESTS: Design Token Compliance
  // ===========================================================================

  describe("design tokens", () => {
    it("root element uses bg-surface-elevated", () => {
      const { container } = renderCard();

      const alertEl = container.querySelector("[role='alert']");
      expect(alertEl?.className).toContain("bg-surface-elevated");
    });

    it("root element has left border class", () => {
      const { container } = renderCard();

      const alertEl = container.querySelector("[role='alert']");
      expect(alertEl?.className).toContain("border-l-");
    });

    it("error code uses font-mono and tabular-nums", () => {
      renderCard();

      const codeEl = screen.getByLabelText("Error code: BT300");
      expect(codeEl.className).toContain("font-mono");
      expect(codeEl.className).toContain("tabular-nums");
    });
  });

  // ===========================================================================
  // TESTS: Defensive / Edge Cases
  // ===========================================================================

  describe("defensive handling", () => {
    it("renders gracefully with minimal ErrorInfo", () => {
      const minimalError: ErrorInfo = {
        code: "BT999",
        message: "\u672A\u77E5\u9519\u8BEF",
        messageEn: "",
        recoverable: false,
      };

      renderCard({ error: minimalError });

      expect(screen.getByText("BT999")).toBeDefined();
      expect(screen.getByText("\u672A\u77E5\u9519\u8BEF")).toBeDefined();
    });

    it("renders without actions or onClose", () => {
      renderCard({
        error: createErrorInfo(),
        actions: undefined,
        onClose: undefined,
      });

      // Should render without errors
      expect(screen.getByRole("alert")).toBeDefined();
    });

    it("accepts custom className", () => {
      const { container } = renderCard({ className: "my-custom-class" });

      const alertEl = container.querySelector("[role='alert']");
      expect(alertEl?.className).toContain("my-custom-class");
    });
  });

  // ===========================================================================
  // TESTS: Error Message Three Elements
  // ===========================================================================

  describe("error message three elements", () => {
    it("displays all three elements: what happened, why, what to do", () => {
      renderCard({
        error: createErrorInfo({
          message: "\u6570\u636E\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u5B8C\u6210\u56DE\u6D4B",
          messageEn: "Insufficient data for backtest",
          suggestedAction: "\u8BF7\u6269\u5927\u65E5\u671F\u8303\u56F4\u6216\u9009\u62E9\u6570\u636E\u66F4\u5B8C\u6574\u7684\u6807\u7684",
        }),
      });

      // What happened (问题)
      expect(screen.getByText("\u95EE\u9898")).toBeDefined();
      expect(screen.getByText("\u6570\u636E\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u5B8C\u6210\u56DE\u6D4B")).toBeDefined();

      // Why (原因)
      expect(screen.getByText("\u539F\u56E0")).toBeDefined();
      expect(screen.getByText("Insufficient data for backtest")).toBeDefined();

      // What to do (建议)
      expect(screen.getByText("\u5EFA\u8BAE")).toBeDefined();
      expect(
        screen.getByText("\u8BF7\u6269\u5927\u65E5\u671F\u8303\u56F4\u6216\u9009\u62E9\u6570\u636E\u66F4\u5B8C\u6574\u7684\u6807\u7684"),
      ).toBeDefined();
    });
  });
});
