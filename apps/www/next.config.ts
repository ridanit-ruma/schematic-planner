import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The marketing site is static: every page here is content, and nothing on it
  // needs a server at request time.
  output: 'export',
  images: { unoptimized: true },
};

export default config;
