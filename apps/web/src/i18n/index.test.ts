import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A catalog that arrives only when the test says so, and one that never arrives.
const slow = vi.hoisted(() => {
  let release = (): void => undefined;
  const arrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { arrived, release: () => release() };
});
vi.mock('./messages/ja', async () => {
  await slow.arrived;
  return { ja: { marker: 'ja' } };
});
vi.mock('./messages/zh-TW', () => {
  throw new Error('chunk replaced by a deploy');
});

import { formatLocale, useI18n } from './index';

beforeEach(() => {
  vi.stubGlobal('document', { documentElement: { lang: 'en' } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const browserAsks = (languages: string[]): void => {
  vi.stubGlobal('navigator', { languages, language: languages[0] });
};

describe('formatLocale', () => {
  it('keeps the reader region when it belongs to the language', () => {
    browserAsks(['en-GB']);
    expect(formatLocale('en')).toBe('en-GB');
    browserAsks(['zh-HK']);
    expect(formatLocale('zh-TW')).toBe('zh-HK');
  });

  /*
   * A language the application does not speak is matched to English by
   * `matchLocale`, so English used to take the first tag of any language and
   * an English screen showed German dates.
   */
  it('does not borrow the region of a language it does not speak', () => {
    browserAsks(['de-DE', 'en-US']);
    expect(formatLocale('en')).toBe('en-US');
    browserAsks(['de-DE']);
    expect(formatLocale('en')).toBe('en');
  });
});

describe('setLocale', () => {
  it('ends on the last language chosen, whichever catalog arrives last', async () => {
    const first = useI18n.getState().setLocale('ja');
    await useI18n.getState().setLocale('ko');
    slow.release();
    await first;
    expect(useI18n.getState().locale).toBe('ko');
  });

  it('stays on the current language when a catalog cannot be loaded', async () => {
    await useI18n.getState().setLocale('ko');
    await expect(useI18n.getState().setLocale('zh-TW')).resolves.toBeUndefined();
    expect(useI18n.getState().locale).toBe('ko');
  });
});
