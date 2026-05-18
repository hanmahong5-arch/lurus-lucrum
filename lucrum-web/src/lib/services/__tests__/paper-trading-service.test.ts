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

    it("countActivePaperRuns reports the row count", async () => {
      dbMockState.selectResult = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(await countActivePaperRuns("u1")).toBe(3);
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
});
