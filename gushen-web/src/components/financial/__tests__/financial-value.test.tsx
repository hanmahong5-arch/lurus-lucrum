/**
 * FinancialValue Component Tests
 * 金融数值组件测试
 *
 * Tests for the FinancialValue component (Story 1.6)
 * Validates:
 * - Component rendering
 * - Typography classes (font-mono, tabular-nums)
 * - Color token application
 * - Arrow display
 * - Responsive variants
 * - Accessibility attributes
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinancialValue, SimpleFinancialValue } from "../financial-value";
import { createFinancialDisplayData } from "@/lib/financial/formatters";
import Decimal from "decimal.js";

describe("FinancialValue Component - Story 1.6", () => {
  // ===========================================================================
  // Basic Rendering (AC-7)
  // ===========================================================================
  describe("Basic Rendering", () => {
    it("should render formatted value", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      expect(screen.getByText("+32.50%")).toBeInTheDocument();
    });

    it("should render price value with currency symbol", () => {
      const data = createFinancialDisplayData(15.2, "price");
      render(<FinancialValue data={data} />);

      expect(screen.getByText("¥+15.20")).toBeInTheDocument();
    });

    it("should render ratio value", () => {
      const data = createFinancialDisplayData(1.234, "ratio");
      render(<FinancialValue data={data} />);

      expect(screen.getByText("+1.234")).toBeInTheDocument();
    });

    it("should render negative values", () => {
      const data = createFinancialDisplayData(-32.5, "percent");
      render(<FinancialValue data={data} />);

      expect(screen.getByText("-32.50%")).toBeInTheDocument();
    });

    it("should render zero values", () => {
      const data = createFinancialDisplayData(0, "percent");
      render(<FinancialValue data={data} />);

      expect(screen.getByText("0.00%")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Typography Classes (AC-3)
  // ===========================================================================
  describe("Typography Classes", () => {
    it("should apply font-mono class", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      // Use aria-label to get the outer span with the classes
      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("font-mono");
    });

    it("should apply tabular-nums class", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      // Use aria-label to get the outer span with the classes
      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("tabular-nums");
    });

    it("should apply both typography classes together", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("font-mono", "tabular-nums");
    });
  });

  // ===========================================================================
  // Color Tokens (AC-4)
  // ===========================================================================
  describe("Color Tokens", () => {
    it("should apply text-profit for positive values", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("text-profit");
    });

    it("should apply text-loss for negative values", () => {
      const data = createFinancialDisplayData(-15.2, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/下跌/);
      expect(element).toHaveClass("text-loss");
    });

    it("should apply text-muted for zero values", () => {
      const data = createFinancialDisplayData(0, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/持平/);
      expect(element).toHaveClass("text-muted");
    });
  });

  // ===========================================================================
  // Arrow Display (AC-4)
  // ===========================================================================
  describe("Arrow Display", () => {
    it("should show up arrow for positive values when showArrow is true", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} showArrow />);

      expect(screen.getByText("↑")).toBeInTheDocument();
    });

    it("should show down arrow for negative values when showArrow is true", () => {
      const data = createFinancialDisplayData(-15.2, "percent");
      render(<FinancialValue data={data} showArrow />);

      expect(screen.getByText("↓")).toBeInTheDocument();
    });

    it("should show dash for zero values when showArrow is true", () => {
      const data = createFinancialDisplayData(0, "percent");
      render(<FinancialValue data={data} showArrow />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("should NOT show arrow when showArrow is false", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} showArrow={false} />);

      expect(screen.queryByText("↑")).not.toBeInTheDocument();
    });

    it("should NOT show arrow by default", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      expect(screen.queryByText("↑")).not.toBeInTheDocument();
    });

    it("should hide arrow from screen readers (aria-hidden)", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} showArrow />);

      const arrow = screen.getByText("↑");
      expect(arrow).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ===========================================================================
  // Responsive Variants (AC-7)
  // ===========================================================================
  describe("Responsive Variants", () => {
    it("should show full variant by default", () => {
      const data = createFinancialDisplayData(32.5, "percent", { label: "总收益率" });
      render(<FinancialValue data={data} variant="full" />);

      expect(screen.getByText("总收益率 +32.50%")).toBeInTheDocument();
    });

    it("should show compact variant when specified", () => {
      const data = createFinancialDisplayData(32.5, "percent", { label: "总收益率" });
      render(<FinancialValue data={data} variant="compact" />);

      expect(screen.getByText("+32.50%")).toBeInTheDocument();
      expect(screen.queryByText("总收益率")).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Accessibility (AC-7)
  // ===========================================================================
  describe("Accessibility", () => {
    it("should have aria-label", () => {
      const data = createFinancialDisplayData(32.5, "percent", { label: "总收益率" });
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText("总收益率 上涨 32.50%");
      expect(element).toBeInTheDocument();
    });

    it("should have correct aria-label for negative values", () => {
      const data = createFinancialDisplayData(-15.2, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText("下跌 15.20%");
      expect(element).toBeInTheDocument();
    });

    it("should have correct aria-label for zero values", () => {
      const data = createFinancialDisplayData(0, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText("持平 0.00%");
      expect(element).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Size Variants
  // ===========================================================================
  describe("Size Variants", () => {
    it("should apply text-xs for xs size", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} size="xs" />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("text-xs");
    });

    it("should apply text-base for base size (default)", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("text-base");
    });

    it("should apply text-2xl for 2xl size", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} size="2xl" />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("text-2xl");
    });
  });

  // ===========================================================================
  // Custom className
  // ===========================================================================
  describe("Custom className", () => {
    it("should apply custom className", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} className="custom-class" />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("custom-class");
    });

    it("should merge custom className with default classes", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} className="custom-class" />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("font-mono", "tabular-nums", "text-profit", "custom-class");
    });
  });

  // ===========================================================================
  // Transitions (AC-6)
  // ===========================================================================
  describe("Transitions", () => {
    it("should have transition-colors class", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("transition-colors");
    });

    it("should have duration-200 class", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("duration-200");
    });

    it("should have motion-reduce:transition-none class", () => {
      const data = createFinancialDisplayData(32.5, "percent");
      render(<FinancialValue data={data} />);

      const element = screen.getByLabelText(/上涨/);
      expect(element).toHaveClass("motion-reduce:transition-none");
    });
  });
});

// ===========================================================================
// SimpleFinancialValue Component Tests
// ===========================================================================
describe("SimpleFinancialValue Component", () => {
  it("should render formatted value without hook", () => {
    render(<SimpleFinancialValue value={32.5} type="percent" />);

    expect(screen.getByText("+32.50%")).toBeInTheDocument();
  });

  it("should apply correct color for positive values", () => {
    render(<SimpleFinancialValue value={32.5} type="percent" />);

    const element = screen.getByLabelText(/上涨/);
    expect(element).toHaveClass("text-profit");
  });

  it("should apply correct color for negative values", () => {
    render(<SimpleFinancialValue value={-15.2} type="percent" />);

    const element = screen.getByLabelText(/下跌/);
    expect(element).toHaveClass("text-loss");
  });

  it("should show arrow when showArrow is true", () => {
    render(<SimpleFinancialValue value={32.5} type="percent" showArrow />);

    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("should apply font-mono and tabular-nums", () => {
    render(<SimpleFinancialValue value={32.5} type="percent" />);

    const element = screen.getByLabelText(/上涨/);
    expect(element).toHaveClass("font-mono", "tabular-nums");
  });
});
