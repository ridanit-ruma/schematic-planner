/**
 * The languages the application speaks.
 *
 * English is the source: every other catalog is written against its shape, and
 * the type checker refuses one that is missing a message. Chinese comes twice
 * because Simplified and Traditional are different scripts with different
 * vocabulary, not a font choice.
 */
export const LOCALES = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, so somebody who cannot read the current one can still find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

/**
 * Where a choice is remembered. The marketing site is served from the same
 * origin and writes the same key, so choosing a language on one is choosing it
 * on the other.
 */
export const STORAGE_KEY = 'schematic.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The first supported language in a browser's list of preferences.
 *
 * Chinese is decided by script before region: `zh-Hant` is Traditional wherever
 * it is spoken, and Hong Kong and Macau write Traditional too. A bare `zh`, or
 * any other region, reads Simplified.
 */
export function matchLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const tag = preference.toLowerCase();
    const [language] = tag.split('-');
    if (language === 'zh') {
      if (/-hans\b/.test(tag)) return 'zh-CN';
      return /-(hant|tw|hk|mo)\b/.test(tag) ? 'zh-TW' : 'zh-CN';
    }
    const match = LOCALES.find((locale) => locale.toLowerCase() === language);
    if (match !== undefined) return match;
  }
  return DEFAULT_LOCALE;
}
