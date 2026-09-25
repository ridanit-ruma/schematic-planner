'use client';

import { STORAGE_KEY, type Locale } from '@/i18n/locales';

export interface Alternate {
  locale: Locale;
  name: string;
  href: string;
}

/**
 * The same page in another language.
 *
 * Choosing one is remembered, on the same key the application reads, so the
 * language picked here is the one the app opens in — and English picked here
 * stops the site sending a Korean browser to the Korean pages.
 */
export function LanguageSwitcher({
  current,
  label,
  alternates,
}: {
  current: Locale;
  label: string;
  alternates: readonly Alternate[];
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 text-sm text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path
            d="M1.75 8h12.5M8 1.75c1.9 1.8 2.8 3.9 2.8 6.25S9.9 12.45 8 14.25M8 1.75C6.1 3.55 5.2 5.65 5.2 8s.9 4.45 2.8 6.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </svg>
      </summary>
      <ul className="absolute right-0 z-50 mt-2 min-w-36 rounded-lg border border-rule bg-surface-2 p-1 shadow-lg">
        {alternates.map((alternate) => (
          <li key={alternate.locale}>
            <a
              href={alternate.href}
              hrefLang={alternate.locale}
              lang={alternate.locale}
              aria-current={alternate.locale === current ? 'page' : undefined}
              onClick={() => remember(alternate.locale)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink aria-[current=page]:text-ink"
            >
              {alternate.name}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function remember(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage refused (a private window, a blocked site): the link still works,
    // it just is not remembered.
  }
}
