/**
 * The languages the site is published in.
 *
 * English is served at the root, as it always was, so no existing link breaks;
 * every other language lives under its own prefix. The application speaks the
 * same set and reads the same stored choice (see apps/web/src/i18n/locales.ts),
 * since both are served from one origin.
 */
export const LOCALES = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW'] as const;

export type Locale = (typeof LOCALES)[number];

/** The languages that live under a prefix, by the path segment that names them. */
export const PREFIXED = {
  ko: 'ko',
  ja: 'ja',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
} as const satisfies Record<string, Exclude<Locale, 'en'>>;

export type Prefix = keyof typeof PREFIXED;

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

/** Shared with the application: a choice made on either is a choice made on both. */
export const STORAGE_KEY = 'schematic.locale';

export function prefixOf(locale: Locale): Prefix | null {
  const entry = Object.entries(PREFIXED).find(([, value]) => value === locale);
  return entry === undefined ? null : (entry[0] as Prefix);
}

export function localeOf(prefix: string): Locale | null {
  return prefix in PREFIXED ? PREFIXED[prefix as Prefix] : null;
}

/** A site path in a language: `/docs` in Korean is `/ko/docs`. */
export function localePath(locale: Locale, path: string): string {
  const prefix = prefixOf(locale);
  if (prefix === null) return path;
  return path === '/' ? `/${prefix}/` : `/${prefix}${path}`;
}
