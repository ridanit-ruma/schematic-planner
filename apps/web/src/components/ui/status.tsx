import { cn } from '@/lib/utils';

/**
 * The built-in statuses' colours, for chrome that shows them outside a plan.
 * A plan's own cards are coloured from its project's vocabulary instead; see
 * `vocabulary.tsx`.
 */
export const STATUS_COLOR: Record<string, string> = {
  idea: 'var(--status-idea)',
  planned: 'var(--status-planned)',
  in_progress: 'var(--status-progress)',
  blocked: 'var(--status-blocked)',
  done: 'var(--status-done)',
  dropped: 'var(--status-dropped)',
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: STATUS_COLOR[status] ?? 'var(--ink-faint)' }}
    />
  );
}
