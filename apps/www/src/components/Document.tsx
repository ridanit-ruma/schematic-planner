import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PAGE_PATHS, PAGES, type Page } from '@/content';
import { DICTIONARIES } from '@/i18n/dictionaries';
import { LOCALES, localePath, PREFIXED, STORAGE_KEY, type Locale } from '@/i18n/locales';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/**
 * The page shell for one language. Each language is its own root layout, so the
 * `lang` attribute is right in the HTML a crawler receives rather than patched
 * in by script afterwards.
 */
export function Document({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale}>
      <head>
        {locale === 'en' ? <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

/** What every page in a language shares: the title pattern, the card, the icon. */
export function siteMetadata(locale: Locale): Metadata {
  const t = DICTIONARIES[locale];
  const home = PAGES.home[locale].meta;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: home.title, template: '%s — Schematic Planner' },
    description: home.description,
    openGraph: {
      type: 'website',
      url: localePath(locale, '/'),
      siteName: 'Schematic Planner',
      title: 'Schematic Planner',
      description: t.site.tagline,
      locale: locale.replace('-', '_'),
      // A drawing is what this product makes, so the card shows one rather than
      // describing it. Served from the site root, which is also where the
      // application's own shell points: one file, one copy.
      images: [{ url: '/og.png', width: 1440, height: 900, alt: t.site.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Schematic Planner',
      description: t.site.tagline,
      images: ['/og.png'],
    },
    robots: { index: true, follow: true },
    icons: { icon: '/icon.svg' },
  };
}

/** One page's own title and description, and where it lives in every other language. */
export function pageMetadata(page: Page, locale: Locale): Metadata {
  const { title, description } = PAGES[page][locale].meta;
  return {
    // The landing page's title is the site's full name, not a section of it.
    title: page === 'home' ? { absolute: title } : title,
    description,
    alternates: {
      canonical: localePath(locale, PAGE_PATHS[page]),
      languages: {
        ...Object.fromEntries(LOCALES.map((other) => [other, localePath(other, PAGE_PATHS[page])])),
        'x-default': PAGE_PATHS[page],
      },
    },
  };
}

/**
 * Sends a reader of the English pages to their own language, before the first
 * paint: a choice they made earlier (here or in the application), otherwise the
 * first language their browser asks for that the site has. Picking English from
 * the language menu stores `en`, which ends it.
 *
 * Only the English pages do this, and only for pages every language has: a link
 * to /ko/ is somebody's deliberate choice, and a missing page stays a 404.
 * Crawlers do not carry a stored choice and ask in English, so they index each
 * language at its own address.
 *
 * Chinese is read the way the application reads it (apps/web/src/i18n/locales.ts):
 * script before region, Hong Kong and Macau as Traditional.
 */
const REDIRECT_SCRIPT = `(function () {
  try {
    var prefixes = ${JSON.stringify(
      Object.fromEntries(Object.entries(PREFIXED).map(([prefix, locale]) => [locale, prefix])),
    )};
    var pages = ${JSON.stringify(Object.values(PAGE_PATHS))};
    var path = location.pathname.replace(/\\/+$/, '') || '/';
    if (pages.indexOf(path) === -1) return;
    var wanted = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (!wanted) {
      var asked = navigator.languages || [navigator.language];
      for (var i = 0; i < asked.length && !wanted; i++) {
        var tag = String(asked[i]).toLowerCase();
        var language = tag.split('-')[0];
        if (language === 'zh') {
          wanted = /-hans\\b/.test(tag) ? 'zh-CN' : /-(hant|tw|hk|mo)\\b/.test(tag) ? 'zh-TW' : 'zh-CN';
        } else if (language === 'en') {
          wanted = 'en';
        } else if (language === 'ko' || language === 'ja') {
          wanted = language;
        }
      }
    }
    var prefix = wanted && prefixes[wanted];
    if (prefix) location.replace('/' + prefix + (path === '/' ? '/' : path + '/') + location.search + location.hash);
  } catch (e) {}
})();`;
