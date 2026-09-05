import Link from 'next/link';
import type { ReactNode } from 'react';

const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:5173';

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-12 max-w-4xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <svg viewBox="0 0 24 16" className="h-3.5 w-5.5" aria-hidden>
              <rect x="0.5" y="2.5" width="7" height="11" fill="none" stroke="currentColor" />
              <rect x="16.5" y="2.5" width="7" height="11" fill="none" stroke="currentColor" />
              <path d="M8 8 H15" stroke="currentColor" fill="none" />
              <path d="M13 5.5 L16 8 L13 10.5" fill="currentColor" />
            </svg>
            <span className="text-sm font-semibold tracking-tight">Schematic Planner</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-ink-muted">
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
            href={appUrl}
            className="rounded-[2px] bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink"
          >
            Open the app
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-xs text-ink-muted">
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
