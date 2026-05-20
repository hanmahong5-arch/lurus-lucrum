/**
 * CostDisclosureCard tests.
 *
 * Covers:
 *   - all-standard → "成本合规" banner + ✓ chips
 *   - one mismatch → "成本偏离" banner + ⚠ chip + delta sentence on expand
 *   - missing fields are treated as standard (engine defaults)
 *   - compact mode suppresses expand affordance
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CostDisclosureCard } from "../cost-disclosure-card";
import { STANDARD_MARKETPLACE_COSTS } from "@/lib/backtest/transaction-costs";

describe("CostDisclosureCard", () => {
  it("flags full compliance when every field matches the baseline", () => {
    render(<CostDisclosureCard costs={STANDARD_MARKETPLACE_COSTS} />);
    expect(screen.getByText("成本合规")).toBeTruthy();
    // Each chip rendered (label appears in the row).
    expect(screen.getByText("佣金")).toBeTruthy();
    expect(screen.getByText("印花税")).toBeTruthy();
    expect(screen.getByText("滑点")).toBeTruthy();
    expect(screen.getByText("复权口径")).toBeTruthy();
    // No deviation warning.
    expect(screen.queryByText("成本偏离")).toBeNull();
  });

  it("flags deviation + surfaces the delta sentence when expanded", () => {
    render(
      <CostDisclosureCard
        costs={{
          commission: 0.001, // 0.1% — clearly above the 0.025% standard
          slippage: STANDARD_MARKETPLACE_COSTS.slippage,
          stampDuty: STANDARD_MARKETPLACE_COSTS.stampDuty,
        }}
      />,
    );
    expect(screen.getByText("成本偏离")).toBeTruthy();

    // Expand the body to see the rationale.
    fireEvent.click(screen.getByText("成本偏离"));
    expect(
      screen.getByText(/当前 0\.100% ≠ 市场标准 0\.025%/),
    ).toBeTruthy();
  });

  it("treats absent fields as standard (engine fills defaults)", () => {
    render(<CostDisclosureCard costs={{}} />);
    expect(screen.getByText("成本合规")).toBeTruthy();
  });

  it("rejects nullish input gracefully", () => {
    render(<CostDisclosureCard costs={null} />);
    expect(screen.getByText("成本合规")).toBeTruthy();
  });

  it("compact mode hides the expand chevron and skips toggle", () => {
    const { container } = render(
      <CostDisclosureCard costs={STANDARD_MARKETPLACE_COSTS} compact />,
    );
    // The toggle button is rendered but disabled — clicking it must not open
    // the detail body (which carries the table headers "项目 / 当前 / 市场标准").
    const button = within(container).getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(screen.queryByText("项目")).toBeNull();
  });
});
