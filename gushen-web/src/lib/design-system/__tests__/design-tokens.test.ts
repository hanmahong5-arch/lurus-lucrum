/**
 * Design System Token Tests
 *
 * Validates that all Gushen design tokens are properly defined
 * and accessible through Tailwind CSS classes.
 * Includes WCAG 2.1 AA contrast ratio validation (NFR-4.4).
 *
 * Story 1.1: 设计系统令牌扩展
 */

import { describe, it, expect } from "vitest";
import tailwindConfig from "../../../../tailwind.config";

// =============================================================================
// WCAG 2.1 Contrast Ratio Helpers
// =============================================================================

/** Convert hex color string to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Convert sRGB channel to linear value */
function toLinear(c: number): number {
  const sRGB = c / 255;
  return sRGB <= 0.03928
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/** Calculate relative luminance per WCAG 2.1 definition */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Calculate WCAG contrast ratio between two hex colors */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Design Tokens - Story 1.1", () => {
  const colors = tailwindConfig.theme?.extend?.colors as Record<string, string>;
  const backgroundColor = tailwindConfig.theme?.extend?.backgroundColor as Record<string, string>;
  const fontSize = tailwindConfig.theme?.extend?.fontSize as Record<string, unknown>;
  const animation = tailwindConfig.theme?.extend?.animation as Record<string, string>;
  const keyframes = tailwindConfig.theme?.extend?.keyframes as Record<string, unknown>;

  describe("AC-1: Score Colors (策略评分色)", () => {
    it("should define score-s (gold, excellent strategy)", () => {
      expect(colors["score-s"]).toBe("rgb(var(--gushen-color-score-s) / <alpha-value>)");
    });

    it("should define score-a (cyan, great strategy)", () => {
      expect(colors["score-a"]).toBe("rgb(var(--gushen-color-score-a) / <alpha-value>)");
    });

    it("should define score-b (blue, good strategy)", () => {
      expect(colors["score-b"]).toBe("rgb(var(--gushen-color-score-b) / <alpha-value>)");
    });

    it("should define score-c (gray, average strategy)", () => {
      expect(colors["score-c"]).toBe("rgb(var(--gushen-color-score-c) / <alpha-value>)");
    });

    it("should define score-d (orange, needs improvement)", () => {
      expect(colors["score-d"]).toBe("rgb(var(--gushen-color-score-d) / <alpha-value>)");
    });
  });

  describe("AC-2: Data Source Colors (数据源标识色)", () => {
    it("should define source-db (blue, real database data)", () => {
      expect(colors["source-db"]).toBe("rgb(var(--gushen-color-source-db) / <alpha-value>)");
    });

    it("should define source-api (yellow, real-time API data)", () => {
      expect(colors["source-api"]).toBe("rgb(var(--gushen-color-source-api) / <alpha-value>)");
    });

    it("should define source-sim (gray, simulated data)", () => {
      expect(colors["source-sim"]).toBe("rgb(var(--gushen-color-source-sim) / <alpha-value>)");
    });
  });

  describe("AC-3: AI Visual Language (AI 视觉语言令牌)", () => {
    it("should define ai color (purple)", () => {
      expect(colors["ai"]).toBe("rgb(var(--gushen-color-ai) / <alpha-value>)");
    });

    it("should define ai-bg with 10% opacity", () => {
      expect(colors["ai-bg"]).toBe("rgb(var(--gushen-bg-ai) / 0.10)");
    });

    it("should define ai-border with 20% opacity", () => {
      expect(colors["ai-border"]).toBe("rgb(var(--gushen-border-ai) / 0.20)");
    });

    it("should define ai-pulse animation", () => {
      expect(animation["ai-pulse"]).toBe("ai-pulse 1.5s ease-in-out infinite");
    });

    it("should define ai-pulse keyframes", () => {
      expect(keyframes["ai-pulse"]).toBeDefined();
      const aiPulse = keyframes["ai-pulse"] as Record<string, unknown>;
      expect(aiPulse["0%, 100%"]).toBeDefined();
      expect(aiPulse["50%"]).toBeDefined();
    });
  });

  describe("AC-4: Workflow Step Colors (工作流步骤色)", () => {
    it("should define step-active (blue, current step)", () => {
      expect(colors["step-active"]).toBe("rgb(var(--gushen-color-step-active) / <alpha-value>)");
    });

    it("should define step-done (green, completed step)", () => {
      expect(colors["step-done"]).toBe("rgb(var(--gushen-color-step-done) / <alpha-value>)");
    });

    it("should define step-pending (gray, pending step)", () => {
      expect(colors["step-pending"]).toBe("rgb(var(--gushen-color-step-pending) / <alpha-value>)");
    });
  });

  describe("AC-5: Status Light Colors (状态灯色)", () => {
    it("should define status-ready (green, ready)", () => {
      expect(colors["status-ready"]).toBe("rgb(var(--gushen-color-status-ready) / <alpha-value>)");
    });

    it("should define status-warn (yellow, warning)", () => {
      expect(colors["status-warn"]).toBe("rgb(var(--gushen-color-status-warn) / <alpha-value>)");
    });

    it("should define status-block (red, blocked)", () => {
      expect(colors["status-block"]).toBe("rgb(var(--gushen-color-status-block) / <alpha-value>)");
    });
  });

  describe("AC-6: Surface Level Extension (背景层级扩展)", () => {
    it("should define surface-elevated (Level 2, embedded cards)", () => {
      expect(backgroundColor["surface-elevated"]).toBe(
        "rgb(var(--gushen-bg-surface-elevated) / <alpha-value>)"
      );
    });

    it("should define surface-modal (Level 4, Modal/Dialog)", () => {
      expect(backgroundColor["surface-modal"]).toBe(
        "rgb(var(--gushen-bg-surface-modal) / <alpha-value>)"
      );
    });
  });

  describe("AC-7: Chart Extension Colors (图表扩展色)", () => {
    it("should define chart-benchmark (gray, CSI 300 etc.)", () => {
      expect(colors["chart-benchmark"]).toBe(
        "rgb(var(--gushen-color-chart-benchmark) / <alpha-value>)"
      );
    });

    it("should define chart-signal (purple, buy/sell signals)", () => {
      expect(colors["chart-signal"]).toBe("rgb(var(--gushen-color-chart-signal) / <alpha-value>)");
    });
  });

  describe("AC-8: Typography Extension (字体级别扩展)", () => {
    it("should define display fontSize with clamp", () => {
      expect(fontSize["display"]).toBeDefined();
      const displaySize = fontSize["display"] as [string, Record<string, string>];
      expect(displaySize[0]).toBe("clamp(2rem, 5vw, 3rem)");
      expect(displaySize[1].lineHeight).toBe("1.1");
      expect(displaySize[1].fontWeight).toBe("700");
    });

    it("should have data-sm at 13px (0.8125rem)", () => {
      expect(fontSize["data-sm"]).toBeDefined();
      const dataSm = fontSize["data-sm"] as [string, Record<string, string>];
      expect(dataSm[0]).toBe("0.8125rem");
    });
  });

  // ===========================================================================
  // WCAG 2.1 AA Contrast Validation (NFR-4.4)
  // Foreground tokens on dark backgrounds must meet minimum contrast ratios.
  // Normal text: 4.5:1, Large text (>=18pt / 24px bold): 3:1
  // ===========================================================================

  describe("WCAG 2.1 AA Contrast Validation (NFR-4.4)", () => {
    const BG_VOID = "#09090b";
    const BG_SURFACE = "#18181b";

    // Tokens used as normal-size text (4.5:1 required)
    const normalTextTokens: Record<string, string> = {
      "score-s": "#fbbf24",
      "score-a": "#22d3ee",
      "score-d": "#fb923c",
      "source-db": "#3b82f6",
      "source-api": "#eab308",
      "ai": "#a78bfa",
      "step-active": "#3b82f6",
      "step-done": "#22c55e",
      "status-ready": "#22c55e",
      "status-warn": "#eab308",
      "status-block": "#ef4444",
    };

    // Tokens used as large text or muted indicators (3:1 sufficient)
    const largeTextTokens: Record<string, string> = {
      "score-b": "#3b82f6",
      "score-c": "#6b7280",
      "source-sim": "#6b7280",
      "step-pending": "#64748b",
      "chart-benchmark": "#6b7280",
      "chart-signal": "#a78bfa",
    };

    describe("normal text on void background (4.5:1)", () => {
      Object.entries(normalTextTokens).forEach(([name, hex]) => {
        it(`${name} (${hex}) should meet 4.5:1 contrast on #09090b`, () => {
          const ratio = contrastRatio(hex, BG_VOID);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      });
    });

    describe("normal text on surface background (4.5:1)", () => {
      Object.entries(normalTextTokens).forEach(([name, hex]) => {
        it(`${name} (${hex}) should meet 4.5:1 contrast on #18181b`, () => {
          const ratio = contrastRatio(hex, BG_SURFACE);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      });
    });

    describe("large text / muted indicators on void background (3:1)", () => {
      Object.entries(largeTextTokens).forEach(([name, hex]) => {
        it(`${name} (${hex}) should meet 3:1 contrast on #09090b`, () => {
          const ratio = contrastRatio(hex, BG_VOID);
          expect(ratio).toBeGreaterThanOrEqual(3);
        });
      });
    });

    describe("large text / muted indicators on surface background (3:1)", () => {
      Object.entries(largeTextTokens).forEach(([name, hex]) => {
        it(`${name} (${hex}) should meet 3:1 contrast on #18181b`, () => {
          const ratio = contrastRatio(hex, BG_SURFACE);
          expect(ratio).toBeGreaterThanOrEqual(3);
        });
      });
    });
  });
});
