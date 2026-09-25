import type { ComponentType } from 'react';

import type { Locale } from '@/i18n/locales';
import type { PageMeta } from './types';

import * as docsEn from './docs/en';
import * as docsJa from './docs/ja';
import * as docsKo from './docs/ko';
import * as docsZhCN from './docs/zh-CN';
import * as docsZhTW from './docs/zh-TW';
import * as guideEn from './guide/en';
import * as guideJa from './guide/ja';
import * as guideKo from './guide/ko';
import * as guideZhCN from './guide/zh-CN';
import * as guideZhTW from './guide/zh-TW';
import * as homeEn from './home/en';
import * as homeJa from './home/ja';
import * as homeKo from './home/ko';
import * as homeZhCN from './home/zh-CN';
import * as homeZhTW from './home/zh-TW';
import * as privacyEn from './privacy/en';
import * as privacyJa from './privacy/ja';
import * as privacyKo from './privacy/ko';
import * as privacyZhCN from './privacy/zh-CN';
import * as privacyZhTW from './privacy/zh-TW';
import * as termsEn from './terms/en';
import * as termsJa from './terms/ja';
import * as termsKo from './terms/ko';
import * as termsZhCN from './terms/zh-CN';
import * as termsZhTW from './terms/zh-TW';

interface PageContent {
  meta: PageMeta;
  default: ComponentType;
}

/**
 * Every page in every language. Long-form writing is translated as a whole page
 * rather than string by string: a paragraph is the unit a translator works in,
 * and a sentence cut into keys cannot be reordered to read naturally.
 */
export const PAGES = {
  home: { en: homeEn, ko: homeKo, ja: homeJa, 'zh-CN': homeZhCN, 'zh-TW': homeZhTW },
  guide: { en: guideEn, ko: guideKo, ja: guideJa, 'zh-CN': guideZhCN, 'zh-TW': guideZhTW },
  docs: { en: docsEn, ko: docsKo, ja: docsJa, 'zh-CN': docsZhCN, 'zh-TW': docsZhTW },
  terms: { en: termsEn, ko: termsKo, ja: termsJa, 'zh-CN': termsZhCN, 'zh-TW': termsZhTW },
  privacy: {
    en: privacyEn,
    ko: privacyKo,
    ja: privacyJa,
    'zh-CN': privacyZhCN,
    'zh-TW': privacyZhTW,
  },
} satisfies Record<string, Record<Locale, PageContent>>;

export type Page = keyof typeof PAGES;

/** Where each page lives, before a language prefix is added. */
export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  guide: '/guide',
  docs: '/docs',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
};
