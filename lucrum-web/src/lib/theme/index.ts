/**
 * Public surface of the theme module.
 *
 * Consumers should import from `@/lib/theme` (this file) rather than reaching
 * into individual files — that keeps the dependency boundary explicit and
 * lets us reshape internals without breaking callers.
 *
 * @module lib/theme
 */

export { ThemeProvider, type ThemeProviderProps } from "./provider";
export { useTheme, type UseThemeResult } from "./use-theme";
export {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  isThemeId,
  getThemeTokenValue,
} from "./registry";
export {
  LUCRUM_THEME_COOKIE,
  LUCRUM_THEME_COOKIE_MAX_AGE,
  parseThemeCookie,
  serializeThemeCookie,
} from "./cookie";
export { SEMANTIC_TOKENS } from "./tokens";
export { resolveThemeRgb, rgbTripleToCss } from "./bridge";
export { useThemeRgb } from "./use-theme-rgb";
export type {
  ThemeId,
  ThemeDefinition,
  ThemeTokens,
  ThemeTokenName,
  RgbTriple,
} from "./types";
