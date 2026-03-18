/**
 * Strategy Discovery Card Tests
 *
 * Story 3.2: Discovery Page & Filter
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyDiscoveryCard } from "../strategy-discovery-card";
import type { DiscoveryStrategy } from "@/hooks/use-discovery-strategies";

// =============================================================================
// TEST DATA
// =============================================================================

function createMockStrategy(overrides: Partial<DiscoveryStrategy> = {}): DiscoveryStrategy {
  return {
    id: 1,
    source: "github",
    name: "Dual Moving Average Crossover",
    description: "A classic trend-following strategy using MA5 and MA20 crossover signals.",
    author: "test-author",
    strategyType: "trend",
    indicators: ["MA5", "MA20"],
    views: 1200,
    likes: 85,
    popularityScore: "78.50",
    isFeatured: false,
    originalUrl: "https://github.com/example/strategy",
    updatedAt: "2026-02-10T00:00:00Z",
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("StrategyDiscoveryCard", () => {
  it("renders strategy name and description", () => {
    const strategy = createMockStrategy();
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByText("Dual Moving Average Crossover")).toBeInTheDocument();
    expect(screen.getByText(/classic trend-following/)).toBeInTheDocument();
  });

  it("renders strategy type badge", () => {
    const strategy = createMockStrategy({ strategyType: "trend" });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByTestId("strategy-type-badge")).toHaveTextContent("\u8D8B\u52BF\u8DDF\u8E2A");
  });

  it("renders source badge for GitHub", () => {
    const strategy = createMockStrategy({ source: "github" });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByTestId("strategy-source-badge")).toHaveTextContent("GitHub");
  });

  it("renders popularity metrics (likes and views)", () => {
    const strategy = createMockStrategy({ views: 1200, likes: 85 });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByTestId("strategy-likes")).toHaveTextContent("85");
    expect(screen.getByTestId("strategy-views")).toHaveTextContent("1200");
  });

  it("calls onSelect when clicked", () => {
    const strategy = createMockStrategy();
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("strategy-discovery-card"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(strategy);
  });

  it("calls onSelect on Enter key", () => {
    const strategy = createMockStrategy();
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    fireEvent.keyDown(screen.getByTestId("strategy-discovery-card"), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows featured badge for featured strategies", () => {
    const strategy = createMockStrategy({ isFeatured: true });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByTestId("strategy-featured-badge")).toBeInTheDocument();
  });

  it("does not show featured badge for non-featured strategies", () => {
    const strategy = createMockStrategy({ isFeatured: false });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.queryByTestId("strategy-featured-badge")).not.toBeInTheDocument();
  });

  it("handles null description gracefully", () => {
    const strategy = createMockStrategy({ description: null });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByText("\u6682\u65E0\u63CF\u8FF0")).toBeInTheDocument();
  });

  it("handles null strategyType gracefully", () => {
    const strategy = createMockStrategy({ strategyType: null });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.queryByTestId("strategy-type-badge")).not.toBeInTheDocument();
  });

  it("renders author when present", () => {
    const strategy = createMockStrategy({ author: "quant-expert" });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.getByText("by quant-expert")).toBeInTheDocument();
  });

  it("does not render author when null", () => {
    const strategy = createMockStrategy({ author: null });
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
  });

  it("has correct ARIA attributes for accessibility", () => {
    const strategy = createMockStrategy();
    const onSelect = vi.fn();

    render(<StrategyDiscoveryCard strategy={strategy} onSelect={onSelect} />);

    const card = screen.getByTestId("strategy-discovery-card");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabIndex", "0");
    expect(card).toHaveAttribute("aria-label");
  });
});