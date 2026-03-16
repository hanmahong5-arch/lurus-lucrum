"use client";

/**
 * i18n Context Provider
 *
 * Provides locale state and translation function to the component tree.
 * Persists locale choice to localStorage.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Locale } from "./index";
import { DEFAULT_LOCALE } from "./index";
import zh, { type TranslationKey } from "./dictionaries/zh";
import en from "./dictionaries/en";

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { zh, en };
const STORAGE_KEY = "gushen-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  // Detect browser language
  const browserLang = navigator.language.slice(0, 2);
  return browserLang === "en" ? "en" : "zh";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return DICTIONARIES[locale][key] ?? DICTIONARIES.zh[key] ?? key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
