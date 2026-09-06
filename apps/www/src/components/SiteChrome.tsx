import Link from 'next/link';
import type { ReactNode } from 'react';

import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { Mark } from './Mark';

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky and translucent: the page scrolls under it rather than pushing
          it away, which is how every tool this sits beside behaves. */}
      <header className="sticky top-0 z-40 border-b border-rule bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5 sm:gap-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-ink">
            <Mark className="size-6" />
            {/* The wordmark is the first thing to go on a narrow screen: the
                mark alone still says which site this is, and the room it frees
                is what keeps the call to action on one line. */}
            <span className="hidden text-sm font-semibold tracking-tight whitespace-nowrap sm:inline">
              Schematic Planner
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-ink-muted sm:gap-4">
            <Link href="/guide" className="hover:text-ink">
              Guide
            </Link>
            <Link href="/docs" className="hover:text-ink">
              Docs
            </Link>
            <a href={REPO_URL} className="hover:text-ink">
              Source
            </a>
          </nav>
          <div className="flex-1" />
          <a
            href={appUrl()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
          >
            Open the app
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}

/**
 * The end of the page, and the only place that answers the questions a reader
 * arrives with late: what this is, what it costs them, where the code is, and
 * what they agreed to. Three short columns rather than one line of links,
 * because a line of links says none of it.
 */
function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <Mark className="size-6" />
              <span className="text-sm font-semibold tracking-tight">Schematic Planner</span>
            </div>
            <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-ink-muted">
              Draw how a system works, edit it with your agent, and take the Markdown with you.
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              Pre-alpha. Self-hosted, and no email is ever sent.
            </p>
          </div>

          <FooterColumn title="Product">
            <FooterLink href="/guide">Guide</FooterLink>
            <FooterLink href="/docs">Connect an agent</FooterLink>
            <FooterLink href={appUrl()} external>
              Open the app
            </FooterLink>
          </FooterColumn>

          <FooterColumn title="Source">
            <FooterLink href={REPO_URL} external>
              Repository
            </FooterLink>
            <FooterLink href={`${REPO_URL}/issues`} external>
              Issues
            </FooterLink>
            <FooterLink href={`${REPO_URL}/blob/main/README.md`} external>
              Run it yourself
            </FooterLink>
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/legal/terms">Terms</FooterLink>
            <FooterLink href="/legal/privacy">Privacy</FooterLink>
            <FooterLink href={`${REPO_URL}/blob/main/LICENSE`} external>
              AGPL-3.0
            </FooterLink>
          </FooterColumn>
        </div>

        <p className="mt-10 border-t border-rule pt-6 text-xs text-ink-faint">
          AGPL-3.0. Run it yourself — the plans stay on your own machine.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="rail-heading">{title}</p>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      {external === true ? (
        <a href={href} className="text-sm text-ink-muted transition-colors hover:text-ink">
          {children}
        </a>
      ) : (
        <Link href={href} className="text-sm text-ink-muted transition-colors hover:text-ink">
          {children}
        </Link>
      )}
    </li>
  );
}
