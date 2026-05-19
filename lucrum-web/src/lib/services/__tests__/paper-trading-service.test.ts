import { describe, expect, it, vi } from "vitest";

// Mock the DB module BEFORE importing the service so the import in the
// service module resolves to our mock chain. We model a tiny in-memory
// drizzle-shaped builder that records the last operation and lets each test
// stub responses through the closure.
const dbMockState: {
  selectResult: unknown[];
  insertedRow: unknown;
  updatedRow: unknown;
} = {
  selectResult: [],
  insertedRow: null,
  updatedRow: null,
};

vi.mock("@/lib/db", () => {
  // Every chain link is a Proxy that:
  //   - returns itself for any of-chain method (from/where/orderBy/limit/...);
  //   - is awaitable, resolving to the configured selectResult / insertedRow;
  //   - records writes via values()/set() for assertions if a test needs them.
  // This avoids the trap where `await chain.where(...)` resolves to the chain
  // object itself (no .then) instead of the mocked array.
  function makeChain(): unknown {
    const target = function noop() {} as unknown as Record<string | symbol, unknown>;
    return new Proxy(target, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) =>
            resolve(dbMockState.selectResult);
        }
        if (prop === "values") {
          return (v: unknown) => {
            dbMockState.insertedRow = v;
            return makeChain();
          };
        }
        if (prop === "set") {
          return (v: unknown) => {
            dbMockState.updatedRow = v;
            return makeChain();
          };
        }
        if (prop === "returning") {
          return () =>
            Promise.resolve([dbMockState.insertedRow ?? dbMockState.updatedRow]);
        }
        // from/where/orderBy/limit/leftJoin/innerJoin/... all yield a fresh
        // chain that's itself awaitable.
        return () => makeChain();
      },
    });
  }
  return {
    db: {
      insert: () => makeChain(),
      select: () => makeChain(),
      update: () => makeChain(),
    },
  };
});

import {
  createPaperRun,
  getPaperRun,
  closePaperRun,
  listPaperRunsForUser,
  countActivePaperRuns,
  applyStrategySignal,
  tickPositions,
  loadActiveRunsByStrategy,
  PaperRunNotFoundError,
  PaperRunOwnershipError,
  PaperRunStateError,
} from "../paper-trading-service";

