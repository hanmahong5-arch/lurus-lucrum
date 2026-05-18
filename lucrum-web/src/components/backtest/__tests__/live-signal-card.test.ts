/**
 * Unit tests for computeSignalState — the pure function that drives
 * LiveSignalCard's three states ("long" / "flat" / "no-trades").
 *
 * Test design from two perspectives:
 *   USER (just finished a backtest): "Tell me what I should be holding
 *     right now, and don't lie if the strategy never traded."
 *   ADVERSARIAL TESTER: "What if the trade log is empty / only sells /
 *     has fractional sizes / has the sells exceed buys / has zero qty /
 *     has out-of-order timestamps?"
 *
 * @module components/backtest/__tests__/live-signal-card
 */
import { describe, expect, it } from "vitest";
import { computeSignalState } from "../live-signal-card";
import type { BacktestResult, BacktestTrade } from "@/lib/backtest/types";

// ---------------------------------------------------------------------------
// Fixture builders — keep tests terse + clearly intentional.
// ---------------------------------------------------------------------------

function trade(overrides: Partial<BacktestTrade>): BacktestTrade {
  return {
    id: overrides.id ?? "t1",
    type: overrides.type ?? "buy",
    price: overrides.price ?? 100,
    size: overrides.size ?? 10,
    timestamp: overrides.timestamp ?? 1700000000000,
    reason: overrides.reason ?? "test",
    ...overrides,
  };
}

function backtestResult(trades: BacktestTrade[]): BacktestResult {
  // computeSignalState only reads `trades` + `equityCurve` + `backtestMeta`
  // + `config.symbol`. Other fields are cast through unknown to dodge the
  // exhaustive BacktestResult shape that legacy metric fields demand.
  return {
    totalTrades: trades.length,
    equityCurve: [],
    trades,
  } as unknown as BacktestResult;
}

// ---------------------------------------------------------------------------
// USER scenarios
// ---------------------------------------------------------------------------

describe("computeSignalState — user-facing states", () => {
  it('strategy never traded → "no-trades"', () => {
    const state = computeSignalState(backtestResult([]));
    expect(state.kind).toBe("no-trades");
    expect(state.netSize).toBe(0);
    expect(state.lastTrade).toBeUndefined();
  });

  it('single buy and no exit → "long" with entry price + net qty', () => {
    const state = computeSignalState(
      backtestResult([trade({ type: "buy", price: 100, size: 10 })]),
    );
    expect(state.kind).toBe("long");
    expect(state.netSize).toBe(10);
    expect(state.entryPrice).toBeCloseTo(100, 6);
  });

  it('buy + sell of equal size → "flat" with last trade = sell', () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "s", type: "sell", price: 110, size: 10, timestamp: 2 }),
      ]),
    );
    expect(state.kind).toBe("flat");
    expect(state.lastTrade?.type).toBe("sell");
    expect(state.lastTrade?.price).toBe(110);
  });

  it('two buys + zero sells → "long" with average cost basis', () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b1", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "b2", type: "buy", price: 200, size: 10, timestamp: 2 }),
      ]),
    );
    expect(state.kind).toBe("long");
    expect(state.netSize).toBe(20);
    // Weighted avg of (100*10 + 200*10) / 20 = 150
    expect(state.entryPrice).toBeCloseTo(150, 6);
  });

  it('buy + partial sell → still "long" but with reduced size', () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "s", type: "sell", price: 110, size: 4, timestamp: 2 }),
      ]),
    );
    expect(state.kind).toBe("long");
    expect(state.netSize).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// ADVERSARIAL / edge-case scenarios
// ---------------------------------------------------------------------------

describe("computeSignalState — edge cases", () => {
  it('cycles buy → sell → buy → "long" again with fresh cost basis', () => {
    // Net=0 after first round-trip resets entryCost; second buy starts a
    // new position whose cost basis should be 105, not amortised against
    // the closed-out first round.
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b1", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "s1", type: "sell", price: 110, size: 10, timestamp: 2 }),
        trade({ id: "b2", type: "buy", price: 105, size: 5, timestamp: 3 }),
      ]),
    );
    expect(state.kind).toBe("long");
    expect(state.netSize).toBe(5);
    expect(state.entryPrice).toBeCloseTo(105, 6);
  });

  it('over-sell (sell qty > buy qty) → "flat" without negative netSize', () => {
    // Data corruption / engine bug. We must not surface "short -5 shares"
    // because the rest of the system has no short-position UI today.
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "s", type: "sell", price: 110, size: 15, timestamp: 2 }),
      ]),
    );
    expect(state.kind).toBe("flat");
    expect(state.netSize).toBeGreaterThanOrEqual(0);
  });

  it("first-bar sell (no prior buy) is treated as flat, not crash", () => {
    const state = computeSignalState(
      backtestResult([trade({ id: "s", type: "sell", price: 110, size: 10 })]),
    );
    expect(state.kind).toBe("flat");
  });

  it("zero-size trade does not corrupt cost basis", () => {
    // Drizzle/vnpy can emit zero-size fills on the edge of lot-size rounding.
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b1", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "b0", type: "buy", price: 999, size: 0, timestamp: 2 }),
      ]),
    );
    expect(state.kind).toBe("long");
    expect(state.netSize).toBe(10);
    // The zero-size buy adds 999*0=0 to cost, so avg stays 100.
    expect(state.entryPrice).toBeCloseTo(100, 6);
  });

  it("computes unrealized P&L percent from avg entry vs last trade price", () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b", type: "buy", price: 100, size: 10, timestamp: 1 }),
      ]),
    );
    expect(state.kind).toBe("long");
    // Single trade: avg entry = 100, last trade price = 100 → 0%
    expect(state.unrealizedPnlPct).toBeCloseTo(0, 6);
  });

  it("unrealized P&L positive when later trade lifts avg cost less than mark", () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "b1", type: "buy", price: 100, size: 10, timestamp: 1 }),
        trade({ id: "b2", type: "buy", price: 120, size: 10, timestamp: 2 }),
      ]),
    );
    // avg=110, last=120 → +9.09%
    expect(state.kind).toBe("long");
    expect(state.unrealizedPnlPct).toBeCloseTo(9.0909, 2);
  });

  it("does not throw on trade with NaN price (treats as 0 contribution)", () => {
    // The service must be resilient — a single bad row in the backtest log
    // shouldn't take the LiveSignalCard down.
    expect(() =>
      computeSignalState(
        backtestResult([
          trade({ id: "b1", type: "buy", price: Number.NaN, size: 10 }),
        ]),
      ),
    ).not.toThrow();
  });

  it("lastTrade always reflects the LAST trade in the array (caller is responsible for ordering)", () => {
    const state = computeSignalState(
      backtestResult([
        trade({ id: "first", type: "buy", price: 100, size: 10 }),
        trade({ id: "middle", type: "sell", price: 105, size: 5 }),
        trade({ id: "last", type: "buy", price: 110, size: 5 }),
      ]),
    );
    expect(state.lastTrade?.id).toBe("last");
  });

  it("undefined trades array (legacy result shape) → safely treated as no-trades", () => {
    const result = backtestResult([]);
    // The function uses `result.trades ?? []` for safety.
    (result as { trades?: unknown }).trades = undefined;
    const state = computeSignalState(result);
    expect(state.kind).toBe("no-trades");
  });
});
