"use client";

/**
 * Locale Switcher
 *
 * Compact language toggle for the dashboard header or settings.
 */

import { useI18n } from "@/lib/i18n/context";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded-md transition"
      title={`Switch to ${locale === "zh" ? "English" : "中文"}`}
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{LOCALE_LABELS[locale]}</span>
    </button>
  );
}
