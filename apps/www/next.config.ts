import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

// Next reads .env from its own directory, but the repository keeps one at the
// root. Without this the NEXT_PUBLIC_* values silently fall back to their
// localhost defaults and a built site points at nothing.
for (const candidate of ['../../.env', '.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) process.loadEnvFile(path);
}

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
  // Named explicitly so a missing value fails visibly at build rather than
  // being inlined as the development default.
  env: {
    NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000',
    // Empty rather than a hostname: the components fall back to a relative
    // path, which works on whatever origin the built site is served from.
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'] ?? '',
  },
};

export default config;
