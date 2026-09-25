import type { MetadataRoute } from 'next';

import { PAGE_PATHS } from '@/content';
import { LOCALES, localePath } from '@/i18n/locales';

// A static export has no request to respond to, so this is generated at build.
export const dynamic = 'force-static';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGE_PATHS).flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `${siteUrl}${localePath(locale, path)}`,
      changeFrequency: 'monthly' as const,
      priority: path === '/' ? 1 : 0.6,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((other) => [other, `${siteUrl}${localePath(other, path)}`]),
        ),
      },
    })),
  );
}
