/**
 * Worker Pool Tests
 *
 * Tests for BacktestWorkerPool manager.
 * Since Vitest runs in Node.js (no real Web Workers),
 * tests verify pool API contracts and error handling.
 */
import { describe, it, expect } from "vitest";
import { BacktestWorkerPool } from "../workers/worker-pool";
import type { BacktestJob } from "../workers/worker-pool";

describe("BacktestWorkerPool", () => {
  describe("construction", () => {
    it("should create pool with default config", () => {
      const pool = new BacktestWorkerPool();
      expect(pool.getPoolSize()).toBe(4);
      expect(pool.isTerminated()).toBe(false);
      pool.terminate();
    });

    it("should create pool with custom config", () => {
      const pool = new BacktestWorkerPool({ poolSize: 8, jobTimeoutMs: 5000 });
      expect(pool.getPoolSize()).toBe(8);
      pool.terminate();
    });
  });

  describe("terminate", () => {
    it("should mark pool as terminated", () => {
      const pool = new BacktestWorkerPool();
      expect(pool.isTerminated()).toBe(false);
      pool.terminate();
      expect(pool.isTerminated()).toBe(true);
    });

    it("should reject executeBatch after termination", async () => {
      const pool = new BacktestWorkerPool();
      pool.terminate();
      const jobs: BacktestJob[] = [{
        symbol: "600519",
        name: "Test",
        klines: [],
        strategyId: "dual-ma",
        options: { holdingDays: 10 },
      }];
      await expect(pool.executeBatch(jobs)).rejects.toThrow("Worker pool has been terminated");
    });
  });

  describe("executeBatch edge cases", () => {
    it("should return empty array for empty jobs", async () => {
      const pool = new BacktestWorkerPool();
      const results = await pool.executeBatch([]);
      expect(results).toEqual([]);
      pool.terminate();
    });

    it("should throw when no workers can be created (Node.js env)", async () => {
      const pool = new BacktestWorkerPool({ poolSize: 2 });
      const jobs: BacktestJob[] = [{
        symbol: "600519",
        name: "Test",
        klines: [],
        strategyId: "dual-ma",
        options: { holdingDays: 10 },
      }];
      await expect(pool.executeBatch(jobs)).rejects.toThrow();
      pool.terminate();
    });
  });
});
