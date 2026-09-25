import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useT, type Messages } from '@/i18n';

import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      role="status"
      aria-label={t.common.loading}
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-rule border-t-accent',
        className,
      )}
    />
  );
}

/** An empty screen is an invitation to act, so it always carries the action. */
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-rule-strong bg-surface-2/40 px-6 py-14 text-center">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">{body}</p>
      {action !== undefined ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Problem({ error }: { error: unknown }) {
  const t = useT();
  const message = error instanceof Error ? error.message : t.common.somethingWentWrong;
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}

/**
 * The screen for an address that leads nowhere you can reach.
 *
 * One screen for two different facts — the thing is not there, and the thing is
 * not yours — because the server already answers both with 404. Telling a
 * stranger that a plan exists but belongs to somebody else is telling them it
 * exists, so the API refuses to distinguish them and a screen that did would
 * give away what the API is protecting.
 *
 * It replaces three silent redirects. An unknown address, a workspace that is
 * not yours and a plan that is not yours each quietly sent you somewhere else,
 * and the canvas did worse: it drew an empty plan called "Untitled plan", which
 * is a drawing of something that is not there.
 */
export type NotFoundSubject = 'page' | 'plan' | 'shared plan' | 'project' | 'folder' | 'workspace';

const NOT_FOUND_TITLE: Record<NotFoundSubject, keyof Messages['ui']['notFound']['title']> = {
  page: 'page',
  plan: 'plan',
  'shared plan': 'sharedPlan',
  project: 'project',
  folder: 'folder',
  workspace: 'workspace',
};

export function NotFound({ subject = 'page' }: { subject?: NotFoundSubject }) {
  const t = useT();

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="slug text-ink-faint">404</p>
        <h1 className="mt-2 text-base font-medium text-ink">
          {t.ui.notFound.title[NOT_FOUND_TITLE[subject]]}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t.ui.notFound.body}</p>
        <Link
          to="/recent"
          className="mt-5 inline-block text-sm text-accent underline underline-offset-2"
        >
          {t.ui.notFound.back}
        </Link>
      </div>
    </div>
  );
}
