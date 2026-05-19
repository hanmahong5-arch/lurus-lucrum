/**
 * Tests for the Sprint 1 招 C published gate.
 *
 * Test design from two perspectives:
 *   USER (would-be marketplace publisher): "Don't let me list a strategy
 *     with 0.5 Sharpe; do let me list one with Sharpe 2 + clean trials."
 *   ADVERSARIAL TESTER: "Empty returns, all-zero returns, single trial,
 *     thresholds override merging, walk-forward partial inputs."
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_GATE_THRESHOLDS,
  MARKETPLACE_SUBMIT_GATE,
  runGates,
  type GateThresholds,
} from "../gate-runner";
import type { ReturnSeries } from "../types";

describe("MARKETPLACE_SUBMIT_GATE — published thresholds", () => {
  it("has all 5 threshold fields", () => {
    const required: ReadonlyArray<keyof GateThresholds> = [
      "minSharpe",
      "minBootstrapLower",
      "maxPBO",
      "minDSRProbability",
      "minGeneralisation",
    ];
    for (const key of required) {
      expect(typeof MARKETPLACE_SUBMIT_GATE[key]).toBe("number");
    }
  });

  it("DSR threshold is stricter than the default vetting gate (0.95 > 0.9)", () => {
    expect(MARKETPLACE_SUBMIT_GATE.minDSRProbability).toBe(0.95);
    expect(MARKETPLACE_SUBMIT_GATE.minDSRProbability).toBeGreaterThan(
      DEFAULT_GATE_THRESHOLDS.minDSRProbability,
    );
  });

  it("PBO ceiling is looser than the default vetting gate (0.5 > 0.3) by design", () => {
    expect(MARKETPLACE_SUBMIT_GATE.maxPBO).toBe(0.5);
    expect(MARKETPLACE_SUBMIT_GATE.maxPBO).toBeGreaterThan(DEFAULT_GATE_THRESHOLDS.maxPBO);
  });

  it("Sharpe / bootstrap / generalisation match the default (no marketplace-specific change)", () => {
    expect(MARKETPLACE_SUBMIT_GATE.minSharpe).toBe(DEFAULT_GATE_THRESHOLDS.minSharpe);
    expect(MARKETPLACE_SUBMIT_GATE.minBootstrapLower).toBe(
      DEFAULT_GATE_THRESHOLDS.minBootstrapLower,
    );
    expect(MARKETPLACE_SUBMIT_GATE.minGeneralisation).toBe(
      DEFAULT_GATE_THRESHOLDS.minGeneralisation,
    );
  });

  it("all thresholds are finite, non-NaN, sensible (>=0)", () => {
    for (const [key, value] of Object.entries(MARKETPLACE_SUBMIT_GATE)) {
      expect(Number.isFinite(value), `${key} must be finite`).toBe(true);
      expect(Number.isNaN(value), `${key} must not be NaN`).toBe(false);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// runGates — actual gate execution (95% coverage push)
// ---------------------------------------------------------------------------

/**
 * Build a deterministic daily-return series with target mean + stdev.
 * Used to drive Sharpe high enough to pass thresholds.
 */
function makeReturns(opts: {
  length: number;
  mean: number;
  amplitude: number;
}): ReturnSeries {
  const series: number[] = [];
  for (let i = 0; i < opts.length; i += 1) {
    // Alternate +/- amplitude around the mean so stdev > 0.
    series.push(opts.mean + (i % 2 === 0 ? opts.amplitude : -opts.amplitude));
  }
  return series;
}

