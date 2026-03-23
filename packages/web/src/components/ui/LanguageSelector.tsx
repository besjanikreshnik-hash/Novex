'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

export function LanguageSelector({ compact = true }: { compact?: boolean }) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0]!;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg transition-colors',
          compact
            ? 'px-2 py-1.5 text-sm hover:bg-dark-700'
            : 'px-3 py-2 text-sm border border-nvx-border bg-nvx-bg-primary hover:border-nvx-border-light',
        )}
      >
        <span className="text-base leading-none">{current.flag}</span>
        {!compact && <span className="text-nvx-text-primary">{current.name}</span>}
        <ChevronDown size={12} className="text-text-tertiary" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-dark-800 border border-border rounded-xl shadow-2xl py-1 z-50 animate-slide-down">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLocale(l.code as Locale);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors',
                l.code === locale
                  ? 'text-novex-primary bg-novex-primary-light'
                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-700',
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
