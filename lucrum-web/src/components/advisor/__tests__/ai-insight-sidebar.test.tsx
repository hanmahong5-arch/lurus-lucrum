import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AiInsightSidebar } from "../ai-insight-sidebar";
import {
  useAiSidebarStore,
  type BacktestContextPayload,
  type StockContextPayload,
} from "@/lib/stores/ai-sidebar-store";

// =============================================================================
// MOCKS
// =============================================================================

// Mock the AdvisorChat component to avoid complex dependency chain
vi.mock("../advisor-chat", () => ({
  AdvisorChat: ({ className, initialContext }: { className?: string; initialContext?: Record<string, unknown> }) => (
    <div data-testid="mock-advisor-chat" className={className}>
      <span data-testid="advisor-context">
        {initialContext ? JSON.stringify(initialContext) : "no-context"}
      </span>
    </div>
  ),
  default: ({ className, initialContext }: { className?: string; initialContext?: Record<string, unknown> }) => (
    <div data-testid="mock-advisor-chat" className={className}>
      <span data-testid="advisor-context">
        {initialContext ? JSON.stringify(initialContext) : "no-context"}
      </span>
    </div>
  ),
}));

// =============================================================================
// HELPERS
// =============================================================================

const mockBacktestContext: BacktestContextPayload = {
  strategyCode: 'class TestStrategy:\n  pass',
  parameters: { period: 14, threshold: 0.5 },
  summary: {
    totalReturn: 0.25,
    annualizedReturn: 0.18,
    maxDrawdown: 0.15,
    maxDrawdownDuration: 30,
    sharpeRatio: 1.2,
    winRate: 0.6,
    totalTrades: 42,
    profitFactor: 1.8,
    score: "A",
  },
  symbol: "600519",
  stockName: "test-stock",
};

const mockStockContext: StockContextPayload = {
  symbol: "600519",
  stockName: "test-stock",
  performance: "good",
  metrics: {
    winRate: 0.65,
    totalReturn: 0.3,
    sharpeRatio: 1.5,
  },
};

// =============================================================================
// TESTS: AiInsightSidebar Component
// =============================================================================

describe("AiInsightSidebar", () => {
  beforeEach(() => {
    // Reset the store before each test
    useAiSidebarStore.getState().close();
  });

  describe("closed state", () => {
    it("does not render when closed", () => {
      render(<AiInsightSidebar />);
      expect(screen.queryByTestId("ai-insight-sidebar")).not.toBeInTheDocument();
    });
  });

  describe("open state with backtest context", () => {
    it("renders sidebar when opened with backtest context", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      expect(screen.getByTestId("ai-insight-sidebar")).toBeInTheDocument();
    });

    it("renders the advisor chat component", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      expect(screen.getByTestId("mock-advisor-chat")).toBeInTheDocument();
    });

    it("displays sidebar header with title", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      expect(screen.getByText("AI Insight")).toBeInTheDocument();
    });

    it("closes when close button is clicked", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId("ai-insight-sidebar")).not.toBeInTheDocument();
    });
  });

  describe("open state with stock context", () => {
    it("renders sidebar when opened with stock context", () => {
      act(() => {
        useAiSidebarStore.getState().openWithStockContext(mockStockContext);
      });

      render(<AiInsightSidebar />);
      expect(screen.getByTestId("ai-insight-sidebar")).toBeInTheDocument();
    });

    it("displays pre-filled question for stock context", () => {
      act(() => {
        useAiSidebarStore.getState().openWithStockContext(mockStockContext);
      });

      render(<AiInsightSidebar />);
      // The pre-filled question should be visible in the context
      const contextEl = screen.getByTestId("advisor-context");
      expect(contextEl).toBeInTheDocument();
    });
  });

  describe("ARIA accessibility", () => {
    it("has proper ARIA role and label", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      const sidebar = screen.getByTestId("ai-insight-sidebar");
      expect(sidebar).toHaveAttribute("role", "complementary");
      expect(sidebar).toHaveAttribute("aria-label");
    });
  });

  describe("AI visual language", () => {
    it("uses AI design tokens in sidebar header", () => {
      act(() => {
        useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
      });

      render(<AiInsightSidebar />);
      const sidebar = screen.getByTestId("ai-insight-sidebar");
      // Sidebar should have AI-themed styling
      expect(sidebar).toHaveClass("border-l");
    });
  });
});

// =============================================================================
// TESTS: AI Sidebar Store
// =============================================================================

describe("useAiSidebarStore", () => {
  beforeEach(() => {
    useAiSidebarStore.getState().close();
  });

  it("initializes with closed state", () => {
    const state = useAiSidebarStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.context).toBeNull();
  });

  it("opens with backtest context", () => {
    act(() => {
      useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
    });

    const state = useAiSidebarStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.contextType).toBe("backtest");
    expect(state.context).not.toBeNull();
  });

  it("opens with stock context", () => {
    act(() => {
      useAiSidebarStore.getState().openWithStockContext(mockStockContext);
    });

    const state = useAiSidebarStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.contextType).toBe("stock");
    expect(state.context).not.toBeNull();
  });

  it("closes and clears context", () => {
    act(() => {
      useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
    });
    expect(useAiSidebarStore.getState().isOpen).toBe(true);

    act(() => {
      useAiSidebarStore.getState().close();
    });

    const state = useAiSidebarStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.context).toBeNull();
  });

  it("builds advisor context from backtest payload", () => {
    act(() => {
      useAiSidebarStore.getState().openWithBacktestContext(mockBacktestContext);
    });

    const state = useAiSidebarStore.getState();
    expect(state.context).not.toBeNull();
  });

  it("generates pre-filled question for stock with good performance", () => {
    const goodStock: StockContextPayload = {
      ...mockStockContext,
      performance: "good",
      stockName: "test-stock",
    };

    act(() => {
      useAiSidebarStore.getState().openWithStockContext(goodStock);
    });

    const state = useAiSidebarStore.getState();
    expect(state.preFilledQuestion).toContain("test-stock");
  });

  it("generates pre-filled question for stock with poor performance", () => {
    const poorStock: StockContextPayload = {
      ...mockStockContext,
      performance: "poor",
      stockName: "test-stock",
    };

    act(() => {
      useAiSidebarStore.getState().openWithStockContext(poorStock);
    });

    const state = useAiSidebarStore.getState();
    expect(state.preFilledQuestion).toContain("test-stock");
  });
});
