/**
 * Discovery Page Content Integration Tests
 *
 * Story 3.2: Discovery Page & Filter
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  DiscoveryStrategy,
  DiscoveryDataSource,
  UseDiscoveryStrategiesReturn,
} from "@/hooks/use-discovery-strategies";

// =============================================================================
// MOCKS
// =============================================================================

const mockStrategies: DiscoveryStrategy[] = [
  {
    id: 1,
    source: "github",
    name: "MACD Momentum Strategy",
    description: "Uses MACD crossover with volume confirmation.",
    author: "quant-dev",
    strategyType: "momentum",
    indicators: ["MACD"],
    views: 500,
    likes: 30,
    popularityScore: "65.00",
    isFeatured: true,
    originalUrl: "https://github.com/example/macd",
    updatedAt: "2026-02-12T00:00:00Z",
  },
  {
    id: 2,
    source: "github",
    name: "Bollinger Band Breakout",
    description: "Buy when price breaks upper band.",
    author: "trader-x",
    strategyType: "trend",
    indicators: ["BB"],
    views: 800,
    likes: 55,
    popularityScore: "72.00",
    isFeatured: false,
    originalUrl: null,
    updatedAt: "2026-02-11T00:00:00Z",
  },
];

const mockRefetch = vi.fn();
const mockShowCached = vi.fn();

function createMockReturn(overrides: Partial<UseDiscoveryStrategiesReturn> = {}): UseDiscoveryStrategiesReturn {
  return {
    strategies: mockStrategies,
    isLoading: false,
    error: null,
    dataSource: "api",
    totalCount: 2,
    dataTimestamp: new Date().toISOString(),
    isStale: false,
    refetch: mockRefetch,
    showCached: mockShowCached,
    ...overrides,
  };
}

let currentMockReturn: UseDiscoveryStrategiesReturn = createMockReturn();

vi.mock("@/hooks/use-discovery-strategies", () => ({
  useDiscoveryStrategies: () => currentMockReturn,
  DEFAULT_FILTERS: { type: "all", sort: "popularity", search: "" },
}));

vi.mock("@/hooks/use-strategy-detail", () => ({
  useStrategyDetail: () => ({ detail: null, isLoading: false, error: null }),
}));

vi.mock("@/hooks/use-quick-preview", () => ({
  useQuickPreview: () => ({ result: null, state: "idle", error: null, runPreview: vi.fn(), reset: vi.fn() }),
}));

vi.mock("@/components/strategy-editor/code-preview", () => ({
  CodePreview: () => null,
}));

vi.mock("@/components/backtest/score-card", () => ({
  ScoreCard: () => null,
}));

vi.mock("../strategy-detail-panel", () => ({ StrategyDetailPanel: () => null }));
vi.mock("@/hooks/use-onboarding-import", () => ({
  useOnboardingImport: () => ({
    fillAndRunSimple: vi.fn(),
    fillIntermediate: vi.fn(),
    fillAdvanced: vi.fn(),
    importToEditor: vi.fn(),
    importToWorkflow: vi.fn(),
    isAutoRunning: false,
    autoRunError: null,
  }),
}));

import { DiscoveryPageContent } from "../discovery-page-content";

// =============================================================================
// TESTS
// =============================================================================

describe("DiscoveryPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockReturn = createMockReturn();
  });

  it("renders page title", () => {
    render(<DiscoveryPageContent />);
    expect(screen.getByText("\u7B56\u7565\u53D1\u73B0")).toBeInTheDocument();
  });

  it("renders filter bar", () => {
    render(<DiscoveryPageContent />);
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
  });

  it("renders strategy cards when data is loaded", () => {
    render(<DiscoveryPageContent />);
    expect(screen.getByText("MACD Momentum Strategy")).toBeInTheDocument();
    expect(screen.getByText("Bollinger Band Breakout")).toBeInTheDocument();
  });

  it("renders card grid with correct test ID", () => {
    render(<DiscoveryPageContent />);
    expect(screen.getByTestId("discovery-card-grid")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    currentMockReturn = createMockReturn({ isLoading: true, strategies: [] });
    render(<DiscoveryPageContent />);
    expect(screen.getByTestId("discovery-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no strategies and not loading", () => {
    currentMockReturn = createMockReturn({ strategies: [], totalCount: 0 });
    render(<DiscoveryPageContent />);
    expect(screen.getByText("\u6682\u65F6\u6CA1\u6709\u53D1\u73B0\u7B56\u7565")).toBeInTheDocument();
  });

  it("shows error banner when API fails", () => {
    currentMockReturn = createMockReturn({ error: "Network error", dataSource: "cache" });
    render(<DiscoveryPageContent />);
    expect(screen.getByTestId("discovery-error-banner")).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it("shows stale data banner when data is stale", () => {
    const oldTs = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    currentMockReturn = createMockReturn({ isStale: true, dataTimestamp: oldTs });
    render(<DiscoveryPageContent />);
    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();
  });

  it("does not show stale banner when data is fresh", () => {
    render(<DiscoveryPageContent />);
    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });

  it("shows builtin indicator when using fallback data", () => {
    currentMockReturn = createMockReturn({ dataSource: "builtin" });
    render(<DiscoveryPageContent />);
    expect(screen.getByText("\u5185\u7F6E\u6A21\u677F")).toBeInTheDocument();
  });

  it("renders correct number of strategy cards", () => {
    render(<DiscoveryPageContent />);
    const cards = screen.getAllByTestId("strategy-discovery-card");
    expect(cards).toHaveLength(2);
  });

  it("has responsive grid classes on card container", () => {
    render(<DiscoveryPageContent />);
    const grid = screen.getByTestId("discovery-card-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
  });
});