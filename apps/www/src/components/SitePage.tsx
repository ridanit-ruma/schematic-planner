import { PAGES, type Page } from '@/content';
import type { Locale } from '@/i18n/locales';
import { SiteChrome } from './SiteChrome';

/** A page of the site in one language, inside the header and footer. */
export function SitePage({ page, locale }: { page: Page; locale: Locale }) {
  const Body = PAGES[page][locale].default;
  return (
    <SiteChrome locale={locale} page={page}>
      <Body />
    </SiteChrome>
  );
}
