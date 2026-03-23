'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  translations,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type Translation,
} from './translations';

const STORAGE_KEY = 'novex_locale';

/* ─── Context shape ──────────────────────────────────────────────── */

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Translation) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/* ─── Detect browser language ────────────────────────────────────── */

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
  const supported = SUPPORTED_LOCALES.find((l) => l.code === browserLang);
  return supported ? supported.code : DEFAULT_LOCALE;
}

/* ─── Provider ───────────────────────────────────────────────────── */

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate locale from localStorage or browser preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && translations[stored]) {
      setLocaleState(stored);
    } else {
      setLocaleState(detectBrowserLocale());
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: keyof Translation): string => {
      const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
      return dict[key] ?? key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  // Avoid flash of wrong language on SSR — render children only after hydration
  if (!hydrated) {
    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
  }

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/* ─── Hook ───────────────────────────────────────────────────────── */

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
