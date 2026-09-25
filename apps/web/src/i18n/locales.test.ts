import { describe, expect, it } from 'vitest';

import { matchLocale } from './locales';

describe('matchLocale', () => {
  it('takes the first language it speaks, in the order the browser prefers', () => {
    expect(matchLocale(['fr-FR', 'ja-JP', 'ko-KR'])).toBe('ja');
    expect(matchLocale(['ko'])).toBe('ko');
    expect(matchLocale(['en-GB', 'ko'])).toBe('en');
  });

  it('falls back to English when it speaks none of them', () => {
    expect(matchLocale(['fr-FR', 'de'])).toBe('en');
    expect(matchLocale([])).toBe('en');
  });

  it('reads Chinese by script first and region second', () => {
    expect(matchLocale(['zh-CN'])).toBe('zh-CN');
    expect(matchLocale(['zh'])).toBe('zh-CN');
    expect(matchLocale(['zh-SG'])).toBe('zh-CN');
    expect(matchLocale(['zh-Hans-HK'])).toBe('zh-CN');
    expect(matchLocale(['zh-TW'])).toBe('zh-TW');
    expect(matchLocale(['zh-HK'])).toBe('zh-TW');
    expect(matchLocale(['zh-Hant'])).toBe('zh-TW');
  });
});
