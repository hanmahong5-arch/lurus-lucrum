/**
 * TieredDemoSelector Component Tests
 * Story 3.4: Tiered Onboarding Import
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TieredDemoSelector } from "../tiered-demo-selector";

// Mock DIFFICULTY_CONFIG
vi.mock("@/lib/strategy-templates/builtin-templates", () => ({
  DIFFICULTY_CONFIG: {
    beginner: {
      label: "Simple",
      labelEn: "Beginner",
      colorClass: "text-green-400",
      bgClass: "bg-green-500/20 text-green-400",
    },
    intermediate: {
      label: "Intermediate",
      labelEn: "Intermediate",
      colorClass: "text-yellow-400",
      bgClass: "bg-yellow-500/20 text-yellow-400",
    },
    advanced: {
      label: "Advanced",
      labelEn: "Advanced",
      colorClass: "text-red-400",
      bgClass: "bg-red-500/20 text-red-400",
    },
  },
}));

// Mock Button component
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
    "data-testid"?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-testid={props["data-testid"]}>
      {children}
    </button>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("TieredDemoSelector", () => {
  const defaultProps = {
    onSimple: vi.fn(),
    onIntermediate: vi.fn(),
    onAdvanced: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three tier cards", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    expect(screen.getByTestId("tier-card-simple")).toBeInTheDocument();
    expect(screen.getByTestId("tier-card-intermediate")).toBeInTheDocument();
    expect(screen.getByTestId("tier-card-advanced")).toBeInTheDocument();
  });

  it("renders difficulty badges for each tier", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    expect(screen.getByTestId("difficulty-badge-beginner")).toBeInTheDocument();
    expect(screen.getByTestId("difficulty-badge-intermediate")).toBeInTheDocument();
    expect(screen.getByTestId("difficulty-badge-advanced")).toBeInTheDocument();
  });

  it("renders the main container with data-testid", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    expect(screen.getByTestId("tiered-demo-selector")).toBeInTheDocument();
  });

  it("calls onSimple when simple tier button is clicked", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tier-button-simple"));
    expect(defaultProps.onSimple).toHaveBeenCalledTimes(1);
  });

  it("calls onIntermediate when intermediate tier button is clicked", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tier-button-intermediate"));
    expect(defaultProps.onIntermediate).toHaveBeenCalledTimes(1);
  });

  it("calls onAdvanced when advanced tier button is clicked", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tier-button-advanced"));
    expect(defaultProps.onAdvanced).toHaveBeenCalledTimes(1);
  });

  it("disables all buttons when isAutoRunning is true", () => {
    render(<TieredDemoSelector {...defaultProps} isAutoRunning />);
    expect(screen.getByTestId("tier-button-simple")).toBeDisabled();
    expect(screen.getByTestId("tier-button-intermediate")).toBeDisabled();
    expect(screen.getByTestId("tier-button-advanced")).toBeDisabled();
  });

  it("shows error message when autoRunError is set", () => {
    render(
      <TieredDemoSelector {...defaultProps} autoRunError="Backtest failed" />
    );
    expect(screen.getByTestId("auto-run-error")).toHaveTextContent(
      "Backtest failed"
    );
  });

  it("does not show error message when autoRunError is null", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    expect(screen.queryByTestId("auto-run-error")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<TieredDemoSelector {...defaultProps} className="custom-class" />);
    const container = screen.getByTestId("tiered-demo-selector");
    expect(container.className).toContain("custom-class");
  });

  it("renders Quick Start heading", () => {
    render(<TieredDemoSelector {...defaultProps} />);
    expect(screen.getByText("/ Quick Start")).toBeInTheDocument();
  });
});
