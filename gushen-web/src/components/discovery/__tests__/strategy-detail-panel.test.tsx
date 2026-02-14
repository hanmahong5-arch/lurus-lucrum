/**
 * Strategy Detail Panel Tests
 * Story 3.3: Strategy Detail Panel & Quick Preview
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyDetailPanel } from "../strategy-detail-panel";
import type { StrategyDetail } from "@/hooks/use-strategy-detail";

const mockRunPreview = vi.fn();
const mockReset = vi.fn();

vi.mock("@/hooks/use-quick-preview", () => ({
  useQuickPreview: () => ({ result: null, state: "idle", error: null, runPreview: mockRunPreview, reset: mockReset }),
}));

vi.mock("@/components/strategy-editor/code-preview", () => ({
  CodePreview: ({ code }: { code: string }) => <div data-testid="code-preview">{code.substring(0, 50)}</div>,
}));

vi.mock("@/components/backtest/score-card", () => ({
  ScoreCard: ({ variant }: { variant: string }) => <div data-testid="score-card" data-variant={variant}>ScoreCard</div>,
}));

function createMockDetail(overrides: Partial<StrategyDetail> = {}): StrategyDetail {
  return {
    id: 1, source: "github", name: "Dual MA Crossover",
    description: "A classic trend-following strategy using MA5 and MA20.",
    author: "test-author", strategyType: "trend", indicators: ["MA5", "MA20"],
    views: 1200, likes: 85, popularityScore: "78.50", isFeatured: false,
    originalUrl: "https://github.com/example/strategy", updatedAt: "2026-02-10T00:00:00Z",
    originalCode: null, veighnaCode: "class DualMa(CtaTemplate): pass",
    conversionStatus: "success", annualReturn: "0.15", maxDrawdown: "0.08",
    sharpeRatio: "1.20", tags: ["trend"], markets: ["stock"],
    defaultParams: { fast_window: 5, slow_window: 20, stop_loss_pct: 5 },
    conditions: { buy: ["Short MA crosses above Long MA"], sell: ["Short MA crosses below Long MA"], position: "Fixed lot size" },
    ...overrides,
  };
}

describe("StrategyDetailPanel", () => {
  const defaultProps = { open: true, onOpenChange: vi.fn(), onImportToEditor: vi.fn(), onImportToWorkflow: vi.fn() };

  beforeEach(() => { vi.clearAllMocks(); });

  it("renders strategy name when open", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("detail-strategy-name")).toHaveTextContent("Dual MA Crossover");
  });

  it("renders strategy description", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByText(/classic trend-following/)).toBeInTheDocument();
  });

  it("shows source link for GitHub strategies", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    const link = screen.getByTestId("strategy-source-link");
    expect(link.tagName).toBe("A");
  });

  it("shows source badge for builtin strategies", () => {
    render(<StrategyDetailPanel strategy={createMockDetail({ source: "builtin", originalUrl: null })} {...defaultProps} />);
    expect(screen.getByTestId("strategy-source-link").tagName).toBe("SPAN");
  });

  it("displays popularity metrics", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    const meta = screen.getByTestId("strategy-meta-info");
    expect(meta).toHaveTextContent("85");
    expect(meta).toHaveTextContent("1200");
  });

  it("renders strategy type badge", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("detail-type-badge")).toHaveTextContent("Trend Following");
  });

  it("shows indicators list", () => {
    render(<StrategyDetailPanel strategy={createMockDetail({ indicators: ["MA5", "RSI"] })} {...defaultProps} />);
    expect(screen.getByTestId("strategy-indicators")).toHaveTextContent("MA5");
    expect(screen.getByTestId("strategy-indicators")).toHaveTextContent("RSI");
  });

  it("displays parameter list", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("strategy-params")).toHaveTextContent("fast_window");
  });

  it("renders code preview", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("code-preview")).toBeInTheDocument();
  });

  it("renders trading conditions", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("strategy-conditions")).toHaveTextContent("Short MA crosses above Long MA");
  });

  it("shows quick preview button", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    expect(screen.getByTestId("quick-preview-button")).toBeInTheDocument();
  });

  it("triggers preview on click", () => {
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} />);
    fireEvent.click(screen.getByTestId("quick-preview-button"));
    expect(mockRunPreview).toHaveBeenCalled();
  });

  it("calls onImportToEditor", () => {
    const fn = vi.fn();
    const s = createMockDetail();
    render(<StrategyDetailPanel strategy={s} {...defaultProps} onImportToEditor={fn} />);
    fireEvent.click(screen.getByTestId("import-to-editor-button"));
    expect(fn).toHaveBeenCalledWith(s);
  });

  it("calls onImportToWorkflow", () => {
    const fn = vi.fn();
    const s = createMockDetail();
    render(<StrategyDetailPanel strategy={s} {...defaultProps} onImportToWorkflow={fn} />);
    fireEvent.click(screen.getByTestId("import-to-workflow-button"));
    expect(fn).toHaveBeenCalledWith(s);
  });

  it("calls onOpenChange on back", () => {
    const fn = vi.fn();
    render(<StrategyDetailPanel strategy={createMockDetail()} {...defaultProps} onOpenChange={fn} />);
    fireEvent.click(screen.getByTestId("back-to-list-button"));
    expect(fn).toHaveBeenCalledWith(false);
  });

  it("handles null fields", () => {
    const s = createMockDetail({ description: null, indicators: null, defaultParams: null, conditions: null, originalUrl: null, popularityScore: null });
    render(<StrategyDetailPanel strategy={s} {...defaultProps} />);
    expect(screen.getByTestId("detail-strategy-name")).toHaveTextContent("Dual MA Crossover");
  });

  it("shows skeleton when loading", () => {
    render(<StrategyDetailPanel strategy={null} {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId("detail-skeleton")).toBeInTheDocument();
  });

  it("renders nothing for null strategy", () => {
    render(<StrategyDetailPanel strategy={null} {...defaultProps} />);
    expect(screen.queryByTestId("detail-strategy-name")).not.toBeInTheDocument();
  });

  it("hides preview button without code", () => {
    render(<StrategyDetailPanel strategy={createMockDetail({ veighnaCode: null, originalCode: null })} {...defaultProps} />);
    expect(screen.queryByTestId("quick-preview-button")).not.toBeInTheDocument();
  });
});
