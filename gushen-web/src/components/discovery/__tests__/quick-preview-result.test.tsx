/**
 * Quick Preview Result Tests
 * Story 3.3: Strategy Detail Panel & Quick Preview
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickPreviewResult } from "../quick-preview-result";
import type { QuickPreviewData } from "@/hooks/use-quick-preview";
import Decimal from "decimal.js";

vi.mock("@/components/backtest/score-card", () => ({
  ScoreCard: ({ variant }: { variant: string }) => <div data-testid="score-card" data-variant={variant}>ScoreCard</div>,
}));

function createMockData(overrides: Partial<QuickPreviewData> = {}): QuickPreviewData {
  return {
    score: {
      grade: "B" as const, score: 65, description: "Good",
      coreMetrics: {
        totalReturn: new Decimal("0.15"), annualizedReturn: new Decimal("0.12"),
        maxDrawdown: new Decimal("0.08"), sharpeRatio: new Decimal("1.2"),
      },
      breakdown: { profitability: 70, risk: 60, stability: 65, efficiency: 60 },
    },
    totalReturn: "0.1500", maxDrawdown: "0.0800", tradeCount: 12,
    ...overrides,
  };
}

describe("QuickPreviewResult", () => {
  it("renders nothing in idle state", () => {
    const { container } = render(<QuickPreviewResult data={null} state="idle" onRetry={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders loading skeleton", () => {
    render(<QuickPreviewResult data={null} state="loading" onRetry={vi.fn()} />);
    expect(screen.getByTestId("quick-preview-loading")).toBeInTheDocument();
  });

  it("renders ScoreCard compact on success", () => {
    render(<QuickPreviewResult data={createMockData()} state="success" onRetry={vi.fn()} />);
    expect(screen.getByTestId("score-card")).toHaveAttribute("data-variant", "compact");
  });

  it("displays total return and max drawdown", () => {
    render(<QuickPreviewResult data={createMockData()} state="success" onRetry={vi.fn()} />);
    expect(screen.getByTestId("quick-preview-result")).toHaveTextContent("15.00%");
    expect(screen.getByTestId("quick-preview-result")).toHaveTextContent("8.00%");
  });

  it("shows trade count", () => {
    render(<QuickPreviewResult data={createMockData()} state="success" onRetry={vi.fn()} />);
    expect(screen.getByTestId("quick-preview-result")).toHaveTextContent("12");
  });

  it("shows error with retry button", () => {
    render(<QuickPreviewResult data={null} state="error" errorMessage="Network error" onRetry={vi.fn()} />);
    expect(screen.getByTestId("quick-preview-error")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("calls onRetry when retry clicked", () => {
    const fn = vi.fn();
    render(<QuickPreviewResult data={null} state="error" errorMessage="Error" onRetry={fn} />);
    fireEvent.click(screen.getByTestId("quick-preview-retry"));
    expect(fn).toHaveBeenCalled();
  });
});
