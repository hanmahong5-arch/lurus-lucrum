/**
 * Bridge between the theme registry and non-React (imperative) consumers.
 *
 * Pure-functional layer — no React, no DOM reads (`getComputedStyle` is
 * intentionally avoided so this works in SSR, tests, and tight render
 * loops without forcing layout). Lookups go through the registry, which
 * is the single source of truth, so any consumer that resolves a token
 * through this bridge gets the same value the CSS variables would resolve
 * to.
 *
 * Use the React `useThemeRgb` hook for components that should re-render on
 * theme change; reach for these raw functions only when you need a one-shot
 * value (initial config of a third-party imperative API, for example).
 *
 * @module lib/theme/bridge
 */

import { getThemeTokenValue } from "./registry";
import type { RgbTriple, ThemeId, ThemeTokenName } from "./types";

/**
 * Lookup the RGB triple for a given theme + token. Re-exported from
 * `registry.ts` for ergonomic imports — same function, two call sites.
 */
export { getThemeTokenValue };

/**
 * Convert an `[r, g, b]` triple to a CSS color string. When `alpha` is
 * omitted, emits `rgb(r g b)` (modern CSS); when provided, emits
 * `rgb(r g b / <alpha>)`. Both forms render identically across all
 * supported browsers.
 */
export function rgbTripleToCss(rgb: RgbTriple, alpha?: number): string {
  const [r, g, b] = rgb;
  if (typeof alpha === "number") {
    // Clamp to [0,1] so callers can't accidentally drift the value.
    const clamped = Math.max(0, Math.min(1, alpha));
    return `rgb(${r} ${g} ${b} / ${clamped})`;
  }
  return `rgb(${r} ${g} ${b})`;
}

/**
 * One-shot resolution from `(themeId, tokenName, alpha?)` to a CSS color
 * string. Convenience for non-React consumers (chart libs, canvas, etc.).
 */
export function resolveThemeRgb(
  themeId: ThemeId,
  tokenName: ThemeTokenName,
  alpha?: number
): string {
  return rgbTripleToCss(getThemeTokenValue(themeId, tokenName), alpha);
}
