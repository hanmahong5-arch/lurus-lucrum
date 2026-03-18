/**
 * FailureAnalysisPanel Component Tests
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FailureAnalysisPanel } from "../failure-analysis-panel";
import type { FailureBreakdown } from "@/lib/backtest/parallel/batch-backtest-types";

const SAMPLE_BREAKDOWNS: FailureBreakdown[] = [
  { reason: "data_insufficient", count: 5, symbols: ["A", "B", "C", "D", "E"], label: "数据不足", labelEn: "Insufficient Data" },
  { reason: "suspended", count: 2, symbols: ["F", "G"], label: "停牌", labelEn: "Suspended" },
];

describe("FailureAnalysisPanel", () => {
  it("should not render when no breakdowns", () => {
    const { container } = render(
      <FailureAnalysisPanel breakdowns={[]} totalStocks={10} failedStocks={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("should render failure breakdown rows", () => {
    render(
      <FailureAnalysisPanel breakdowns={SAMPLE_BREAKDOWNS} totalStocks={20} failedStocks={7} />,
    );
    expect(screen.getByTestId("failure-analysis-panel")).toBeTruthy();
    expect(screen.getByTestId("failure-row-data_insufficient")).toBeTruthy();
    expect(screen.getByTestId("failure-row-suspended")).toBeTruthy();
  });

  it("should show failure rate", () => {
    render(
      <FailureAnalysisPanel breakdowns={SAMPLE_BREAKDOWNS} totalStocks={20} failedStocks={7} />,
    );
    expect(screen.getByText(/35%/)).toBeTruthy();
  });

  it("should show symbol counts", () => {
    render(
      <FailureAnalysisPanel breakdowns={SAMPLE_BREAKDOWNS} totalStocks={10} failedStocks={7} />,
    );
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
