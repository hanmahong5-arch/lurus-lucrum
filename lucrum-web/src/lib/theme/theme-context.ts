/**
 * The React context object shared by provider and hook.
 *
 * Split into its own file so `provider.tsx` (which has side-effectful
 * useEffect calls) and `use-theme.ts` (read-only) can be imported
 * independently without one pulling in the other's surface.
 *
 * @module lib/theme/theme-context
 */

"use client";

import { createContext } from "react";
import type { ThemeId } from "./types";

export interface ThemeContextValue {
  /** The currently active theme id. */
  themeId: ThemeId;
  /** Switch to another registered theme. Unknown ids are ignored. */
  setTheme: (next: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
