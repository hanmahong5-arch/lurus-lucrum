import { describe, expect, it } from "vitest";
import {
  getThemeTokenValue,
  resolveThemeRgb,
  rgbTripleToCss,
} from "../bridge";
import { THEMES } from "../registry";

describe("theme bridge", () => {
  it("emits the modern CSS rgb() form without alpha", () => {
    expect(rgbTripleToCss([59, 130, 246])).toBe("rgb(59 130 246)");
  });

  it("emits alpha when supplied", () => {
    expect(rgbTripleToCss([0, 0, 0], 0.5)).toBe("rgb(0 0 0 / 0.5)");
  });

  it("clamps alpha to [0, 1]", () => {
    expect(rgbTripleToCss([1, 2, 3], -0.4)).toBe("rgb(1 2 3 / 0)");
    expect(rgbTripleToCss([1, 2, 3], 2)).toBe("rgb(1 2 3 / 1)");
  });

  it("resolveThemeRgb walks (themeId, tokenName) → css string", () => {
    expect(resolveThemeRgb("terminal-pro", "color-primary")).toBe("rgb(59 130 246)");
    expect(resolveThemeRgb("cyberpunk", "color-primary")).toBe("rgb(167 139 250)");
  });

  it("resolveThemeRgb passes alpha through", () => {
    expect(resolveThemeRgb("terminal-pro", "bg-void", 0.4)).toBe("rgb(9 9 11 / 0.4)");
  });

  it("getThemeTokenValue is the same function exposed by registry", () => {
    expect(getThemeTokenValue("terminal-pro", "fg")).toEqual(
      THEMES["terminal-pro"].tokens.fg
    );
  });
});
