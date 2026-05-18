/**
 * Tests for the Sprint 1 招 C published gate constant. The runGates math is
 * tested elsewhere; here we lock down the MARKETPLACE_SUBMIT_GATE numbers so
 * a future "let's relax DSR to 0.8 quietly" doesn't slip through review.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_GATE_THRESHOLDS,
  MARKETPLACE_SUBMIT_GATE,
  type GateThresholds,
} from "../gate-runner";

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
