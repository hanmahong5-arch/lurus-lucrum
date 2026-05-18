import { describe, expect, it } from "vitest";
import {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  getThemeTokenValue,
  isThemeId,
} from "../registry";
import { SEMANTIC_TOKENS } from "../tokens";
import type { ThemeId, ThemeTokenName, RgbTriple } from "../types";

describe("theme registry", () => {
  it("defines every id listed in THEME_IDS", () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id]).toBeDefined();
      expect(THEMES[id].id).toBe(id);
    }
  });

  it("default theme is registered", () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME_ID);
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it("every theme defines every semantic token", () => {
    for (const id of THEME_IDS) {
      const tokens = THEMES[id].tokens;
      for (const name of SEMANTIC_TOKENS) {
        const triple = tokens[name];
        expect(triple, `theme ${id} missing token ${name}`).toBeDefined();
        expect(Array.isArray(triple)).toBe(true);
        expect(triple).toHaveLength(3);
        for (const c of triple) {
          expect(Number.isInteger(c)).toBe(true);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it("metaThemeColor is a 7-char hex string", () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id].metaThemeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("isThemeId narrows correctly", () => {
    for (const id of THEME_IDS) {
      expect(isThemeId(id)).toBe(true);
    }
    expect(isThemeId("not-a-theme")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });

  it("getThemeTokenValue returns the registered triple", () => {
    const expected = THEMES["terminal-pro"].tokens["color-primary"];
    expect(getThemeTokenValue("terminal-pro", "color-primary")).toEqual(expected);
  });

  it("getThemeTokenValue falls back to default for unknown ids", () => {
    const fallback = getThemeTokenValue("ghost-theme" as ThemeId, "color-primary");
    expect(fallback).toEqual(THEMES[DEFAULT_THEME_ID].tokens["color-primary"]);
  });

  // Snapshot guards drift between TS registry and globals.css. Update both
  // when intentionally changing a color, then update this snapshot.
  it("terminal-pro tokens match the committed globals.css values", () => {
    const expected: Record<ThemeTokenName, RgbTriple> = {
      "bg-void": [9, 9, 11],
      "bg-surface": [24, 24, 27],
      "bg-surface-hover": [39, 39, 42],
      "bg-surface-active": [63, 63, 70],
      "bg-surface-border": [39, 39, 42],
      "color-primary": [59, 130, 246],
      "color-primary-hover": [37, 99, 235],
      "color-primary-light": [96, 165, 250],
      "color-accent": [245, 158, 11],
      "color-accent-hover": [217, 119, 6],
      fg: [250, 250, 250],
      "fg-muted": [161, 161, 170],
    };
    for (const name of SEMANTIC_TOKENS) {
      expect(THEMES["terminal-pro"].tokens[name]).toEqual(expected[name]);
    }
  });

  it("cyberpunk tokens match the committed globals.css values", () => {
    const expected: Record<ThemeTokenName, RgbTriple> = {
      "bg-void": [8, 5, 18],
      "bg-surface": [20, 14, 38],
      "bg-surface-hover": [35, 22, 64],
      "bg-surface-active": [58, 36, 100],
      "bg-surface-border": [64, 36, 120],
      "color-primary": [167, 139, 250],
      "color-primary-hover": [139, 92, 246],
      "color-primary-light": [196, 181, 253],
      "color-accent": [236, 72, 153],
      "color-accent-hover": [219, 39, 119],
      fg: [237, 233, 254],
      "fg-muted": [196, 181, 253],
    };
    for (const name of SEMANTIC_TOKENS) {
      expect(THEMES.cyberpunk.tokens[name]).toEqual(expected[name]);
    }
  });
});