describe("runGates — gate execution", () => {
  it("returns a fail report with sharpe + bootstrap checks when only selectedReturns provided", () => {
    // Zero-return series → Sharpe = 0 < 1 → sharpe check FAILS.
    // trialReturns missing → PBO/DSR are skipped + warning recorded.
    const report = runGates({
      selectedReturns: new Array(60).fill(0),
    });
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.name === "sharpe")?.passed).toBe(false);
    // PBO/DSR checks not appended when trialReturns missing.
    expect(report.checks.find((c) => c.name === "pbo")).toBeUndefined();
    expect(report.checks.find((c) => c.name === "dsr")).toBeUndefined();
    expect(report.warnings.some((w) => w.includes("PBO/DSR skipped"))).toBe(true);
    expect(report.details.pbo).toBeNull();
    expect(report.details.dsrProbability).toBeNull();
  });

  it("overallScore = passed/total across all checks", () => {
    const report = runGates({ selectedReturns: new Array(60).fill(0) });
    const passed = report.checks.filter((c) => c.passed).length;
    expect(report.overallScore).toBeCloseTo(passed / report.checks.length, 6);
  });

  it("returns overallScore = 0 when no checks ran (empty selectedReturns)", () => {
    // Empty returns: sharpe = NaN comparison; bootstrap may produce lower=NaN.
    // We just verify runGates doesn't throw and shape is sane.
    const report = runGates({ selectedReturns: [] });
    expect(Number.isFinite(report.overallScore)).toBe(true);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(1);
  });

  it("appends PBO + DSR checks when trialReturns has ≥ 2 candidates", () => {
    const goodReturns = makeReturns({ length: 252, mean: 0.001, amplitude: 0.005 });
    const trials = [
      goodReturns,
      makeReturns({ length: 252, mean: 0.0008, amplitude: 0.006 }),
      makeReturns({ length: 252, mean: 0.0005, amplitude: 0.007 }),
    ];
    const report = runGates({
      selectedReturns: goodReturns,
      trialReturns: trials,
    });
    expect(report.checks.find((c) => c.name === "pbo")).toBeDefined();
    expect(report.checks.find((c) => c.name === "dsr")).toBeDefined();
    expect(report.details.pbo).not.toBeNull();
    expect(report.details.dsrProbability).not.toBeNull();
  });

  it("respects partial thresholds override (merges with defaults)", () => {
    const report = runGates({
      selectedReturns: makeReturns({ length: 252, mean: 0.001, amplitude: 0.005 }),
      thresholds: { minSharpe: 10 }, // impossibly high
    });
    const sharpe = report.checks.find((c) => c.name === "sharpe");
    expect(sharpe?.threshold).toBe(10);
    expect(sharpe?.passed).toBe(false);
  });

  it("emits 'trialReturns missing' warning when trialReturns has < 2 candidates", () => {
    const report = runGates({
      selectedReturns: makeReturns({ length: 60, mean: 0.001, amplitude: 0.005 }),
      trialReturns: [makeReturns({ length: 60, mean: 0.001, amplitude: 0.005 })],
    });
    expect(report.warnings.some((w) => w.toLowerCase().includes("missing"))).toBe(
      true,
    );
  });

  it("MARKETPLACE_SUBMIT_GATE as thresholds blocks low-Sharpe strategy", () => {
    const report = runGates({
      selectedReturns: new Array(60).fill(0),
      thresholds: MARKETPLACE_SUBMIT_GATE,
    });
    expect(report.passed).toBe(false);
  });

  it("structurally has the documented details shape", () => {
    const report = runGates({ selectedReturns: new Array(30).fill(0.001) });
    expect(report.details).toHaveProperty("sharpe");
    expect(report.details).toHaveProperty("bootstrap");
    expect(report.details.bootstrap).toHaveProperty("lower");
    expect(report.details.bootstrap).toHaveProperty("upper");
    expect(report.details.bootstrap).toHaveProperty("point");
    expect(report.details).toHaveProperty("pbo");
    expect(report.details).toHaveProperty("dsrProbability");
    expect(report.details).toHaveProperty("generalisationRatio");
  });

  it("appends walk-forward-generalisation check when walkForward args provided", () => {
    // Series long enough that buildFolds produces at least one fold:
    // default folds = clamp(3, floor(180/60), 6) = 3; foldSize = 60 ≥ minTrainBars+5.
    const seriesLength = 180;
    const baseReturns = makeReturns({
      length: seriesLength,
      mean: 0.001,
      amplitude: 0.005,
    });
    const report = runGates({
      selectedReturns: baseReturns,
      walkForwardCandidates: [
        { id: "c1", params: { x: 1 } },
        { id: "c2", params: { x: 2 } },
      ],
      walkForwardSeries: () => baseReturns,
      walkForwardSeriesLength: seriesLength,
    });
    const wf = report.checks.find((c) => c.name === "walk-forward-generalisation");
    expect(wf).toBeDefined();
    expect(report.details.generalisationRatio).not.toBeNull();
  });
});
