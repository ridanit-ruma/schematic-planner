import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * One screen inside the workbench: a heading band, then the work.
 *
 * The band is the only place a page says what it is, so every screen reads the
 * same way and nothing has to invent its own arrangement of title, subtitle and
 * button. Width is a choice the caller makes: a list wants the pane, a form
 * wants a column narrow enough to read.
 */
export function Page({
  title,
  description,
  actions,
  width = 'wide',
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  width?: 'wide' | 'narrow';
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto px-6 py-7', width === 'wide' ? 'max-w-5xl' : 'max-w-2xl')}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
          {description === undefined ? null : (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/**
 * A bordered block for one topic — the unit settings screens are built from.
 * Level 2 in the surface stack: a card, not a raised panel.
 */
export function Panel({
  title,
  description,
  tone = 'default',
  children,
}: {
  title: string;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border bg-surface-2 p-4',
        tone === 'danger' ? 'border-danger/30' : 'border-rule',
      )}
    >
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      {description === undefined ? null : (
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
