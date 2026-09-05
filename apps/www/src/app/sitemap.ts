import type { MetadataRoute } from 'next';

// A static export has no request to respond to, so this is generated at build.
export const dynamic = 'force-static';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/docs', '/legal/terms', '/legal/privacy'].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
