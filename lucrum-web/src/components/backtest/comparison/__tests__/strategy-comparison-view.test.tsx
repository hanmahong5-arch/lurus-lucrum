/**
 * StrategyComparisonView Component Tests
 *
 * Tests:
 * - Both strategies render with names and scores
 * - Winner summary banner displays correctly
 * - Metric comparison table renders all groups
 * - Metric diff arrows and colors
 * - Responsive layout (desktop/mobile)
 * - ARIA attributes and accessibility
 * - Edge cases: tie, null scores, empty equity curves
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Decimal from "decimal.js";
import { StrategyComparisonView } from "../strategy-comparison-view";
import { WinnerSummary } from "../winner-summary";
import { MetricComparisonTable } from "../metric-comparison-table";
import type { ComparisonResult, MetricGroup, CategoryWinners } from "@/lib/comparison/types";
import type { StrategyScore } from "@/lib/backtest/score/types";

// =============================================================================
// TEST FIXTURES / 测试数据
// =============================================================================

function createMockScore(grade: "S" | "A" | "B" | "C" | "D"): StrategyScore {
  const configs = {
    S: { score: 92, description: "卓越" },
    A: { score: 78, description: "优秀" },
    B: { score: 65, description: "良好" },
    C: { score: 45, description: "一般" },
    D: { score: 25, description: "需改进" },
  };
  const config = configs[grade];
  return {
    grade,
    score: config.score,
    description: config.description,
    coreMetrics: {
      totalReturn: new Decimal(0.235),
      annualizedReturn: new Decimal(0.18),
      maxDrawdown: new Decimal(0.083),
      sharpeRatio: new Decimal(1.45),
    },
    breakdown: { profitability: 85, risk: 72, stability: 80, efficiency: 65 },
  };
}

function createMockComparison(
  overrides?: Partial<ComparisonResult>
): ComparisonResult {
  return {
    strategyA: {
      name: "MACD Golden Cross",
      score: createMockScore("A"),
      equityCurve: [
        { date: "2025-01-02", equity: 100000 },
        { date: "2025-12-31", equity: 123500 },
      ],
    },
    strategyB: {
      name: "KDJ Reversal",
      score: createMockScore("B"),
      equityCurve: [
        { date: "2025-01-02", equity: 100000 },
        { date: "2025-12-31", equity: 115000 },
      ],
    },
    metricGroups: [
      {
        key: "return",
        label: "收益指标",
        winner: "a",
        metrics: [
          {
            key: "totalReturn",
            label: "总收益率",
            valueA: 0.235,
            valueB: 0.15,
            absoluteDiff: 0.085,
            percentDiff: 56.67,
            higherIsBetter: true,
            winner: "a",
            directionForA: "better",
          },
          {
            key: "annualizedReturn",
            label: "年化收益率",
            valueA: 0.18,
            valueB: 0.12,
            absoluteDiff: 0.06,
            percentDiff: 50,
            higherIsBetter: true,
            winner: "a",
            directionForA: "better",
          },
        ],
      },
      {
        key: "risk",
        label: "风险指标",
        winner: "a",
        metrics: [
          {
            key: "maxDrawdown",
            label: "最大回撤",
            valueA: 0.083,
            valueB: 0.12,
            absoluteDiff: -0.037,
            percentDiff: -30.83,
            higherIsBetter: false,
            winner: "a",
            directionForA: "better",
          },
          {
            key: "sharpeRatio",
            label: "夏普比率",
            valueA: 1.45,
            valueB: 0.95,
            absoluteDiff: 0.5,
            percentDiff: 52.63,
            higherIsBetter: true,
            winner: "a",
            directionForA: "better",
          },
        ],
      },
      {
        key: "trading",
        label: "交易指标",
        winner: "b",
        metrics: [
          {
            key: "winRate",
            label: "胜率",
            valueA: 0.625,
            valueB: 0.467,
            absoluteDiff: 0.158,
            percentDiff: 33.83,
            higherIsBetter: true,
            winner: "a",
            directionForA: "better",
          },
          {
            key: "totalTrades",
            label: "总交易次数",
            valueA: 24,
            valueB: 30,
            absoluteDiff: -6,
            percentDiff: -20,
            higherIsBetter: false,
            winner: "a",
            directionForA: "better",
          },
        ],
      },
    ],
    allMetrics: [],
    winners: {
      byReturn: "a",
      byRisk: "a",
      byTrading: "b",
      overall: "a",
    },
    summaryText:
      "MACD Golden Cross 综合表现更优：收益率高 8.5%、回撤低 3.7%、夏普比率更优",
    ...overrides,
  };
}

// =============================================================================
// STRATEGY COMPARISON VIEW TESTS / 策略对比视图测试
// =============================================================================

describe("StrategyComparisonView", () => {
  it("should render both strategy names", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.getAllByText("MACD Golden Cross").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KDJ Reversal").length).toBeGreaterThan(0);
  });

  it("should render the comparison view container with aria", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    const container = screen.getByTestId("strategy-comparison-view");
    expect(container).toBeDefined();
    expect(container.getAttribute("role")).toBe("region");
    expect(container.getAttribute("aria-label")).toBe("策略对比");
  });

  it("should render Strategy A and Strategy B sections", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.getByText("策略 A")).toBeDefined();
    expect(screen.getByText("策略 B")).toBeDefined();
  });

  it("should show WIN badge on the winning strategy", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    // Strategy A is the overall winner
    const winBadges = screen.getAllByText("WIN");
    expect(winBadges).toHaveLength(1);

    // WIN badge should be in the Strategy A section
    const sectionA = screen.getByTestId("strategy-section-策略 a");
    expect(within(sectionA).getByText("WIN")).toBeDefined();
  });

  it("should not show WIN badge when tied", () => {
    const comparison = createMockComparison({
      winners: {
        byReturn: "tie",
        byRisk: "tie",
        byTrading: "tie",
        overall: "tie",
      },
    });
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.queryByText("WIN")).toBeNull();
  });

  it("should render VS divider", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.getAllByText("VS")).toBeDefined();
  });

  it("should render winner summary banner", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.getByTestId("winner-summary")).toBeDefined();
    expect(screen.getByTestId("summary-text")).toBeDefined();
  });

  it("should render equity curve placeholder when data exists", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.getByTestId("equity-curve-placeholder")).toBeDefined();
  });

  it("should not render equity curve placeholder when no data", () => {
    const comparison = createMockComparison({
      strategyA: {
        name: "A",
        score: null,
        equityCurve: [],
      },
      strategyB: {
        name: "B",
        score: null,
        equityCurve: [],
      },
    });
    render(<StrategyComparisonView comparison={comparison} />);

    expect(screen.queryByTestId("equity-curve-placeholder")).toBeNull();
  });

  it("should render ScoreCard compact for both strategies", () => {
    const comparison = createMockComparison();
    render(<StrategyComparisonView comparison={comparison} />);

    // ScoreCard compact renders with data-testid="score-card-compact"
    const scoreCards = screen.getAllByTestId("score-card-compact");
    expect(scoreCards).toHaveLength(2);
  });

  it("should handle null scores gracefully", () => {
    const comparison = createMockComparison({
      strategyA: {
        name: "Strategy A",
        score: null,
        equityCurve: [],
      },
      strategyB: {
        name: "Strategy B",
        score: null,
        equityCurve: [],
      },
    });

    // Should not throw
    render(<StrategyComparisonView comparison={comparison} />);
    expect(screen.getAllByText("Strategy A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strategy B").length).toBeGreaterThan(0);
  });
});

// =============================================================================
// WINNER SUMMARY TESTS / 胜者摘要测试
// =============================================================================

describe("WinnerSummary", () => {
  it("should display overall winner name", () => {
    render(
      <WinnerSummary
        winners={{ byReturn: "a", byRisk: "a", byTrading: "b", overall: "a" }}
        nameA="MACD"
        nameB="KDJ"
        summaryText="MACD 综合表现更优"
      />
    );

    const overallWinner = screen.getByTestId("overall-winner");
    expect(overallWinner.textContent).toBe("MACD");
  });

  it("should display tie when no winner", () => {
    render(
      <WinnerSummary
        winners={{ byReturn: "tie", byRisk: "tie", byTrading: "tie", overall: "tie" }}
        nameA="MACD"
        nameB="KDJ"
        summaryText="两者表现相近"
      />
    );

    const overallWinner = screen.getByTestId("overall-winner");
    expect(overallWinner.textContent).toBe("平手");
  });

  it("should display summary text", () => {
    render(
      <WinnerSummary
        winners={{ byReturn: "a", byRisk: "b", byTrading: "tie", overall: "a" }}
        nameA="MACD"
        nameB="KDJ"
        summaryText="MACD 收益更高"
      />
    );

    expect(screen.getByTestId("summary-text").textContent).toBe("MACD 收益更高");
  });

  it("should display category breakdown", () => {
    render(
      <WinnerSummary
        winners={{ byReturn: "a", byRisk: "b", byTrading: "tie", overall: "a" }}
        nameA="MACD"
        nameB="KDJ"
        summaryText="Test"
      />
    );

    expect(screen.getByTestId("category-byReturn")).toBeDefined();
    expect(screen.getByTestId("category-byRisk")).toBeDefined();
    expect(screen.getByTestId("category-byTrading")).toBeDefined();
  });

  it("should have aria-label on container", () => {
    render(
      <WinnerSummary
        winners={{ byReturn: "tie", byRisk: "tie", byTrading: "tie", overall: "tie" }}
        nameA="A"
        nameB="B"
        summaryText="Test"
      />
    );

    const container = screen.getByTestId("winner-summary");
    expect(container.getAttribute("aria-label")).toBe("对比结论");
  });
});

// =============================================================================
// METRIC COMPARISON TABLE TESTS / 指标对比表测试
// =============================================================================

describe("MetricComparisonTable", () => {
  const mockGroups: MetricGroup[] = [
    {
      key: "return",
      label: "收益指标",
      winner: "a",
      metrics: [
        {
          key: "totalReturn",
          label: "总收益率",
          valueA: 0.235,
          valueB: 0.15,
          absoluteDiff: 0.085,
          percentDiff: 56.67,
          higherIsBetter: true,
          winner: "a",
          directionForA: "better",
        },
      ],
    },
    {
      key: "risk",
      label: "风险指标",
      winner: "tie",
      metrics: [
        {
          key: "sharpeRatio",
          label: "夏普比率",
          valueA: 1.45,
          valueB: 1.45,
          absoluteDiff: 0,
          percentDiff: 0,
          higherIsBetter: true,
          winner: "tie",
          directionForA: "neutral",
        },
      ],
    },
  ];

  it("should render all metric groups", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="Strategy A"
        nameB="Strategy B"
      />
    );

    expect(screen.getByTestId("metric-group-return")).toBeDefined();
    expect(screen.getByTestId("metric-group-risk")).toBeDefined();
  });

  it("should render group labels", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="A"
        nameB="B"
      />
    );

    expect(screen.getByText("收益指标")).toBeDefined();
    expect(screen.getByText("风险指标")).toBeDefined();
  });

  it("should render metric rows", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="A"
        nameB="B"
      />
    );

    expect(screen.getByTestId("metric-row-totalReturn")).toBeDefined();
    expect(screen.getByTestId("metric-row-sharpeRatio")).toBeDefined();
  });

  it("should display metric labels in Chinese", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="A"
        nameB="B"
      />
    );

    expect(screen.getByText("总收益率")).toBeDefined();
    expect(screen.getByText("夏普比率")).toBeDefined();
  });

  it("should display strategy names in header", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="MACD Strategy"
        nameB="KDJ Strategy"
      />
    );

    expect(screen.getByText("MACD Strategy")).toBeDefined();
    expect(screen.getByText("KDJ Strategy")).toBeDefined();
  });

  it("should have table role for accessibility", () => {
    const { container } = render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="A"
        nameB="B"
      />
    );

    const table = container.querySelector('[role="table"]');
    expect(table).not.toBeNull();
    expect(table!.getAttribute("aria-label")).toBe("策略指标对比表");
  });

  it("should render diff direction arrows", () => {
    render(
      <MetricComparisonTable
        groups={mockGroups}
        nameA="A"
        nameB="B"
      />
    );

    // totalReturn has "better" direction, so should show up arrow
    const totalReturnRow = screen.getByTestId("metric-row-totalReturn");
    expect(totalReturnRow.textContent).toContain("▲");

    // sharpeRatio is "neutral", should show "-"
    const sharpeRow = screen.getByTestId("metric-row-sharpeRatio");
    expect(sharpeRow.textContent).toContain("-");
  });

  it("should handle empty groups", () => {
    render(
      <MetricComparisonTable groups={[]} nameA="A" nameB="B" />
    );

    // Should render header but no groups
    expect(screen.getByText("指标")).toBeDefined();
  });
});
