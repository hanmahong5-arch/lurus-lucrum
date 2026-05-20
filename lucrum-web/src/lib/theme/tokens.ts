/**
 * The canonical, ordered list of semantic token names.
 *
 * Sourced from `ThemeTokenName` (compile-time) and surfaced as a runtime
 * value so iteration (tests, debug overlays, future Tailwind safelist) has
 * a single, ordered, exhaustive list to walk.
 *
 * @module lib/theme/tokens
 */

import type { ThemeTokenName } from "./types";

/**
 * Ordered list of every semantic token name. Order is significant only for
 * test snapshots and debug UIs — the registry is keyed by name, not index.
 */
export const SEMANTIC_TOKENS: readonly ThemeTokenName[] = [
  "bg-void",
  "bg-surface",
  "bg-surface-hover",
  "bg-surface-active",
  "bg-surface-border",
  "color-primary",
  "color-primary-hover",
  "color-primary-light",
  "color-accent",
  "color-accent-hover",
  "color-profit",
  "color-loss",
  "fg",
  "fg-muted",
] as const;
