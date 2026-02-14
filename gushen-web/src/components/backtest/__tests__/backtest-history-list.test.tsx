/**
 * BacktestHistoryList Component Tests
 *
 * Tests:
 * - Renders list of backtest history entries
 * - Displays ScoreCard(mini) for each entry
 * - Shows empty state when no entries
 * - Click row triggers onSelect callback
 * - Keyboard navigation (arrow keys, Enter)
 * - Timestamps formatted correctly
 * - Financial data uses tabular-nums
 * - ARIA accessibility attributes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BacktestHistoryList } from "../backtest-history-list";
import type { BacktestHistoryEntry } from "@/lib/stores/backtest-history-store";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockEntry(
  overrides?: Partial<BacktestHistoryEntry>
): BacktestHistoryEntry {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    strategyName: "KDJ Golden Cross",
    symbol: "600519",
    symbolName: "Gui Zhou Mao Tai",
    totalReturn: "0.235",
    annualizedReturn: "0.18",
    maxDrawdown: "0.083",
    sharpeRatio: "1.45",
    grade: "A",
    score: 78,
    tradeCount: 12,
    ...overrides,
  };
}

function createEntries(count: number): BacktestHistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEntry({
      id: `entry-${i}`,
      timestamp: Date.now() - i * 60000,
      strategyName: `Strategy ${i}`,
      symbol: `60051${i}`,
      grade: (["S", "A", "B", "C", "D"] as const)[i % 5],
      score: 90 - i * 10,
    })
  );
}

// =============================================================================
// TESTS
// =============================================================================

describe("BacktestHistoryList", () => {
  const defaultProps = {
    entries: createEntries(3),
    onSelect: vi.fn(),
    onRunBacktest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  describe("rendering", () => {
    it("should render the correct number of entries", () => {
      render(<BacktestHistoryList {...defaultProps} />);

      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(3);
    });

    it("should display strategy name and symbol for each entry", () => {
      const entries = [
        createMockEntry({
          id: "e1",
          strategyName: "MACD Strategy",
          symbol: "000001",
          symbolName: "Ping An Bank",
        }),
      ];

      render(
        <BacktestHistoryList
          entries={entries}
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      expect(screen.getByText("MACD Strategy")).toBeInTheDocument();
      expect(screen.getByText("000001")).toBeInTheDocument();
    });

    it("should display grade for each entry", () => {
      const entries = [
        createMockEntry({ id: "s1", grade: "S" }),
        createMockEntry({ id: "a1", grade: "A" }),
      ];

      render(
        <BacktestHistoryList
          entries={entries}
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      // ScoreCard(mini) renders the grade letter
      expect(screen.getByText("S")).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("should display total return percentage", () => {
      const entries = [
        createMockEntry({ id: "r1", totalReturn: "0.235" }),
      ];

      render(
        <BacktestHistoryList
          entries={entries}
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      // Should render +23.5% or similar formatted return
      expect(screen.getByText(/23\.5/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  describe("empty state", () => {
    it("should show empty state when entries list is empty", () => {
      render(
        <BacktestHistoryList
          entries={[]}
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      expect(screen.getByText("还没有回测记录")).toBeInTheDocument();
    });

    it("should show run backtest button in empty state", () => {
      const onRunBacktest = vi.fn();
      render(
        <BacktestHistoryList
          entries={[]}
          onSelect={vi.fn()}
          onRunBacktest={onRunBacktest}
        />
      );

      const button = screen.getByText("运行第一次回测");
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(onRunBacktest).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  describe("selection", () => {
    it("should call onSelect when a row is clicked", () => {
      const onSelect = vi.fn();
      const entries = [createMockEntry({ id: "click-me" })];

      render(
        <BacktestHistoryList
          entries={entries}
          onSelect={onSelect}
          onRunBacktest={vi.fn()}
        />
      );

      const row = screen.getByRole("row");
      fireEvent.click(row);

      expect(onSelect).toHaveBeenCalledWith("click-me");
    });

    it("should highlight the selected entry", () => {
      const entries = [
        createMockEntry({ id: "sel-1" }),
        createMockEntry({ id: "sel-2" }),
      ];

      render(
        <BacktestHistoryList
          entries={entries}
          selectedId="sel-1"
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      const rows = screen.getAllByRole("row");
      // The selected row should have aria-selected="true"
      expect(rows[0]).toHaveAttribute("aria-selected", "true");
      expect(rows[1]).toHaveAttribute("aria-selected", "false");
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  describe("keyboard navigation", () => {
    it("should move selection down with ArrowDown", () => {
      const onSelect = vi.fn();
      const entries = createEntries(3);

      render(
        <BacktestHistoryList
          entries={entries}
          selectedId="entry-0"
          onSelect={onSelect}
          onRunBacktest={vi.fn()}
        />
      );

      const list = screen.getByRole("listbox");
      fireEvent.keyDown(list, { key: "ArrowDown" });

      expect(onSelect).toHaveBeenCalledWith("entry-1");
    });

    it("should move selection up with ArrowUp", () => {
      const onSelect = vi.fn();
      const entries = createEntries(3);

      render(
        <BacktestHistoryList
          entries={entries}
          selectedId="entry-1"
          onSelect={onSelect}
          onRunBacktest={vi.fn()}
        />
      );

      const list = screen.getByRole("listbox");
      fireEvent.keyDown(list, { key: "ArrowUp" });

      expect(onSelect).toHaveBeenCalledWith("entry-0");
    });

    it("should not move past the last entry with ArrowDown", () => {
      const onSelect = vi.fn();
      const entries = createEntries(3);

      render(
        <BacktestHistoryList
          entries={entries}
          selectedId="entry-2"
          onSelect={onSelect}
          onRunBacktest={vi.fn()}
        />
      );

      const list = screen.getByRole("listbox");
      fireEvent.keyDown(list, { key: "ArrowDown" });

      // Should not have been called since we're at the end
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("should not move past the first entry with ArrowUp", () => {
      const onSelect = vi.fn();
      const entries = createEntries(3);

      render(
        <BacktestHistoryList
          entries={entries}
          selectedId="entry-0"
          onSelect={onSelect}
          onRunBacktest={vi.fn()}
        />
      );

      const list = screen.getByRole("listbox");
      fireEvent.keyDown(list, { key: "ArrowUp" });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------

  describe("accessibility", () => {
    it("should have proper ARIA roles", () => {
      render(<BacktestHistoryList {...defaultProps} />);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(3);
    });

    it("should have aria-label on the list container", () => {
      render(<BacktestHistoryList {...defaultProps} />);

      const list = screen.getByRole("listbox");
      expect(list).toHaveAttribute("aria-label", "回测历史列表");
    });

    it("should use tabular-nums for numeric values", () => {
      const entries = [createMockEntry({ id: "nums" })];
      render(
        <BacktestHistoryList
          entries={entries}
          onSelect={vi.fn()}
          onRunBacktest={vi.fn()}
        />
      );

      // Check that elements with financial data have tabular-nums class
      const row = screen.getByRole("row");
      const returnEl = row.querySelector(".tabular-nums");
      expect(returnEl).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  describe("header", () => {
    it("should display entry count badge", () => {
      render(<BacktestHistoryList {...defaultProps} />);

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should display title", () => {
      render(<BacktestHistoryList {...defaultProps} />);

      expect(screen.getByText("回测历史")).toBeInTheDocument();
    });
  });
});
