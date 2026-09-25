import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { pageMetadata } from '@/components/Document';
import type { Page } from '@/content';
import { localeOf, type Locale } from '@/i18n/locales';

export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/** The language a prefixed route was built for; the layout has already refused any other. */
export async function routeLocale({ params }: LocaleParams): Promise<Locale> {
  const locale = localeOf((await params).locale);
  if (locale === null) notFound();
  return locale;
}

export function localizedMetadata(page: Page) {
  return async (props: LocaleParams): Promise<Metadata> =>
    pageMetadata(page, await routeLocale(props));
}
