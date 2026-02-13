/**
 * Builtin Strategy Templates Tests
 *
 * Validates the curated builtin template library meets FR-1.5 requirements:
 * - At least 5 templates
 * - Each template has complete data structure
 * - Vnpy code is present and valid
 * - Difficulty distribution covers all levels
 * - Template conditions (buy/sell/position) are well-formed
 */
import { describe, it, expect } from "vitest";
import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplateById,
  getBuiltinTemplatesByDifficulty,
  DIFFICULTY_CONFIG,
  type BuiltinTemplate,
  type DifficultyLevel,
} from "../builtin-templates";

// =============================================================================
// TEMPLATE COUNT & STRUCTURE
// =============================================================================

describe("BuiltinTemplates", () => {
  describe("template count", () => {
    it("has at least 5 builtin templates (FR-1.5)", () => {
      expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it("has no duplicate IDs", () => {
      const ids = BUILTIN_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // ===========================================================================
  // REQUIRED FIELDS
  // ===========================================================================

  describe("required fields", () => {
    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s has all required fields",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.nameEn).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.difficulty).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(t.icon).toBeTruthy();
        expect(t.code).toBeTruthy();
        expect(t.defaultParams).toBeTruthy();
        expect(t.conditions).toBeTruthy();
        expect(t.conditions.buy).toBeTruthy();
        expect(t.conditions.sell).toBeTruthy();
        expect(t.prompt).toBeTruthy();
      },
    );

    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s has non-empty conditions arrays",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        expect(t.conditions.buy.length).toBeGreaterThan(0);
        expect(t.conditions.sell.length).toBeGreaterThan(0);
      },
    );

    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s has non-empty defaultParams",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        expect(Object.keys(t.defaultParams).length).toBeGreaterThan(0);
      },
    );
  });

  // ===========================================================================
  // VNPY CODE VALIDITY
  // ===========================================================================

  describe("vnpy code validity", () => {
    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s has vnpy-style Python code",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        // Should contain class definition pattern
        expect(t.code).toContain("class ");
        // Should contain CtaTemplate base class
        expect(t.code).toContain("CtaTemplate");
        // Should have on_bar or on_tick method
        expect(
          t.code.includes("on_bar") || t.code.includes("on_tick"),
        ).toBeTruthy();
      },
    );

    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s code is at least 100 characters",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        expect(t.code.length).toBeGreaterThanOrEqual(100);
      },
    );
  });

  // ===========================================================================
  // DIFFICULTY DISTRIBUTION
  // ===========================================================================

  describe("difficulty distribution", () => {
    it("has at least one beginner template", () => {
      const beginners = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "beginner",
      );
      expect(beginners.length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one intermediate template", () => {
      const intermediates = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "intermediate",
      );
      expect(intermediates.length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one advanced template", () => {
      const advanced = BUILTIN_TEMPLATES.filter(
        (t) => t.difficulty === "advanced",
      );
      expect(advanced.length).toBeGreaterThanOrEqual(1);
    });

    it("all templates have valid difficulty values", () => {
      const validDifficulties: DifficultyLevel[] = [
        "beginner",
        "intermediate",
        "advanced",
      ];
      BUILTIN_TEMPLATES.forEach((t) => {
        expect(validDifficulties).toContain(t.difficulty);
      });
    });
  });

  // ===========================================================================
  // SPECIFIC TEMPLATES (5 REQUIRED)
  // ===========================================================================

  describe("required templates exist", () => {
    it("includes dual MA crossover (双均线交叉)", () => {
      const found = BUILTIN_TEMPLATES.find(
        (t) => t.id === "builtin-dual-ma" || t.name.includes("双均线"),
      );
      expect(found).toBeDefined();
      expect(found?.difficulty).toBe("beginner");
    });

    it("includes KDJ overbought/oversold (KDJ超买超卖)", () => {
      const found = BUILTIN_TEMPLATES.find(
        (t) => t.id === "builtin-kdj" || t.name.includes("KDJ"),
      );
      expect(found).toBeDefined();
      expect(found?.difficulty).toBe("beginner");
    });

    it("includes MACD momentum (MACD动量)", () => {
      const found = BUILTIN_TEMPLATES.find(
        (t) => t.id === "builtin-macd" || t.name.includes("MACD"),
      );
      expect(found).toBeDefined();
      expect(found?.difficulty).toBe("intermediate");
    });

    it("includes Bollinger Bands breakout (布林带突破)", () => {
      const found = BUILTIN_TEMPLATES.find(
        (t) => t.id === "builtin-bollinger" || t.name.includes("布林"),
      );
      expect(found).toBeDefined();
      expect(found?.difficulty).toBe("intermediate");
    });

    it("includes Multi-factor composite (多因子综合)", () => {
      const found = BUILTIN_TEMPLATES.find(
        (t) => t.id === "builtin-multi-factor" || t.name.includes("多因子"),
      );
      expect(found).toBeDefined();
      expect(found?.difficulty).toBe("advanced");
    });
  });

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  describe("getBuiltinTemplateById", () => {
    it("returns template by valid ID", () => {
      const first = BUILTIN_TEMPLATES[0] as BuiltinTemplate | undefined;
      expect(first).toBeDefined();
      if (!first) return;
      const result = getBuiltinTemplateById(first.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(first.id);
    });

    it("returns undefined for invalid ID", () => {
      const result = getBuiltinTemplateById("nonexistent-id");
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const result = getBuiltinTemplateById("");
      expect(result).toBeUndefined();
    });
  });

  describe("getBuiltinTemplatesByDifficulty", () => {
    it("returns only beginner templates", () => {
      const result = getBuiltinTemplatesByDifficulty("beginner");
      result.forEach((t) => {
        expect(t.difficulty).toBe("beginner");
      });
    });

    it("returns only intermediate templates", () => {
      const result = getBuiltinTemplatesByDifficulty("intermediate");
      result.forEach((t) => {
        expect(t.difficulty).toBe("intermediate");
      });
    });

    it("returns only advanced templates", () => {
      const result = getBuiltinTemplatesByDifficulty("advanced");
      result.forEach((t) => {
        expect(t.difficulty).toBe("advanced");
      });
    });
  });

  // ===========================================================================
  // DIFFICULTY CONFIG
  // ===========================================================================

  describe("DIFFICULTY_CONFIG", () => {
    it("has config for all three difficulty levels", () => {
      expect(DIFFICULTY_CONFIG.beginner).toBeDefined();
      expect(DIFFICULTY_CONFIG.intermediate).toBeDefined();
      expect(DIFFICULTY_CONFIG.advanced).toBeDefined();
    });

    it("each config has label and colorClass", () => {
      Object.values(DIFFICULTY_CONFIG).forEach((config) => {
        expect(config.label).toBeTruthy();
        expect(config.labelEn).toBeTruthy();
        expect(config.colorClass).toBeTruthy();
      });
    });
  });

  // ===========================================================================
  // EXPECTED SCORE RANGE
  // ===========================================================================

  describe("expected score range", () => {
    it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t]))(
      "template %s has valid expected score range",
      (_id, template) => {
        const t = template as BuiltinTemplate;
        const validGrades = ["S", "A", "B", "C", "D"];
        expect(validGrades).toContain(t.expectedScoreRange.min);
        expect(validGrades).toContain(t.expectedScoreRange.max);
      },
    );
  });
});
