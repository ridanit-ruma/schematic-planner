import Link from 'next/link';
import type { ReactNode } from 'react';

import { PAGE_PATHS, type Page } from '@/content';
import { DICTIONARIES, type Dictionary } from '@/i18n/dictionaries';
import { LOCALE_NAMES, LOCALES, localePath, type Locale } from '@/i18n/locales';
import { appUrl } from '@/lib/app-url';
import { REPO_URL } from '@/lib/links';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Mark } from './Mark';

export function SiteChrome({
  locale,
  page,
  children,
}: {
  locale: Locale;
  /** The page being shown, so the language menu can offer the same one. */
  page: Page;
  children: ReactNode;
}) {
  const t = DICTIONARIES[locale];
  const path = (to: string): string => localePath(locale, to);
  const alternates = LOCALES.map((other) => ({
    locale: other,
    name: LOCALE_NAMES[other],
    href: localePath(other, PAGE_PATHS[page]),
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky and translucent: the page scrolls under it rather than pushing
          it away, which is how every tool this sits beside behaves. */}
      <header className="sticky top-0 z-40 border-b border-rule bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5 sm:gap-6 sm:px-6">
          <Link href={path('/')} className="flex shrink-0 items-center gap-2 text-ink">
            <Mark className="size-6" />
            {/* The wordmark is the first thing to go on a narrow screen: the
                mark alone still says which site this is, and the room it frees
                is what keeps the call to action on one line. */}
            <span className="hidden text-sm font-semibold tracking-tight whitespace-nowrap sm:inline">
              Schematic Planner
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-ink-muted sm:gap-4">
            <Link href={path('/guide')} className="hover:text-ink">
              {t.nav.guide}
            </Link>
            <Link href={path('/docs')} className="hover:text-ink">
              {t.nav.docs}
            </Link>
            <a href={REPO_URL} className="hover:text-ink">
              {t.nav.source}
            </a>
          </nav>
          <div className="flex-1" />
          <LanguageSwitcher current={locale} label={t.nav.language} alternates={alternates} />
          <a
            href={appUrl()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover"
          >
            {t.nav.openApp}
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <SiteFooter t={t} path={path} />
    </div>
  );
}

/**
 * The end of the page, and the only place that answers the questions a reader
 * arrives with late: what this is, what it costs them, where the code is, and
 * what they agreed to. Three short columns rather than one line of links,
 * because a line of links says none of it.
 */
function SiteFooter({ t, path }: { t: Dictionary; path: (to: string) => string }) {
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
              {t.footer.about}
            </p>
            <p className="mt-3 text-xs text-ink-faint">{t.footer.status}</p>
          </div>

          <FooterColumn title={t.footer.product}>
            <FooterLink href={path('/guide')}>{t.nav.guide}</FooterLink>
            <FooterLink href={path('/docs')}>{t.footer.connectAgent}</FooterLink>
            <FooterLink href={appUrl()} external>
              {t.nav.openApp}
            </FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.source}>
            <FooterLink href={REPO_URL} external>
              {t.footer.repository}
            </FooterLink>
            <FooterLink href={`${REPO_URL}/issues`} external>
              {t.footer.issues}
            </FooterLink>
            <FooterLink href={`${REPO_URL}/blob/main/README.md`} external>
              {t.footer.runItYourself}
            </FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.legal}>
            <FooterLink href={path('/legal/terms')}>{t.footer.terms}</FooterLink>
            <FooterLink href={path('/legal/privacy')}>{t.footer.privacy}</FooterLink>
            <FooterLink href={`${REPO_URL}/blob/main/LICENSE`} external>
              AGPL-3.0
            </FooterLink>
          </FooterColumn>
        </div>

        <p className="mt-10 border-t border-rule pt-6 text-xs text-ink-faint">{t.footer.closing}</p>
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
