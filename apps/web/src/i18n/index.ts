import { create } from 'zustand';

import { DEFAULT_LOCALE, isLocale, matchLocale, STORAGE_KEY, type Locale } from './locales';
import { en, type Messages } from './messages/en';

export { LOCALE_NAMES, LOCALES, type Locale } from './locales';
export type { Messages } from './messages/en';

/**
 * English ships with the bundle, since it is the fallback and the language the
 * tests read. Every other catalog is fetched only by somebody who needs it.
 */
const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => Promise.resolve(en),
  ko: () => import('./messages/ko').then((module) => module.ko),
  ja: () => import('./messages/ja').then((module) => module.ja),
  'zh-CN': () => import('./messages/zh-CN').then((module) => module.zhCN),
  'zh-TW': () => import('./messages/zh-TW').then((module) => module.zhTW),
};

interface I18nState {
  locale: Locale;
  messages: Messages;
  /** Loads a language, switches to it and remembers the choice. */
  setLocale: (locale: Locale) => Promise<void>;
}

// Which choice is the latest. Catalogs arrive in any order, and one picked a
// moment ago must not land on top of the one picked after it.
let latest = 0;

export const useI18n = create<I18nState>((set) => ({
  locale: DEFAULT_LOCALE,
  messages: en,
  setLocale: async (locale) => {
    const request = ++latest;
    let messages: Messages;
    try {
      messages = await loaders[locale]();
    } catch {
      // Same case as initI18n: a deploy replaced the chunk under an open tab.
      // The screen stays in the language it is in rather than breaking.
      return;
    }
    if (request !== latest) return;
    remember(locale);
    apply(locale);
    set({ locale, messages });
  },
}));

/** The catalog for the current language, in a component. */
export function useT(): Messages {
  return useI18n((state) => state.messages);
}

export function useLocale(): Locale {
  return useI18n((state) => state.locale);
}

/**
 * The catalog outside a component — a store, a formatter, an error built far
 * from any screen. It does not re-render anything when the language changes, so
 * a component reads through `useT` instead.
 */
export function t(): Messages {
  return useI18n.getState().messages;
}

export function currentLocale(): Locale {
  return useI18n.getState().locale;
}

/**
 * The tag to format dates and numbers with: the current language, in the
 * reader's own region when their browser names one. English stays day-first
 * for somebody in Britain, as it was before the application spoke anything
 * else; a region belonging to another language is not borrowed.
 */
export function formatLocale(locale: Locale = currentLocale()): string {
  const tags = navigator.languages ?? [navigator.language];
  // matchLocale answers English for a language it does not speak, so the
  // language itself has to agree too, or English takes a German tag.
  const language = locale.split('-')[0]?.toLowerCase();
  return (
    tags.find(
      (tag) => tag.split('-')[0]?.toLowerCase() === language && matchLocale([tag]) === locale,
    ) ?? locale
  );
}

/**
 * Picks the language before the first paint: a choice made earlier, here or on
 * the marketing site, and otherwise whatever the browser asks for. Resolved
 * before rendering so the screen never draws in English and then changes.
 */
export async function initI18n(): Promise<void> {
  const wanted = recall() ?? matchLocale(navigator.languages ?? [navigator.language]);
  // A catalog that fails to load (a deploy replaced the chunk under an open
  // tab) leaves the application in English rather than not starting at all.
  const [locale, messages] = await loaders[wanted]()
    .then((loaded): [Locale, Messages] => [wanted, loaded])
    .catch((): [Locale, Messages] => [DEFAULT_LOCALE, en]);
  apply(locale);
  useI18n.setState({ locale, messages });
}

function apply(locale: Locale): void {
  document.documentElement.lang = locale;
}

// Storage can be missing or refuse (a private window, a blocked site), and a
// language is not worth failing over: without it the browser's preference
// decides every time instead.
function recall(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function remember(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // See recall().
  }
}
