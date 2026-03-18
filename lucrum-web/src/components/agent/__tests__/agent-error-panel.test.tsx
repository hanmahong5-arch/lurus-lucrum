/**
 * Tests for AgentErrorPanel Component
 *
 * Validates rendering for different error types, button sets,
 * callback behavior, edge cases, and accessibility attributes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentErrorPanel } from "../custom-agent-run-panel";
import type { AgentError, AgentErrorPanelProps } from "../custom-agent-run-panel";

// =============================================================================
// MOCKS
// =============================================================================

vi.mock("@/components/paywall/upgrade-dialog", () => ({
  UpgradeDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div data-testid="upgrade-dialog">
        <button onClick={() => onOpenChange(false)}>close-upgrade</button>
      </div>
    ) : null,
}));

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createError(overrides?: Partial<AgentError>): AgentError {
  return {
    message: "Something went wrong",
    ...overrides,
  };
}

function renderPanel(props?: Partial<AgentErrorPanelProps>) {
  const defaultProps: AgentErrorPanelProps = {
    error: createError(),
    onRetry: vi.fn(),
    onEditRequest: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  return { ...render(<AgentErrorPanel {...defaultProps} />), props: defaultProps };
}

// =============================================================================
// TESTS
// =============================================================================

describe("AgentErrorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("shows '运行中断' for generic errors", () => {
      renderPanel({ error: createError() });
      expect(screen.getByText("运行中断")).toBeInTheDocument();
    });

    it("shows daily limit title with usage when metadata is present", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT", metadata: { used: 2, limit: 2 } }),
      });
      expect(screen.getByText("今日运行次数已达上限（2/2）")).toBeInTheDocument();
    });

    it("shows daily limit title without usage when metadata is missing", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
      });
      expect(screen.getByText("今日运行次数已达上限")).toBeInTheDocument();
    });

    it("shows quota exceeded title", () => {
      renderPanel({
        error: createError({ code: "QUOTA_EXCEEDED" }),
      });
      expect(screen.getByText("AI Token 配额不足")).toBeInTheDocument();
    });

    it("shows validation error with custom message", () => {
      renderPanel({
        error: createError({ code: "VALIDATION_FAILED", message: "Missing target stocks" }),
      });
      expect(screen.getByText("配置验证失败")).toBeInTheDocument();
      expect(screen.getByText("Missing target stocks")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Button Sets
  // ===========================================================================

  describe("button sets", () => {
    it("shows upgrade + edit buttons for quota errors, no retry", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
      });
      expect(screen.getByLabelText("升级计划")).toBeInTheDocument();
      expect(screen.getByLabelText("修改参数")).toBeInTheDocument();
      expect(screen.queryByLabelText("再试一次")).not.toBeInTheDocument();
    });

    it("shows only edit button for validation errors", () => {
      renderPanel({
        error: createError({ code: "VALIDATION_FAILED", message: "bad config" }),
      });
      expect(screen.queryByLabelText("升级计划")).not.toBeInTheDocument();
      expect(screen.getByLabelText("修改参数")).toBeInTheDocument();
      expect(screen.queryByLabelText("再试一次")).not.toBeInTheDocument();
    });

    it("shows retry + edit buttons for generic errors, no upgrade", () => {
      renderPanel({ error: createError() });
      expect(screen.queryByLabelText("升级计划")).not.toBeInTheDocument();
      expect(screen.getByLabelText("修改参数")).toBeInTheDocument();
      expect(screen.getByLabelText("再试一次")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Callbacks
  // ===========================================================================

  describe("callbacks", () => {
    it("opens UpgradeDialog when upgrade button is clicked", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
      });
      expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("升级计划"));
      expect(screen.getByTestId("upgrade-dialog")).toBeInTheDocument();
    });

    it("calls onEditRequest when edit button is clicked", () => {
      const onEditRequest = vi.fn();
      renderPanel({ error: createError(), onEditRequest });

      fireEvent.click(screen.getByLabelText("修改参数"));
      expect(onEditRequest).toHaveBeenCalledOnce();
    });

    it("calls onRetry when retry button is clicked", () => {
      const onRetry = vi.fn();
      renderPanel({ error: createError(), onRetry });

      fireEvent.click(screen.getByLabelText("再试一次"));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("shows '明天再来' only for quota error with onClose, and calls onClose", () => {
      const onClose = vi.fn();
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
        onClose,
      });

      const btn = screen.getByLabelText("明天再来");
      fireEvent.click(btn);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("hides edit button when onEditRequest is undefined", () => {
      renderPanel({ error: createError(), onEditRequest: undefined });
      expect(screen.queryByLabelText("修改参数")).not.toBeInTheDocument();
    });

    it("hides '明天再来' when onClose is undefined", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
        onClose: undefined,
      });
      expect(screen.queryByLabelText("明天再来")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Upgrade Flow Closure (Step 4)
  // ===========================================================================

  describe("upgrade flow closure", () => {
    it("shows post-upgrade hint after closing UpgradeDialog", () => {
      renderPanel({
        error: createError({ code: "DAILY_LIMIT" }),
      });

      // Hint should not exist initially
      expect(screen.queryByText(/完成升级后刷新页面/)).not.toBeInTheDocument();

      // Open upgrade dialog
      fireEvent.click(screen.getByLabelText("升级计划"));
      expect(screen.getByTestId("upgrade-dialog")).toBeInTheDocument();

      // Close upgrade dialog
      fireEvent.click(screen.getByText("close-upgrade"));
      expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();

      // Hint should now appear
      expect(screen.getByText(/完成升级后刷新页面即可恢复使用/)).toBeInTheDocument();
    });

    it("does not show post-upgrade hint for non-quota errors", () => {
      renderPanel({ error: createError() });
      expect(screen.queryByText(/完成升级后刷新页面/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe("accessibility", () => {
    it("has role=alert on the container", () => {
      renderPanel({ error: createError() });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("has aria-label containing the error title", () => {
      renderPanel({ error: createError() });
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-label", "运行中断");
    });

    it("buttons are findable by aria-label", () => {
      renderPanel({ error: createError() });
      expect(screen.getByLabelText("再试一次")).toBeInTheDocument();
      expect(screen.getByLabelText("修改参数")).toBeInTheDocument();
    });
  });
});
