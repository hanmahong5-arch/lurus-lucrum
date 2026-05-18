/**
 * Screen-reader announcement helper for theme switches.
 *
 * Wraps the global ARIA live announcer with the Chinese phrasing the rest of
 * the UI uses. Pure side-effect — no return value, safe to call from event
 * handlers without awaiting.
 *
 * @module components/theme/theme-announcer
 */

import { announce } from "@/lib/accessibility/live-region";
import { THEMES } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";

/** Announce the user-facing label of the newly-active theme. */
export function announceThemeChange(themeId: ThemeId): void {
  const label = THEMES[themeId]?.label.zh ?? themeId;
  announce(`已切换到 ${label}`, "polite");
}
