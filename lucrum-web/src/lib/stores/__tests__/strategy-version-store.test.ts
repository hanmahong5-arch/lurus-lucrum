/**
 * Strategy Version Store Tests
 *
 * Tests:
 * - Add version to history
 * - Overflow eviction (max 20 versions per strategy)
 * - Get versions for a specific strategy
 * - Get single version by ID
 * - Restore version (returns code + params)
 * - Clear history for a strategy
 * - Clear all history
 * - Versions sorted by createdAt descending
 * - Get latest version
 *
 * @module lib/stores/__tests__/strategy-version-store.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useStrategyVersionStore,
  type StrategyVersionEntry,
} from "../strategy-version-store";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const STRATEGY_ID = "strategy-001";
const MAX_VERSIONS_PER_STRATEGY = 20;

function createMockVersion(
  overrides?: Partial<StrategyVersionEntry>
): StrategyVersionEntry {
  const id = overrides?.versionId ?? `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  return {
    versionId: id,
    strategyId: STRATEGY_ID,
    code: "class TestStrategy(CtaTemplate):\n    pass",
    params: { period: 9, stop_loss: 0.03 },
    description: "Test version",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createVersionWithTimestamp(
  ts: number,
  strategyId?: string
): StrategyVersionEntry {
  return createMockVersion({
    versionId: `ver-${ts}`,
    strategyId: strategyId ?? STRATEGY_ID,
    createdAt: ts,
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe("StrategyVersionStore", () => {
  beforeEach(() => {
    useStrategyVersionStore.getState().clearAll();
  });

  // ---------------------------------------------------------------------------
  // addVersion
  // ---------------------------------------------------------------------------

  describe("addVersion", () => {
    it("should add a version to the store", () => {
      const version = createMockVersion();
      useStrategyVersionStore.getState().addVersion(version);

      const versions = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy(STRATEGY_ID);
      expect(versions).toHaveLength(1);
      expect(versions[0]!.versionId).toBe(version.versionId);
    });

    it("should maintain versions sorted by createdAt descending", () => {
      const v1 = createVersionWithTimestamp(1000);
      const v2 = createVersionWithTimestamp(3000);
      const v3 = createVersionWithTimestamp(2000);

      const store = useStrategyVersionStore.getState();
      store.addVersion(v1);
      store.addVersion(v2);
      store.addVersion(v3);

      const versions = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy(STRATEGY_ID);
      expect(versions[0]!.createdAt).toBe(3000);
      expect(versions[1]!.createdAt).toBe(2000);
      expect(versions[2]!.createdAt).toBe(1000);
    });

    it("should evict oldest version when exceeding max", () => {
      const store = useStrategyVersionStore.getState();

      // Add MAX + 1 versions
      for (let i = 0; i < MAX_VERSIONS_PER_STRATEGY + 1; i++) {
        store.addVersion(createVersionWithTimestamp(i * 1000));
      }

      const versions = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy(STRATEGY_ID);
      expect(versions).toHaveLength(MAX_VERSIONS_PER_STRATEGY);

      // The oldest (timestamp 0) should be evicted
      const hasOldest = versions.some((v) => v.createdAt === 0);
      expect(hasOldest).toBe(false);
    });

    it("should isolate versions by strategyId", () => {
      const store = useStrategyVersionStore.getState();
      store.addVersion(createVersionWithTimestamp(1000, "strat-A"));
      store.addVersion(createVersionWithTimestamp(2000, "strat-B"));

      const versionsA = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-A");
      const versionsB = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-B");

      expect(versionsA).toHaveLength(1);
      expect(versionsB).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getVersionById
  // ---------------------------------------------------------------------------

  describe("getVersionById", () => {
    it("should return version by ID", () => {
      const version = createMockVersion({ versionId: "target-id" });
      useStrategyVersionStore.getState().addVersion(version);

      const found = useStrategyVersionStore
        .getState()
        .getVersionById("target-id");
      expect(found).toBeDefined();
      expect(found!.versionId).toBe("target-id");
    });

    it("should return undefined for non-existent ID", () => {
      const found = useStrategyVersionStore
        .getState()
        .getVersionById("non-existent");
      expect(found).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getLatestVersion
  // ---------------------------------------------------------------------------

  describe("getLatestVersion", () => {
    it("should return the most recent version for a strategy", () => {
      const store = useStrategyVersionStore.getState();
      store.addVersion(createVersionWithTimestamp(1000));
      store.addVersion(createVersionWithTimestamp(3000));
      store.addVersion(createVersionWithTimestamp(2000));

      const latest = useStrategyVersionStore
        .getState()
        .getLatestVersion(STRATEGY_ID);
      expect(latest).toBeDefined();
      expect(latest!.createdAt).toBe(3000);
    });

    it("should return undefined if no versions exist", () => {
      const latest = useStrategyVersionStore
        .getState()
        .getLatestVersion("non-existent");
      expect(latest).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // clearStrategyVersions
  // ---------------------------------------------------------------------------

  describe("clearStrategyVersions", () => {
    it("should remove all versions for a specific strategy", () => {
      const store = useStrategyVersionStore.getState();
      store.addVersion(createVersionWithTimestamp(1000, "strat-A"));
      store.addVersion(createVersionWithTimestamp(2000, "strat-A"));
      store.addVersion(createVersionWithTimestamp(3000, "strat-B"));

      useStrategyVersionStore.getState().clearStrategyVersions("strat-A");

      const versionsA = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-A");
      const versionsB = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-B");

      expect(versionsA).toHaveLength(0);
      expect(versionsB).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // clearAll
  // ---------------------------------------------------------------------------

  describe("clearAll", () => {
    it("should remove all versions across all strategies", () => {
      const store = useStrategyVersionStore.getState();
      store.addVersion(createVersionWithTimestamp(1000, "strat-A"));
      store.addVersion(createVersionWithTimestamp(2000, "strat-B"));

      useStrategyVersionStore.getState().clearAll();

      const versionsA = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-A");
      const versionsB = useStrategyVersionStore
        .getState()
        .getVersionsForStrategy("strat-B");

      expect(versionsA).toHaveLength(0);
      expect(versionsB).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getVersionCount
  // ---------------------------------------------------------------------------

  describe("getVersionCount", () => {
    it("should return correct count for a strategy", () => {
      const store = useStrategyVersionStore.getState();
      store.addVersion(createVersionWithTimestamp(1000));
      store.addVersion(createVersionWithTimestamp(2000));
      store.addVersion(createVersionWithTimestamp(3000));

      const count = useStrategyVersionStore
        .getState()
        .getVersionCount(STRATEGY_ID);
      expect(count).toBe(3);
    });

    it("should return 0 for non-existent strategy", () => {
      const count = useStrategyVersionStore
        .getState()
        .getVersionCount("non-existent");
      expect(count).toBe(0);
    });
  });
});
