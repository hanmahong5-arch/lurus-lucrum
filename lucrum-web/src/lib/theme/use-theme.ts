/**
 * `useTheme` — public React hook for reading and switching the active theme.
 *
 * Returns the current `ThemeId`, the full `ThemeDefinition` (for cases that
 * need the label or metaThemeColor), and a `setTheme(id)` setter.
 *
 * Lives in its own file so consumers can `import { useTheme } from
 * "@/lib/theme/use-theme"` without dragging in the provider implementation.
 *
 * @module lib/theme/use-theme
 */

"use client";

import { useContext } from "react";
import { THEMES } from "./registry";
import { ThemeContext, type ThemeContextValue } from "./theme-context";
import type { ThemeDefinition } from "./types";

export interface UseThemeResult extends ThemeContextValue {
  /** Full registry entry for the active theme. */
  definition: ThemeDefinition;
}

export function useTheme(): UseThemeResult {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return { ...ctx, definition: THEMES[ctx.themeId] };
}
