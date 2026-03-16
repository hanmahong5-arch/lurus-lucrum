/**
 * Lightweight i18n System
 *
 * Simple key-value translation system for gushen-web.
 * Supports zh (Chinese) and en (English) locales.
 * No external library dependency — just React context + JSON dictionaries.
 */

export type Locale = "zh" | "en";

export const DEFAULT_LOCALE: Locale = "zh";

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};
