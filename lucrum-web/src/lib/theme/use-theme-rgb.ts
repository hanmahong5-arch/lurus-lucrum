/**
 * `useThemeRgb` — the React hook for non-CSS color consumers.
 *
 * Returns an `rgb(r g b)` (or `rgb(r g b / alpha)`) string for the requested
 * semantic token in the active theme, and updates when the theme changes.
 *
 * Use this in React components that pass colors to:
 *   - imperative chart libs (lightweight-charts, ECharts)
 *   - `<canvas>` / WebGL fill calls
 *   - inline SVG `stroke` / `fill` props that can't reference CSS variables
 *
 * For pure-CSS surfaces, prefer the `rgb(var(--lucrum-<name>))` form
 * directly in stylesheets — it's cheaper than a hook.
 *
 * @module lib/theme/use-theme-rgb
 */

"use client";

import { useMemo } from "react";
import { rgbTripleToCss } from "./bridge";
import { useTheme } from "./use-theme";
import type { ThemeTokenName } from "./types";

export function useThemeRgb(tokenName: ThemeTokenName, alpha?: number): string {
  const { definition } = useTheme();
  return useMemo(() => {
    const triple = definition.tokens[tokenName];
    return rgbTripleToCss(triple, alpha);
  }, [definition, tokenName, alpha]);
}
