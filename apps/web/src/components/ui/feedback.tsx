import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
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
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-muted">{body}</p>
      {action !== undefined ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Problem({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div
      role="alert"
      className="rounded-[2px] border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}
