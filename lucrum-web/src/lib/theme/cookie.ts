/**
 * Cookie helpers for theme persistence.
 *
 * Theme is stored in BOTH a cookie and localStorage:
 *  - cookie: read by the server during SSR so the first painted HTML carries
 *    the correct `data-theme` attribute → no FOUC on hard refresh
 *  - localStorage: read by the client for fast resumes inside a single tab
 *
 * The cookie is set client-side after every `setTheme` call. It is `path=/`,
 * `SameSite=Lax`, 1-year expiry. No PII, no privacy concerns.
 *
 * @module lib/theme/cookie
 */

import { DEFAULT_THEME_ID, isThemeId } from "./registry";
import type { ThemeId } from "./types";

/** Cookie name used to persist theme preference. */
export const LUCRUM_THEME_COOKIE = "lucrum-theme";

/** Cookie max-age in seconds (1 year). */
export const LUCRUM_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Parse a single cookie value (e.g. from `cookies().get(...).value` on the
 * server, or from a manual `document.cookie` parse on the client). Falls
 * back to `DEFAULT_THEME_ID` if the value is missing or unrecognized.
 */
export function parseThemeCookie(raw: string | undefined | null): ThemeId {
  if (typeof raw !== "string") return DEFAULT_THEME_ID;
  const trimmed = raw.trim();
  return isThemeId(trimmed) ? trimmed : DEFAULT_THEME_ID;
}

/**
 * Serialize a theme id into a `Set-Cookie`-style string. Used client-side
 * via `document.cookie = serializeThemeCookie(theme)`; the cookie attributes
 * mirror what middleware would set if we ever moved this server-side.
 */
export function serializeThemeCookie(themeId: ThemeId): string {
  return [
    `${LUCRUM_THEME_COOKIE}=${themeId}`,
    `Path=/`,
    `Max-Age=${LUCRUM_THEME_COOKIE_MAX_AGE}`,
    `SameSite=Lax`,
  ].join("; ");
}
