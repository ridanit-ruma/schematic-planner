import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

import { Document } from '@/components/Document';

export const metadata: Metadata = {
  title: '404 — Schematic Planner',
  robots: { index: false },
};

/**
 * The one not-found page for every language. Each language is its own root
 * layout, so there is no layout above them all for an ordinary not-found page to
 * sit in; this one brings its own document.
 */
export default function GlobalNotFound() {
  return (
    <Document locale="en">
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="text-center">
          <p className="slug text-ink-faint">404</p>
          <h1 className="mt-2 text-base font-medium text-ink">This page could not be found.</h1>
          <Link href="/" className="mt-5 inline-block text-sm text-accent underline">
            Schematic Planner
          </Link>
        </div>
      </main>
    </Document>
  );
}
