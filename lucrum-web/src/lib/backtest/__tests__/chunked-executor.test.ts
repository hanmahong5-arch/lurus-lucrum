/**
 * Chunked Executor Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeInChunks } from "../parallel/chunked-executor";
import type { BatchProgress } from "../parallel/types";

async function processItem(item: number): Promise<number> {
  await new Promise((r) => setTimeout(r, 1));
  return item * 2;
}

async function failingProcessor(item: number): Promise<number> {
  await new Promise((r) => setTimeout(r, 1));
  if (item === 3 || item === 7) throw new Error("Item " + item + " failed");
  return item * 2;
}

async function alwaysFailProcessor(): Promise<number> {
  throw new Error("Always fails");
}

describe("executeInChunks", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  describe("correctness", () => {
    it("should process all items and return results in order", async () => {
      const items = [1, 2, 3, 4, 5];
      const result = await executeInChunks(items, processItem);
      expect(result.results).toHaveLength(5);
      expect(result.results[0]).toEqual({ success: true, data: 2 });
      expect(result.results[1]).toEqual({ success: true, data: 4 });
      expect(result.results[2]).toEqual({ success: true, data: 6 });
      expect(result.results[3]).toEqual({ success: true, data: 8 });
      expect(result.results[4]).toEqual({ success: true, data: 10 });
    });

    it("should produce same results regardless of concurrency", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i + 1);
      const r1 = await executeInChunks(items, processItem, { concurrency: 1 });
      const r4 = await executeInChunks(items, processItem, { concurrency: 4 });
      const r10 = await executeInChunks(items, processItem, { concurrency: 10 });
      expect(r1.results).toEqual(r4.results);
      expect(r4.results).toEqual(r10.results);
    });

    it("should report correct summary statistics", async () => {
      const result = await executeInChunks([1, 2, 3, 4, 5], processItem);
      expect(result.summary.total).toBe(5);
      expect(result.summary.succeeded).toBe(5);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.totalTimeMs).toBeGreaterThan(0);
    });
  });

  describe("error isolation", () => {
    it("should not crash batch when individual items fail", async () => {
      const result = await executeInChunks([1, 2, 3, 4, 5, 6, 7, 8], failingProcessor);
      expect(result.summary.total).toBe(8);
      expect(result.summary.failed).toBe(2);
      expect(result.summary.succeeded).toBe(6);
      expect(result.results[0]).toEqual({ success: true, data: 2 });
      expect(result.results[2]).toEqual({ success: false, error: "Item 3 failed" });
      expect(result.results[6]).toEqual({ success: false, error: "Item 7 failed" });
    });

    it("should handle all items failing gracefully", async () => {
      const result = await executeInChunks([1, 2, 3], alwaysFailProcessor);
      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(0);
      expect(result.summary.failed).toBe(3);
      result.results.forEach((r) => expect(r.success).toBe(false));
    });
  });

  describe("progress reporting", () => {
    it("should call onProgress after each item completes", async () => {
      const calls: BatchProgress[] = [];
      await executeInChunks([1, 2, 3, 4, 5], processItem, {
        concurrency: 2,
        onProgress: (p) => calls.push({ ...p }),
      });
      expect(calls).toHaveLength(5);
      const last = calls[calls.length - 1]!;
      expect(last.completed).toBe(5);
      expect(last.total).toBe(5);
      expect(last.failed).toBe(0);
    });

    it("should report failures in progress", async () => {
      const calls: BatchProgress[] = [];
      await executeInChunks([1, 2, 3], failingProcessor, {
        concurrency: 1,
        onProgress: (p) => calls.push({ ...p }),
      });
      const last = calls[calls.length - 1]!;
      expect(last.failed).toBe(1);
    });

    it("should use getItemId for progress currentItem", async () => {
      const calls: BatchProgress[] = [];
      await executeInChunks(
        ["AAPL", "GOOGL", "MSFT"],
        async (item) => item.toUpperCase(),
        {
          concurrency: 1,
          onProgress: (p) => calls.push({ ...p }),
          getItemId: (item) => item as string,
        },
      );
      expect(calls[0]!.currentItem).toBe("AAPL");
      expect(calls[1]!.currentItem).toBe("GOOGL");
      expect(calls[2]!.currentItem).toBe("MSFT");
    });

    it("should include monotonic elapsed time", async () => {
      const calls: BatchProgress[] = [];
      await executeInChunks([1, 2, 3], processItem, {
        concurrency: 1,
        onProgress: (p) => calls.push({ ...p }),
      });
      for (let i = 1; i < calls.length; i++) {
        expect(calls[i]!.elapsedMs).toBeGreaterThanOrEqual(calls[i - 1]!.elapsedMs);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty item list", async () => {
      const result = await executeInChunks([], processItem);
      expect(result.results).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.totalTimeMs).toBe(0);
    });

    it("should handle single item", async () => {
      const result = await executeInChunks([42], processItem);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({ success: true, data: 84 });
    });

    it("should handle concurrency larger than item count", async () => {
      const result = await executeInChunks([1, 2], processItem, { concurrency: 100 });
      expect(result.summary.succeeded).toBe(2);
    });

    it("should clamp concurrency to at least 1", async () => {
      const result = await executeInChunks([1, 2, 3], processItem, { concurrency: 0 });
      expect(result.summary.succeeded).toBe(3);
    });
  });

  describe("cancellation", () => {
    it("should stop processing when signal is aborted", async () => {
      const controller = new AbortController();
      const items = Array.from({ length: 20 }, (_, i) => i);
      let count = 0;
      const slow = async (item: number): Promise<number> => {
        await new Promise((r) => setTimeout(r, 10));
        count++;
        if (count >= 5) controller.abort();
        return item * 2;
      };
      const result = await executeInChunks(items, slow, {
        concurrency: 2,
        signal: controller.signal,
      });
      expect(result.summary.total).toBe(20);
      const cancelled = result.results.filter(
        (r) => !r.success && r.error === "Cancelled",
      ).length;
      expect(cancelled).toBeGreaterThan(0);
    });
  });
});
