/**
 * Theme system — pure type definitions.
 *
 * This module is the upstream of the theme dependency chain:
 *
 *   types → registry → (provider | bridge) → ui / consumers
 *
 * It has zero runtime dependencies and no React/DOM imports, so it can be
 * consumed by Tailwind config, Storybook, tests, or any non-React surface
 * without dragging in the world.
 *
 * @module lib/theme/types
 */

/** A `(r, g, b)` triple in 0–255 space — the canonical token storage form. */
export type RgbTriple = readonly [number, number, number];

/**
 * Stable identifiers for every theme the app supports.
 *
 * Adding a new theme: extend this union AND add a complete `ThemeDefinition`
 * to the registry. TypeScript will then refuse to compile until every
 * required token is defined.
 */
export type ThemeId = "terminal-pro" | "cyberpunk";

/**
 * Semantic token names — the abstract surface that consumers use.
 *
 * Names are kebab-case and map 1:1 to the `--lucrum-<name>` CSS variables
 * emitted in `globals.css`. Changing this list requires a migration of
 * both the CSS and every theme in the registry.
 */
export type ThemeTokenName =
  | "bg-void"
  | "bg-surface"
  | "bg-surface-hover"
  | "bg-surface-active"
  | "bg-surface-border"
  | "color-primary"
  | "color-primary-hover"
  | "color-primary-light"
  | "color-accent"
  | "color-accent-hover"
  // Profit / loss semantics flip with the active theme: terminal-pro uses
  // CN convention (red-up / green-down), cyberpunk uses standard
  // green-up / red-down. Imperative chart code consumes these via
  // `useThemeRgb`.
  | "color-profit"
  | "color-loss"
  | "fg"
  | "fg-muted";

/** A complete token table for a single theme. */
export type ThemeTokens = Record<ThemeTokenName, RgbTriple>;

/**
 * The full definition of a theme — what the registry stores per id.
 */
export interface ThemeDefinition {
  readonly id: ThemeId;
  /** Display label, keyed by locale code. zh / en are required. */
  readonly label: { readonly zh: string; readonly en: string };
  /**
   * The hex string used for the `<meta name="theme-color">` tag — controls
   * the browser/OS chrome (Android URL bar, iOS PWA status bar). Should be
   * the dominant brand color of the theme.
   */
  readonly metaThemeColor: string;
  /** Complete token table. TS will reject the registry entry if any token is missing. */
  readonly tokens: ThemeTokens;
}
