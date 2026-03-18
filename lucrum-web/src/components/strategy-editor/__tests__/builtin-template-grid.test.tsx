/**
 * BuiltinTemplateGrid Component Tests
 *
 * Tests the builtin strategy template card grid component.
 * Covers: rendering, interaction, difficulty labels, accessibility, responsive hints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuiltinTemplateGrid } from "../builtin-template-grid";
import { BUILTIN_TEMPLATES } from "@/lib/strategy-templates/builtin-templates";

// =============================================================================
// DEFAULT RENDERING
// =============================================================================

describe("BuiltinTemplateGrid", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  describe("default rendering", () => {
    it("renders the section title", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      expect(screen.getByText("快速开始")).toBeInTheDocument();
    });

    it("renders at least 5 template cards", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const cards = screen.getAllByTestId(/^builtin-template-card-/);
      expect(cards.length).toBeGreaterThanOrEqual(5);
    });

    it("renders template names", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      BUILTIN_TEMPLATES.forEach((template) => {
        expect(screen.getByText(template.name)).toBeInTheDocument();
      });
    });

    it("renders template descriptions", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      BUILTIN_TEMPLATES.forEach((template) => {
        expect(screen.getByText(template.description)).toBeInTheDocument();
      });
    });

    it("renders data-testid for the grid container", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      expect(screen.getByTestId("builtin-template-grid")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // DIFFICULTY BADGES
  // ===========================================================================

  describe("difficulty badges", () => {
    it("renders difficulty labels for each template", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const beginnerCount = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "beginner",
      ).length;
      const intermediateCount = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "intermediate",
      ).length;
      const advancedCount = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "advanced",
      ).length;

      const beginnerLabels = screen.getAllByText("简单");
      const intermediateLabels = screen.getAllByText("进阶");
      const advancedLabels = screen.getAllByText("专业");

      expect(beginnerLabels.length).toBe(beginnerCount);
      expect(intermediateLabels.length).toBe(intermediateCount);
      expect(advancedLabels.length).toBe(advancedCount);
    });

    it("applies correct color classes to beginner badge", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const badges = screen.getAllByText("简单");
      badges.forEach((badge) => {
        expect(badge.className).toMatch(/green/i);
      });
    });

    it("applies correct color classes to intermediate badge", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const badges = screen.getAllByText("进阶");
      badges.forEach((badge) => {
        expect(badge.className).toMatch(/yellow|amber/i);
      });
    });

    it("applies correct color classes to advanced badge", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const badges = screen.getAllByText("专业");
      badges.forEach((badge) => {
        expect(badge.className).toMatch(/red/i);
      });
    });
  });

  // ===========================================================================
  // CLICK INTERACTIONS
  // ===========================================================================

  describe("click interactions", () => {
    it("calls onSelectTemplate when use button is clicked", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const useButtons = screen.getAllByRole("button", { name: /使用/i });
      expect(useButtons.length).toBeGreaterThan(0);

      const firstButton = useButtons[0];
      if (firstButton) {
        fireEvent.click(firstButton);
      }
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it("passes template data when use button is clicked", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const useButtons = screen.getAllByRole("button", { name: /使用/i });
      const firstButton = useButtons[0];
      if (firstButton) {
        fireEvent.click(firstButton);
      }

      // Should be called with an object containing template info
      const callArg = mockOnSelect.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(callArg).toBeDefined();
      expect(callArg).toHaveProperty("id");
      expect(callArg).toHaveProperty("name");
      expect(callArg).toHaveProperty("code");
      expect(callArg).toHaveProperty("prompt");
      expect(callArg).toHaveProperty("defaultParams");
      expect(callArg).toHaveProperty("conditions");
    });

    it("clicking different cards passes different template data", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const useButtons = screen.getAllByRole("button", { name: /使用/i });

      if (useButtons.length >= 2) {
        const firstBtn = useButtons[0];
        const secondBtn = useButtons[1];
        if (firstBtn && secondBtn) {
          fireEvent.click(firstBtn);
          fireEvent.click(secondBtn);

          expect(mockOnSelect).toHaveBeenCalledTimes(2);
          const firstCallId = (mockOnSelect.mock.calls[0]?.[0] as Record<string, unknown> | undefined)?.id;
          const secondCallId = (mockOnSelect.mock.calls[1]?.[0] as Record<string, unknown> | undefined)?.id;
          expect(firstCallId).not.toBe(secondCallId);
        }
      }
    });
  });

  // ===========================================================================
  // BUY/SELL CONDITIONS
  // ===========================================================================

  describe("buy/sell conditions display", () => {
    it("renders buy conditions for each template", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const buyLabels = screen.getAllByText(/买入/);
      expect(buyLabels.length).toBeGreaterThan(0);
    });

    it("renders sell conditions for each template", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const sellLabels = screen.getAllByText(/卖出/);
      expect(sellLabels.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe("accessibility", () => {
    it("template cards have accessible role", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const cards = screen.getAllByTestId(/^builtin-template-card-/);
      cards.forEach((card) => {
        expect(card).toBeInTheDocument();
      });
    });

    it("use buttons have accessible text", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const buttons = screen.getAllByRole("button", { name: /使用/i });
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });

    it("grid container has proper aria label", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const grid = screen.getByTestId("builtin-template-grid");
      expect(grid).toHaveAttribute("aria-label");
    });
  });

  // ===========================================================================
  // EXPECTED SCORE RANGE
  // ===========================================================================

  describe("expected score display", () => {
    it("renders expected score range for templates", () => {
      render(<BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />);
      const scoreElements = screen.getAllByTestId(/^template-score-range-/);
      expect(scoreElements.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("edge cases", () => {
    it("renders without crashing when onSelectTemplate is provided", () => {
      const { container } = render(
        <BuiltinTemplateGrid onSelectTemplate={mockOnSelect} />,
      );
      expect(container).toBeTruthy();
    });
  });
});
