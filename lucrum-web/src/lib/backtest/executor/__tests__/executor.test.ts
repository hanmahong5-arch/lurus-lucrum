import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BacktestCancelledError,
  LocalBacktestExecutor,
  NotImplementedError,
  RemoteBacktestExecutor,
  REMOTE_RUN_SUBJECT_PREFIX,
  REMOTE_STREAM_NAME,
  getBacktestExecutor,
  resetExecutorCache,
} from "../index";

// Mock the engine — we're testing the executor contract, not the math.
vi.mock("@/lib/backtest/engine", () => ({
  runBacktest: vi.fn(async () => ({
    totalReturn: 12.3,
    annualizedReturn: 8.4,
    maxDrawdown: -5.6,
    sharpeRatio: 1.1,
    sortinoRatio: 1.3,
    winRate: 0.55,
    totalTrades: 10,
    finalCapital: 112_300,
    peakCapital: 115_000,
    troughCapital: 94_400,
    avgHoldingPeriod: 4,
    maxSingleWin: 2_000,
    maxSingleLoss: -1_500,
    equityCurve: [],
    trades: [],
    config: { symbol: "TEST", startDate: "2026-01-01", endDate: "2026-01-31" },
    strategy: { params: {} },
    executionTime: 1,
  })),
}));

const SAMPLE_INPUT = {
  strategyCode: "class X: pass",
  klines: [],
  config: {
    symbol: "TEST",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    initialCapital: 100_000,
  } as unknown as Parameters<LocalBacktestExecutor["run"]>[0]["config"],
};

describe("LocalBacktestExecutor", () => {
  const exec = new LocalBacktestExecutor();

  it("identifies itself as 'local'", () => {
    expect(exec.name).toBe("local");
  });

  it("runs and returns result + meta with a runId", async () => {
    const { result, meta } = await exec.run(SAMPLE_INPUT);
    expect(result.totalReturn).toBe(12.3);
    expect(meta.executorName).toBe("local");
    expect(meta.runId).toMatch(/.+/);
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("echoes the supplied runId rather than generating one", async () => {
    const { meta } = await exec.run({ ...SAMPLE_INPUT, runId: "custom-123" });
    expect(meta.runId).toBe("custom-123");
  });

  it("throws BacktestCancelledError when the signal aborts before run", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      exec.run({ ...SAMPLE_INPUT, signal: controller.signal, runId: "abc" }),
    ).rejects.toBeInstanceOf(BacktestCancelledError);
  });

  it("isHealthy always returns true", async () => {
    expect(await exec.isHealthy()).toBe(true);
  });

  it("cancel is a no-op (resolves)", async () => {
    await expect(exec.cancel("any")).resolves.toBeUndefined();
  });
});

describe("RemoteBacktestExecutor (stub)", () => {
  const exec = new RemoteBacktestExecutor();

  it("identifies itself as 'remote-nats'", () => {
    expect(exec.name).toBe("remote-nats");
  });

  it("run() throws NotImplementedError", async () => {
    await expect(exec.run(SAMPLE_INPUT)).rejects.toBeInstanceOf(NotImplementedError);
  });

  it("cancel() throws NotImplementedError", async () => {
    await expect(exec.cancel("x")).rejects.toBeInstanceOf(NotImplementedError);
  });

  it("isHealthy returns false (forces factory to fall back)", async () => {
    expect(await exec.isHealthy()).toBe(false);
  });

  it("exports the NATS subject + stream contract constants", () => {
    expect(REMOTE_RUN_SUBJECT_PREFIX).toBe("backtest.run.");
    expect(REMOTE_STREAM_NAME).toBe("LUCRUM_BACKTEST");
  });
});

describe("getBacktestExecutor factory", () => {
  const originalEnv = process.env.LUCRUM_BACKTEST_EXECUTOR;

  beforeEach(() => {
    resetExecutorCache();
  });
  afterEach(() => {
    process.env.LUCRUM_BACKTEST_EXECUTOR = originalEnv;
    resetExecutorCache();
  });

  it("defaults to LocalBacktestExecutor when env is unset", () => {
    delete process.env.LUCRUM_BACKTEST_EXECUTOR;
    expect(getBacktestExecutor().name).toBe("local");
  });

  it("returns RemoteBacktestExecutor when env=remote", () => {
    process.env.LUCRUM_BACKTEST_EXECUTOR = "remote";
    expect(getBacktestExecutor().name).toBe("remote-nats");
  });

  it("is case-insensitive on env value", () => {
    process.env.LUCRUM_BACKTEST_EXECUTOR = "REMOTE";
    expect(getBacktestExecutor().name).toBe("remote-nats");
  });

  it("falls back to local on any other env value", () => {
    process.env.LUCRUM_BACKTEST_EXECUTOR = "bogus";
    expect(getBacktestExecutor().name).toBe("local");
  });

  it("caches the instance across calls", () => {
    delete process.env.LUCRUM_BACKTEST_EXECUTOR;
    const a = getBacktestExecutor();
    const b = getBacktestExecutor();
    expect(a).toBe(b);
  });
});
