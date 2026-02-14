/**
 * Backtest History Store Tests
 *
 * Tests:
 * - Add entry to history
 * - Overflow eviction (max 20 entries)
 * - Remove specific entry
 * - Clear all entries
 * - Entries sorted by timestamp descending
 * - Select entry by ID
 * - Duplicate prevention
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBacktestHistoryStore } from "../backtest-history-store";
import type { BacktestHistoryEntry } from "../backtest-history-store";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const MAX_ENTRIES = 20;

function createMockEntry(
  overrides?: Partial<BacktestHistoryEntry>
): BacktestHistoryEntry {
  const id = overrides?.id ?? `test-${Date.now()}-${Math.random()}`;
  return {
    id,
    timestamp: Date.now(),
    strategyName: "Test Strategy",
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

function createEntryWithTimestamp(
  ts: number,
  id?: string
): BacktestHistoryEntry {
  return createMockEntry({ id: id ?? `entry-${ts}`, timestamp: ts });
}

// =============================================================================
// TESTS
// =============================================================================

describe("BacktestHistoryStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useBacktestHistoryStore.getState().clearHistory();
  });

  // ---------------------------------------------------------------------------
  // addEntry
  // ---------------------------------------------------------------------------

  describe("addEntry", () => {
    it("should add a new entry to the history", () => {
      const entry = createMockEntry({ id: "entry-1" });
      useBacktestHistoryStore.getState().addEntry(entry);

      const entries = useBacktestHistoryStore.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe("entry-1");
    });

    it("should add entries in timestamp descending order (newest first)", () => {
      const old = createEntryWithTimestamp(1000, "old");
      const mid = createEntryWithTimestamp(2000, "mid");
      const recent = createEntryWithTimestamp(3000, "recent");

      const store = useBacktestHistoryStore.getState();
      store.addEntry(old);
      store.addEntry(mid);
      store.addEntry(recent);

      const entries = useBacktestHistoryStore.getState().entries;
      expect(entries).toHaveLength(3);
      expect(entries[0]?.id).toBe("recent");
      expect(entries[1]?.id).toBe("mid");
      expect(entries[2]?.id).toBe("old");
    });

    it("should prevent duplicate entries with the same id", () => {
      const entry = createMockEntry({ id: "dup-1" });
      const store = useBacktestHistoryStore.getState();
      store.addEntry(entry);
      store.addEntry({ ...entry, strategyName: "Updated" });

      const entries = useBacktestHistoryStore.getState().entries;
      expect(entries).toHaveLength(1);
      // Latest version should be kept
      expect(entries[0]?.strategyName).toBe("Updated");
    });
  });

  // ---------------------------------------------------------------------------
  // Overflow eviction
  // ---------------------------------------------------------------------------

  describe("overflow eviction", () => {
    it("should evict the oldest entry when exceeding max entries", () => {
      const store = useBacktestHistoryStore.getState();

      // Add MAX_ENTRIES entries
      for (let i = 0; i < MAX_ENTRIES; i++) {
        store.addEntry(createEntryWithTimestamp(i * 1000, `entry-${i}`));
      }

      expect(useBacktestHistoryStore.getState().entries).toHaveLength(
        MAX_ENTRIES
      );

      // Add one more (the 21st)
      store.addEntry(
        createEntryWithTimestamp(MAX_ENTRIES * 1000, "entry-overflow")
      );

      const entries = useBacktestHistoryStore.getState().entries;
      expect(entries).toHaveLength(MAX_ENTRIES);

      // Newest should be first
      expect(entries[0]?.id).toBe("entry-overflow");

      // Oldest (entry-0) should have been evicted
      const hasOldest = entries.some((e) => e.id === "entry-0");
      expect(hasOldest).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // removeEntry
  // ---------------------------------------------------------------------------

  describe("removeEntry", () => {
    it("should remove an entry by id", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "keep" }));
      store.addEntry(createMockEntry({ id: "remove" }));

      store.removeEntry("remove");

      const entries = useBacktestHistoryStore.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe("keep");
    });

    it("should no-op when removing a non-existent id", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "exists" }));

      store.removeEntry("does-not-exist");

      expect(useBacktestHistoryStore.getState().entries).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // clearHistory
  // ---------------------------------------------------------------------------

  describe("clearHistory", () => {
    it("should remove all entries", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "a" }));
      store.addEntry(createMockEntry({ id: "b" }));
      store.addEntry(createMockEntry({ id: "c" }));

      store.clearHistory();

      expect(useBacktestHistoryStore.getState().entries).toHaveLength(0);
    });

    it("should also clear selectedId", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "sel" }));
      store.selectEntry("sel");
      store.clearHistory();

      expect(useBacktestHistoryStore.getState().selectedId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // selectEntry
  // ---------------------------------------------------------------------------

  describe("selectEntry", () => {
    it("should set selectedId", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "target" }));

      store.selectEntry("target");

      expect(useBacktestHistoryStore.getState().selectedId).toBe("target");
    });

    it("should allow deselecting by passing null", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "target" }));
      store.selectEntry("target");
      store.selectEntry(null);

      expect(useBacktestHistoryStore.getState().selectedId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getSelectedEntry
  // ---------------------------------------------------------------------------

  describe("getSelectedEntry", () => {
    it("should return the selected entry object", () => {
      const store = useBacktestHistoryStore.getState();
      const entry = createMockEntry({
        id: "selected-one",
        strategyName: "My Strategy",
      });
      store.addEntry(entry);
      store.selectEntry("selected-one");

      const selected = useBacktestHistoryStore.getState().getSelectedEntry();
      expect(selected).not.toBeNull();
      expect(selected?.strategyName).toBe("My Strategy");
    });

    it("should return null when no entry is selected", () => {
      const selected = useBacktestHistoryStore.getState().getSelectedEntry();
      expect(selected).toBeNull();
    });

    it("should return null when selectedId does not match any entry", () => {
      const store = useBacktestHistoryStore.getState();
      store.addEntry(createMockEntry({ id: "exists" }));
      store.selectEntry("ghost");

      const selected = useBacktestHistoryStore.getState().getSelectedEntry();
      expect(selected).toBeNull();
    });
  });
});
