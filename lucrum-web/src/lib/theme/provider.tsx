/**
 * `<ThemeProvider>` — bridges the registry into React context.
 *
 * Responsibilities:
 *  1. Accept the SSR-resolved theme (`initialTheme` prop) so first paint is
 *     correct on hard refreshes with a cookie set.
 *  2. Reflect every theme change to:
 *       - `<html data-theme="…">` (drives globals.css variable scopes)
 *       - `<meta name="theme-color">` (browser/OS chrome)
 *       - `document.cookie` (persists across reloads, server-readable)
 *       - `localStorage` (fast in-tab resume, survives cookie clears)
 *  3. Stay SSR-safe: all DOM/storage writes are guarded; the server simply
 *     emits the initial theme into context and stops.
 *
 * @module lib/theme/provider
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  isThemeId,
} from "./registry";
import {
  LUCRUM_THEME_COOKIE,
  parseThemeCookie,
  serializeThemeCookie,
} from "./cookie";
import { ThemeContext, type ThemeContextValue } from "./theme-context";
import type { ThemeId } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * localStorage key used for the in-tab cache. Kept distinct from the cookie
 * name so a stale localStorage entry can't poison server reads. The cookie
 * is the authoritative store; localStorage is a hint.
 */
const LOCAL_STORAGE_KEY = "lucrum-theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readLocalStorageTheme(): ThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return isThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeLocalStorageTheme(themeId: ThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, themeId);
  } catch {
    // private mode / quota — ignore
  }
}

function readCookieThemeClient(): ThemeId | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LUCRUM_THEME_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(LUCRUM_THEME_COOKIE.length + 1);
  return isThemeId(value) ? value : null;
}

function applyThemeToDom(themeId: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeId);

  // Keep the OS / browser chrome (Android URL bar, iOS PWA bar) in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = THEMES[themeId].metaThemeColor;
  if (meta) {
    meta.setAttribute("content", color);
  } else {
    const inserted = document.createElement("meta");
    inserted.setAttribute("name", "theme-color");
    inserted.setAttribute("content", color);
    document.head.appendChild(inserted);
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ThemeProviderProps {
  /**
   * The theme id resolved by the server (typically from the cookie). When
   * absent or invalid, falls back to `DEFAULT_THEME_ID`. This MUST match
   * the `data-theme` attribute the server rendered on `<html>`, or the
   * first paint will flicker.
   */
  initialTheme?: ThemeId | string | null | undefined;
  children: ReactNode;
}

export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const seed: ThemeId = isThemeId(initialTheme) ? initialTheme : DEFAULT_THEME_ID;
  const [themeId, setThemeIdState] = useState<ThemeId>(seed);
  const hydratedRef = useRef(false);

  // Post-hydration: prefer cookie, then localStorage, then keep seed. We do
  // this once on mount only — afterwards `setTheme` is the only path that
  // changes state.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const cookieTheme = readCookieThemeClient();
    const storageTheme = readLocalStorageTheme();
    const resolved = cookieTheme ?? storageTheme ?? seed;
    if (resolved !== themeId) {
      setThemeIdState(resolved);
    }
    // Ensure the meta tag exists and matches the active theme — the server
    // may have rendered no meta theme-color (or a stale one).
    applyThemeToDom(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    if (!isThemeId(next)) return;
    setThemeIdState((prev) => {
      if (prev === next) return prev;
      applyThemeToDom(next);
      writeLocalStorageTheme(next);
      if (typeof document !== "undefined") {
        document.cookie = serializeThemeCookie(next);
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, setTheme }),
    [themeId, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Re-exports for convenience (so `@/lib/theme` becomes the one-stop import)
// ---------------------------------------------------------------------------

export { useTheme, type UseThemeResult } from "./use-theme";
export { THEMES, THEME_IDS, DEFAULT_THEME_ID, isThemeId } from "./registry";
export { LUCRUM_THEME_COOKIE, parseThemeCookie } from "./cookie";
export type { ThemeId, ThemeDefinition, ThemeTokenName, RgbTriple } from "./types";
