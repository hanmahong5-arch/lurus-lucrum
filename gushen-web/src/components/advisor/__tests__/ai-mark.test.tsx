import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiMark } from "../ai-mark";

// =============================================================================
// TESTS: AiMark Component
// =============================================================================

describe("AiMark", () => {
  describe("default rendering", () => {
    it("renders children content", () => {
      render(
        <AiMark>
          <span>Test content</span>
        </AiMark>
      );
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("applies ai-mark class by default", () => {
      render(
        <AiMark data-testid="ai-mark-wrapper">
          <span>Content</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-wrapper");
      expect(wrapper).toHaveClass("ai-mark");
    });

    it("renders with data-testid attribute", () => {
      render(
        <AiMark data-testid="ai-mark-wrapper">
          <span>Content</span>
        </AiMark>
      );
      expect(screen.getByTestId("ai-mark-wrapper")).toBeInTheDocument();
    });

    it("merges custom className with ai-mark", () => {
      render(
        <AiMark className="custom-class" data-testid="ai-mark-wrapper">
          <span>Content</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-wrapper");
      expect(wrapper).toHaveClass("ai-mark");
      expect(wrapper).toHaveClass("custom-class");
    });
  });

  describe("pulse animation variant", () => {
    it("applies ai-mark-pulse class when pulse prop is true", () => {
      render(
        <AiMark pulse data-testid="ai-mark-pulse">
          <span>Processing...</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-pulse");
      expect(wrapper).toHaveClass("ai-mark-pulse");
    });

    it("does not apply ai-mark-pulse when pulse is false", () => {
      render(
        <AiMark pulse={false} data-testid="ai-mark-no-pulse">
          <span>Static content</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-no-pulse");
      expect(wrapper).not.toHaveClass("ai-mark-pulse");
      expect(wrapper).toHaveClass("ai-mark");
    });
  });

  describe("reduced motion support", () => {
    it("includes motion-reduce:animate-none class for accessibility", () => {
      render(
        <AiMark pulse data-testid="ai-mark-motion">
          <span>Animated</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-motion");
      expect(wrapper).toHaveClass("motion-reduce:animate-none");
    });
  });

  describe("ARIA attributes", () => {
    it("renders with role and aria-label", () => {
      render(
        <AiMark label="AI generated suggestion">
          <span>Suggestion content</span>
        </AiMark>
      );
      const element = screen.getByRole("complementary");
      expect(element).toHaveAttribute("aria-label", "AI generated suggestion");
    });

    it("uses default aria-label when label prop is not provided", () => {
      render(
        <AiMark>
          <span>Default label content</span>
        </AiMark>
      );
      const element = screen.getByRole("complementary");
      expect(element).toBeInTheDocument();
    });
  });

  describe("as prop for element type", () => {
    it("renders as div by default", () => {
      render(
        <AiMark data-testid="ai-mark-div">
          <span>Div content</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-div");
      expect(wrapper.tagName).toBe("DIV");
    });

    it("renders as section when specified", () => {
      render(
        <AiMark as="section" data-testid="ai-mark-section">
          <span>Section content</span>
        </AiMark>
      );
      const wrapper = screen.getByTestId("ai-mark-section");
      expect(wrapper.tagName).toBe("SECTION");
    });
  });
});
