import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Schematic Planner — plan in the browser, own the output',
    template: '%s — Schematic Planner',
  },
  description:
    'Turn a written plan into a graph you and your AI agent both edit, then export it as Markdown files and an Obsidian Canvas. Open source, self-hostable.',
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Schematic Planner',
    title: 'Schematic Planner',
    description: 'Plan in the browser. Own the output.',
    // A drawing is what this product makes, so the card shows one rather than
    // describing it. Served from the site root, which is also where the
    // application's own shell points: one file, one copy.
    images: [{ url: '/og.png', width: 1440, height: 900, alt: 'A plan on the canvas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Schematic Planner',
    description: 'Plan in the browser. Own the output.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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