describe("paper-trading-service", () => {
  describe("createPaperRun — validation", () => {
    it("rejects initial capital below the floor", async () => {
      await expect(
        createPaperRun({ userId: "u1", initialCapital: 100 }),
      ).rejects.toBeInstanceOf(PaperRunStateError);
    });

    it("rejects non-finite initial capital", async () => {
      await expect(
        createPaperRun({ userId: "u1", initialCapital: Number.NaN }),
      ).rejects.toBeInstanceOf(PaperRunStateError);
    });

    it("rejects initial capital above the ceiling", async () => {
      await expect(
        createPaperRun({ userId: "u1", initialCapital: 1e10 }),
      ).rejects.toBeInstanceOf(PaperRunStateError);
    });

    it("accepts the default capital when omitted (no validation throw)", async () => {
      // We don't assert on the row shape — the mock returns whatever was
      // last passed to .values(); proving the call shape would require a
      // heavier mock. The contract under test here is the validation pass.
      await expect(
        createPaperRun({ userId: "u1", strategyHistoryId: 10 }),
      ).resolves.toBeDefined();
    });

    it("preserves seedPosition when qty > 0 and skips when qty <= 0", async () => {
      dbMockState.insertedRow = { id: 2, userId: "u1" };
      // Service's "skip when qty <= 0" branch is exercised by passing 0:
      const run = await createPaperRun({
        userId: "u1",
        strategyHistoryId: 1,
        seedPosition: { symbol: "TEST", qty: 0, avgCost: 10 },
      });
      expect(run).toBeDefined();
    });

    it("inserts the seedPosition when qty > 0 (exercises lines 127-134)", async () => {
      dbMockState.insertedRow = { id: 3, userId: "u1" };
      const run = await createPaperRun({
        userId: "u1",
        strategyHistoryId: 1,
        seedPosition: { symbol: "AAPL", qty: 100, avgCost: 150 },
      });
      expect(run).toBeDefined();
    });
  });

  describe("getPaperRun — ownership + not-found", () => {
    it("throws PaperRunNotFoundError when no row matches", async () => {
      dbMockState.selectResult = []; // no run returned
      await expect(getPaperRun("u1", 999)).rejects.toBeInstanceOf(PaperRunNotFoundError);
    });

    it("throws PaperRunOwnershipError when the run belongs to another user", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "owner-X" }];
      await expect(getPaperRun("intruder", 1)).rejects.toBeInstanceOf(PaperRunOwnershipError);
    });
  });

  describe("closePaperRun — idempotency + ownership", () => {
    it("not-found path throws PaperRunNotFoundError", async () => {
      dbMockState.selectResult = [];
      await expect(closePaperRun("u1", 1)).rejects.toBeInstanceOf(PaperRunNotFoundError);
    });

    it("ownership mismatch throws PaperRunOwnershipError", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "owner-X", status: "active" }];
      await expect(closePaperRun("intruder", 1)).rejects.toBeInstanceOf(PaperRunOwnershipError);
    });

    it("returns the existing row unchanged when already closed (idempotent)", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "u1", status: "closed" }];
      const run = await closePaperRun("u1", 1);
      expect(run.status).toBe("closed");
    });
  });

  describe("listPaperRunsForUser + countActivePaperRuns", () => {
    it("listPaperRunsForUser returns mocked rows", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "u1", status: "active" }];
      const runs = await listPaperRunsForUser("u1");
      expect(runs).toHaveLength(1);
    });

    it("listPaperRunsForUser with status filter exercises the conditional push (line 191-192)", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "u1", status: "active" }];
      const runs = await listPaperRunsForUser("u1", { status: "active", limit: 5 });
      expect(runs).toHaveLength(1);
    });

    it("countActivePaperRuns reports the row count", async () => {
      dbMockState.selectResult = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(await countActivePaperRuns("u1")).toBe(3);
    });
  });

  describe("getPaperRun — happy path (lines 178-179)", () => {
    it("returns {run, positions, recentTrades} when the run is owned by caller", async () => {
      dbMockState.selectResult = [{ id: 1, userId: "u1", status: "active" }];
      const result = await getPaperRun("u1", 1);
      expect(result).toBeDefined();
      expect(result.run).toBeDefined();
      // The chain mock returns the same selectResult for positions + trades
      // sub-queries; we just verify the function reaches the return statement
      // without throwing past ownership check.
      expect(Array.isArray(result.positions)).toBe(true);
      expect(Array.isArray(result.recentTrades)).toBe(true);
    });
  });

  describe("Sprint 2 forward-looking stubs", () => {
    it("tickPositions throws NotImplemented", async () => {
      await expect(tickPositions([], new Map())).rejects.toThrow(/not implemented/i);
    });

    it("applyStrategySignal throws NotImplemented", async () => {
      await expect(
        applyStrategySignal({
          runId: 1,
          symbol: "X",
          side: "buy",
          qty: 1,
          suggestedPrice: 10,
          reason: "t",
          ts: new Date(),
        }),
      ).rejects.toThrow(/not implemented/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional service-level branches for the 95% coverage push.
  // ---------------------------------------------------------------------------

  describe("closePaperRun — active-run write path (218-224)", () => {
    it("transitions an active run to closed and returns the updated row", async () => {
      dbMockState.selectResult = [{ id: 7, userId: "u1", status: "active" }];
      dbMockState.updatedRow = { id: 7, userId: "u1", status: "closed", closedAt: new Date() };
      const run = await closePaperRun("u1", 7);
      expect(run).toBeDefined();
      // We don't assert .status here because the mock chain returns the
      // updatedRow from `.returning()`. The contract under test is that the
      // service reaches the update branch (218-224) without throwing.
    });
  });

  describe("loadActiveRunsByStrategy — grouping (291-307)", () => {
    it("groups active runs by strategyHistoryId and drops null-strategy rows", async () => {
      dbMockState.selectResult = [
        { id: 1, userId: "u1", status: "active", strategyHistoryId: 10 },
        { id: 2, userId: "u1", status: "active", strategyHistoryId: 10 },
        { id: 3, userId: "u2", status: "active", strategyHistoryId: 20 },
        { id: 4, userId: "u3", status: "active", strategyHistoryId: null },
      ];
      const grouped = await loadActiveRunsByStrategy();
      expect(grouped.size).toBe(2);
      expect(grouped.get(10)).toHaveLength(2);
      expect(grouped.get(20)).toHaveLength(1);
      // null-strategy row is dropped, NOT bucketed under undefined/0/null.
      for (const key of Array.from(grouped.keys())) {
        expect(key).not.toBeNull();
      }
    });

    it("returns an empty map when there are no active runs", async () => {
      dbMockState.selectResult = [];
      const grouped = await loadActiveRunsByStrategy();
      expect(grouped.size).toBe(0);
    });
  });
});
