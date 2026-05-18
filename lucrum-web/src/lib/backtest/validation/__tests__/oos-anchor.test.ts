import { describe, expect, it } from "vitest";
import {
  MIN_OOS_DAYS_FOR_VETTED,
  daysSinceAnchor,
  splitIsOos,
  vettingStatus,
} from "../oos-anchor";

describe("oos-anchor", () => {
  describe("splitIsOos", () => {
    it("partitions records by the anchor timestamp (records ≥ anchor are OOS)", () => {
      const rows = [
        { id: 1, ts: "2026-01-01" },
        { id: 2, ts: "2026-03-15" }, // exactly anchor → OOS
        { id: 3, ts: "2026-06-01" },
      ];
      const { inSample, outOfSample } = splitIsOos(
        rows,
        new Date("2026-03-15"),
        (r) => r.ts,
      );
      expect(inSample.map((r) => r.id)).toEqual([1]);
      expect(outOfSample.map((r) => r.id)).toEqual([2, 3]);
    });

    it("preserves stable order within each bucket", () => {
      const rows = [
        { id: 1, ts: "2026-06-01" }, // OOS
        { id: 2, ts: "2026-01-01" }, // IS
        { id: 3, ts: "2026-05-01" }, // OOS
        { id: 4, ts: "2026-02-01" }, // IS
      ];
      const { inSample, outOfSample } = splitIsOos(
        rows,
        new Date("2026-03-01"),
        (r) => r.ts,
      );
      expect(inSample.map((r) => r.id)).toEqual([2, 4]);
      expect(outOfSample.map((r) => r.id)).toEqual([1, 3]);
    });

    it("skips records with invalid dates rather than mis-bucketing", () => {
      const rows = [
        { id: 1, ts: "not-a-date" },
        { id: 2, ts: "2026-06-01" },
      ];
      const { inSample, outOfSample } = splitIsOos(
        rows,
        new Date("2026-03-01"),
        (r) => r.ts,
      );
      expect(inSample).toEqual([]);
      expect(outOfSample.map((r) => r.id)).toEqual([2]);
    });

    it("accepts Date objects directly", () => {
      const rows = [
        { id: 1, d: new Date("2026-01-01") },
        { id: 2, d: new Date("2026-06-01") },
      ];
      const { inSample, outOfSample } = splitIsOos(
        rows,
        new Date("2026-03-01"),
        (r) => r.d,
      );
      expect(inSample.map((r) => r.id)).toEqual([1]);
      expect(outOfSample.map((r) => r.id)).toEqual([2]);
    });
  });

  describe("daysSinceAnchor", () => {
    it("returns whole days elapsed", () => {
      const now = new Date("2026-04-10T12:00:00Z");
      expect(daysSinceAnchor("2026-04-01T12:00:00Z", now)).toBe(9);
    });

    it("clamps to 0 for future anchors", () => {
      const now = new Date("2026-04-10");
      expect(daysSinceAnchor("2026-12-01", now)).toBe(0);
    });

    it("returns 0 for invalid anchors", () => {
      expect(daysSinceAnchor("not-a-date")).toBe(0);
    });
  });

  describe("vettingStatus", () => {
    const now = new Date("2026-06-01T00:00:00Z");

    it("returns unknown when no anchor", () => {
      expect(vettingStatus(null, now)).toBe("unknown");
      expect(vettingStatus(undefined, now)).toBe("unknown");
    });

    it("returns immature when < MIN_OOS_DAYS_FOR_VETTED days since publish", () => {
      const oneMonthAgo = new Date("2026-05-01");
      expect(vettingStatus(oneMonthAgo, now)).toBe("immature");
    });

    it("returns vetted at the boundary day", () => {
      const exactly = new Date(now.getTime() - MIN_OOS_DAYS_FOR_VETTED * 86_400_000);
      expect(vettingStatus(exactly, now)).toBe("vetted");
    });

    it("returns vetted when > MIN_OOS_DAYS_FOR_VETTED days since publish", () => {
      const sixMonthsAgo = new Date("2025-11-01");
      expect(vettingStatus(sixMonthsAgo, now)).toBe("vetted");
    });
  });
});
