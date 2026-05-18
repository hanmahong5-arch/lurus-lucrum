/**
 * Theme registry — the **single source of truth** for every theme.
 *
 * Adding a new theme is a one-file change: extend `ThemeId` in `types.ts`
 * (the TS compiler will then refuse to compile until you add an entry here
 * with every required `ThemeTokenName`).
 *
 * The tokens here MUST stay in lockstep with the `--lucrum-<name>` CSS
 * variables in `app/globals.css`. The `registry.test.ts` snapshot guards
 * against drift.
 *
 * @module lib/theme/registry
 */

import type { RgbTriple, ThemeDefinition, ThemeId, ThemeTokens } from "./types";

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

const TERMINAL_PRO_TOKENS: ThemeTokens = {
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

const CYBERPUNK_TOKENS: ThemeTokens = {
  "bg-void": [8, 5, 18],
  "bg-surface": [20, 14, 38],
  "bg-surface-hover": [35, 22, 64],
  "bg-surface-active": [58, 36, 100],
  "bg-surface-border": [64, 36, 120],
  "color-primary": [167, 139, 250],
  "color-primary-hover": [139, 92, 246],
  // Lighter violet — derived by lifting the primary toward white the same way
  // terminal-pro's primary-light relates to its primary. Used by hover/active
  // accents (e.g. .btn-primary:hover).
  "color-primary-light": [196, 181, 253],
  "color-accent": [236, 72, 153],
  "color-accent-hover": [219, 39, 119],
  fg: [237, 233, 254],
  "fg-muted": [196, 181, 253],
};

/**
 * The complete theme registry. Keyed by `ThemeId`; values are immutable.
 */
export const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  "terminal-pro": {
    id: "terminal-pro",
    label: { zh: "终端 Pro", en: "Terminal Pro" },
    metaThemeColor: "#3b82f6",
    tokens: TERMINAL_PRO_TOKENS,
  },
  cyberpunk: {
    id: "cyberpunk",
    label: { zh: "霓虹", en: "Cyberpunk" },
    metaThemeColor: "#a78bfa",
    tokens: CYBERPUNK_TOKENS,
  },
};

/** Ordered list of every supported theme id. UI dropdowns iterate this. */
export const THEME_IDS: readonly ThemeId[] = ["terminal-pro", "cyberpunk"];

/**
 * The theme assumed when no preference exists (no cookie, no localStorage,
 * SSR with no hints). Must match the `data-theme` attribute baked into
 * `<html>` for the no-JS / pre-hydration render.
 */
export const DEFAULT_THEME_ID: ThemeId = "terminal-pro";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Narrow an unknown value to a valid `ThemeId`. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/**
 * Look up a token triple. Falls back to `DEFAULT_THEME_ID` if the supplied
 * id is unknown — keeps callers branch-free.
 */
export function getThemeTokenValue(
  themeId: ThemeId,
  tokenName: keyof ThemeTokens
): RgbTriple {
  const definition = THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID];
  return definition.tokens[tokenName];
}
