import Link from 'next/link';
import type { ReactNode } from 'react';

import { appUrl } from '@/lib/app-url';
import { Mark } from './Mark';

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky and translucent: the page scrolls under it rather than pushing
          it away, which is how every tool this sits beside behaves. */}
      <header className="sticky top-0 z-40 border-b border-rule bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <Mark className="size-6" />
            <span className="text-sm font-semibold tracking-tight">Schematic Planner</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-ink-muted">
            <Link href="/guide" className="hover:text-ink">
              Guide
            </Link>
            <Link href="/docs" className="hover:text-ink">
              Docs
            </Link>
            <a
              href="https://github.com/schematic-planner/schematic-planner"
              className="hover:text-ink"
            >
              Source
            </a>
          </nav>
          <div className="flex-1" />
          <a
            href={appUrl()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
          >
            Open the app
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-xs text-ink-muted">
          <span>AGPL-3.0. Run it yourself.</span>
          <Link href="/legal/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
