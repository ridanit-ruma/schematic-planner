import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The marketing site is static: every page here is content, and nothing on it
  // needs a server at request time.
  output: 'export',
  // Emits guide/index.html rather than guide.html, so a plain static server —
  // any bucket, any nginx, python's http.server — resolves /guide without being
  // taught to try an .html suffix.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
