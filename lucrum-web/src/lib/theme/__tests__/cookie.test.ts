import { describe, expect, it } from "vitest";
import {
  LUCRUM_THEME_COOKIE,
  LUCRUM_THEME_COOKIE_MAX_AGE,
  parseThemeCookie,
  serializeThemeCookie,
} from "../cookie";
import { DEFAULT_THEME_ID } from "../registry";

describe("theme cookie", () => {
  it("parses known theme ids", () => {
    expect(parseThemeCookie("terminal-pro")).toBe("terminal-pro");
    expect(parseThemeCookie("cyberpunk")).toBe("cyberpunk");
  });

  it("falls back to default on unknown / missing values", () => {
    expect(parseThemeCookie(undefined)).toBe(DEFAULT_THEME_ID);
    expect(parseThemeCookie(null)).toBe(DEFAULT_THEME_ID);
    expect(parseThemeCookie("")).toBe(DEFAULT_THEME_ID);
    expect(parseThemeCookie("bogus")).toBe(DEFAULT_THEME_ID);
  });

  it("trims whitespace before parsing", () => {
    expect(parseThemeCookie("  cyberpunk  ")).toBe("cyberpunk");
  });

  it("serializes with the expected attributes", () => {
    const serialized = serializeThemeCookie("cyberpunk");
    expect(serialized).toContain(`${LUCRUM_THEME_COOKIE}=cyberpunk`);
    expect(serialized).toContain("Path=/");
    expect(serialized).toContain(`Max-Age=${LUCRUM_THEME_COOKIE_MAX_AGE}`);
    expect(serialized).toContain("SameSite=Lax");
  });
});
