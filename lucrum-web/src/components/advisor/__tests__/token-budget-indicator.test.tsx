/**
 * Tests for TokenBudgetIndicator Component
 *
 * Validates rendering, color transitions at thresholds,
 * and numeric display formatting.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenBudgetIndicator } from "../token-budget-indicator";

describe("TokenBudgetIndicator", () => {
  it("renders with usage stats", () => {
    render(<TokenBudgetIndicator used={500} total={3000} />);

    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/3,000/)).toBeInTheDocument();
  });

  it("renders a progress bar", () => {
    render(<TokenBudgetIndicator used={1500} total={3000} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("applies green color for low usage (<70%)", () => {
    const { container } = render(
      <TokenBudgetIndicator used={1000} total={3000} />
    );

    // The progress fill should have green-related class
    const fill = container.querySelector("[data-testid='token-budget-fill']");
    expect(fill).toBeInTheDocument();
    expect(fill?.className).toContain("bg-emerald");
  });

  it("applies yellow color for medium usage (70-90%)", () => {
    const { container } = render(
      <TokenBudgetIndicator used={2400} total={3000} />
    );

    const fill = container.querySelector("[data-testid='token-budget-fill']");
    expect(fill).toBeInTheDocument();
    expect(fill?.className).toContain("bg-yellow");
  });

  it("applies red color for high usage (>90%)", () => {
    const { container } = render(
      <TokenBudgetIndicator used={2800} total={3000} />
    );

    const fill = container.querySelector("[data-testid='token-budget-fill']");
    expect(fill).toBeInTheDocument();
    expect(fill?.className).toContain("bg-red");
  });

  it("does not exceed 100% width", () => {
    const { container } = render(
      <TokenBudgetIndicator used={5000} total={3000} />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders zero usage correctly", () => {
    render(<TokenBudgetIndicator used={0} total={3000} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  it("supports compact mode", () => {
    const { container } = render(
      <TokenBudgetIndicator used={1500} total={3000} compact />
    );

    // In compact mode, the container should have a smaller class
    expect(container.firstElementChild?.className).toContain("text-xs");
  });
});
