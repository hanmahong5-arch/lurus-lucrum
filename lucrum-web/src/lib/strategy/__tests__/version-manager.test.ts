/**
 * Strategy Version Manager Tests
 *
 * Tests:
 * - Version creation from code/params snapshots
 * - Auto-description generation from parameter diffs
 * - Version diff computation between two versions
 * - Version restore (extract code + params from a version)
 * - Version ID uniqueness
 * - Edge cases: empty params, identical versions, large code
 *
 * @module lib/strategy/__tests__/version-manager.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createVersion,
  generateVersionDescription,
  computeVersionDiff,
  type StrategyVersion,
  type VersionDiff,
} from "../version-manager";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const STRATEGY_ID = "test-strategy-001";

const BASE_CODE = `
class KDJStrategy(CtaTemplate):
    kdj_period = 9
    slow_period = 3
    stop_loss = 0.03
`;

const MODIFIED_CODE = `
class KDJStrategy(CtaTemplate):
    kdj_period = 14
    slow_period = 5
    stop_loss = 0.05
`;

const BASE_PARAMS: Record<string, unknown> = {
  kdj_period: 9,
  slow_period: 3,
  stop_loss: 0.03,
  position_ratio: 0.5,
};

const MODIFIED_PARAMS: Record<string, unknown> = {
  kdj_period: 14,
  slow_period: 5,
  stop_loss: 0.05,
  position_ratio: 0.5,
};

// =============================================================================
// createVersion TESTS
// =============================================================================

describe("createVersion", () => {
  it("should create a version with unique ID", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);

    expect(v1.versionId).toBeTruthy();
    expect(v2.versionId).toBeTruthy();
    expect(v1.versionId).not.toBe(v2.versionId);
  });

  it("should store strategy ID correctly", () => {
    const version = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    expect(version.strategyId).toBe(STRATEGY_ID);
  });

  it("should store code snapshot", () => {
    const version = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    expect(version.code).toBe(BASE_CODE);
  });

  it("should store params as deep copy", () => {
    const params = { ...BASE_PARAMS };
    const version = createVersion(STRATEGY_ID, BASE_CODE, params);

    // Mutating original should not affect version
    params.kdj_period = 999;
    expect(version.params.kdj_period).toBe(9);
  });

  it("should set createdAt to current timestamp", () => {
    const before = Date.now();
    const version = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const after = Date.now();

    expect(version.createdAt).toBeGreaterThanOrEqual(before);
    expect(version.createdAt).toBeLessThanOrEqual(after);
  });

  it("should accept optional score", () => {
    const score = { grade: "A" as const, score: 78 };
    const version = createVersion(
      STRATEGY_ID,
      BASE_CODE,
      BASE_PARAMS,
      undefined,
      score
    );
    expect(version.score).toEqual(score);
  });

  it("should accept optional description override", () => {
    const version = createVersion(
      STRATEGY_ID,
      BASE_CODE,
      BASE_PARAMS,
      "Manual description"
    );
    expect(version.description).toBe("Manual description");
  });

  it("should handle empty params", () => {
    const version = createVersion(STRATEGY_ID, BASE_CODE, {});
    expect(version.params).toEqual({});
  });

  it("should handle empty code", () => {
    const version = createVersion(STRATEGY_ID, "", BASE_PARAMS);
    expect(version.code).toBe("");
  });
});

// =============================================================================
// generateVersionDescription TESTS
// =============================================================================

describe("generateVersionDescription", () => {
  it("should describe parameter changes", () => {
    const desc = generateVersionDescription(BASE_PARAMS, MODIFIED_PARAMS);

    expect(desc).toContain("kdj_period");
    expect(desc).toContain("9");
    expect(desc).toContain("14");
  });

  it("should handle single parameter change", () => {
    const oldParams = { stop_loss: 0.03, position_ratio: 0.5 };
    const newParams = { stop_loss: 0.05, position_ratio: 0.5 };

    const desc = generateVersionDescription(oldParams, newParams);
    expect(desc).toContain("stop_loss");
    expect(desc).toContain("0.03");
    expect(desc).toContain("0.05");
  });

  it("should indicate added parameters", () => {
    const oldParams = { a: 1 };
    const newParams = { a: 1, b: 2 };

    const desc = generateVersionDescription(oldParams, newParams);
    expect(desc).toContain("b");
  });

  it("should indicate removed parameters", () => {
    const oldParams = { a: 1, b: 2 };
    const newParams = { a: 1 };

    const desc = generateVersionDescription(oldParams, newParams);
    expect(desc).toContain("b");
  });

  it("should return initial version description when no previous params", () => {
    const desc = generateVersionDescription(null, BASE_PARAMS);
    expect(desc.length).toBeGreaterThan(0);
  });

  it("should return no-change description for identical params", () => {
    const desc = generateVersionDescription(BASE_PARAMS, BASE_PARAMS);
    expect(desc.length).toBeGreaterThan(0);
  });

  it("should handle empty old and new params", () => {
    const desc = generateVersionDescription({}, {});
    expect(desc.length).toBeGreaterThan(0);
  });

  it("should truncate description when many params change", () => {
    const oldParams: Record<string, unknown> = {};
    const newParams: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      oldParams[`param_${i}`] = i;
      newParams[`param_${i}`] = i + 100;
    }

    const desc = generateVersionDescription(oldParams, newParams);
    // Should not be excessively long
    expect(desc.length).toBeLessThanOrEqual(500);
  });
});

// =============================================================================
// computeVersionDiff TESTS
// =============================================================================

describe("computeVersionDiff", () => {
  it("should detect code changes", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const v2 = createVersion(STRATEGY_ID, MODIFIED_CODE, MODIFIED_PARAMS);

    const diff = computeVersionDiff(v1, v2);
    expect(diff.hasCodeChanges).toBe(true);
  });

  it("should detect parameter changes", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, MODIFIED_PARAMS);

    const diff = computeVersionDiff(v1, v2);
    expect(diff.hasParamChanges).toBe(true);
    expect(diff.paramChanges.length).toBeGreaterThan(0);
  });

  it("should list each changed parameter with old and new values", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, MODIFIED_PARAMS);

    const diff = computeVersionDiff(v1, v2);
    const kdjChange = diff.paramChanges.find(
      (c) => c.paramName === "kdj_period"
    );

    expect(kdjChange).toBeDefined();
    expect(kdjChange!.oldValue).toBe(9);
    expect(kdjChange!.newValue).toBe(14);
    expect(kdjChange!.type).toBe("modified");
  });

  it("should detect added parameters", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, { a: 1 });
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, { a: 1, b: 2 });

    const diff = computeVersionDiff(v1, v2);
    const addedParam = diff.paramChanges.find((c) => c.paramName === "b");
    expect(addedParam).toBeDefined();
    expect(addedParam!.type).toBe("added");
    expect(addedParam!.newValue).toBe(2);
  });

  it("should detect removed parameters", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, { a: 1, b: 2 });
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, { a: 1 });

    const diff = computeVersionDiff(v1, v2);
    const removedParam = diff.paramChanges.find((c) => c.paramName === "b");
    expect(removedParam).toBeDefined();
    expect(removedParam!.type).toBe("removed");
    expect(removedParam!.oldValue).toBe(2);
  });

  it("should report no changes for identical versions", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, BASE_PARAMS);

    const diff = computeVersionDiff(v1, v2);
    expect(diff.hasCodeChanges).toBe(false);
    expect(diff.hasParamChanges).toBe(false);
    expect(diff.paramChanges.length).toBe(0);
  });

  it("should handle versions with empty params", () => {
    const v1 = createVersion(STRATEGY_ID, BASE_CODE, {});
    const v2 = createVersion(STRATEGY_ID, BASE_CODE, {});

    const diff = computeVersionDiff(v1, v2);
    expect(diff.hasParamChanges).toBe(false);
    expect(diff.paramChanges.length).toBe(0);
  });
});
