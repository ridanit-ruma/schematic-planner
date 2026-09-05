import type { PlanNodeStatus } from '@schematic/schema';

import { cn } from '@/lib/utils';

/** Status is the one place colour carries meaning, so the mapping lives once. */
export const STATUS_COLOR: Record<PlanNodeStatus, string> = {
  idea: 'var(--status-idea)',
  planned: 'var(--status-planned)',
  in_progress: 'var(--status-progress)',
  blocked: 'var(--status-blocked)',
  done: 'var(--status-done)',
  dropped: 'var(--status-dropped)',
};

export const STATUS_LABEL: Record<PlanNodeStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  dropped: 'Dropped',
};

export function StatusDot({ status, className }: { status: PlanNodeStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: STATUS_COLOR[status] }}
    />
  );
}

export function StatusTally({ counts }: { counts: Partial<Record<PlanNodeStatus, number>> }) {
  const entries = (Object.keys(STATUS_LABEL) as PlanNodeStatus[])
    .map((status) => [status, counts[status] ?? 0] as const)
    .filter(([, count]) => count > 0);

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {entries.map(([status, count]) => (
        <span key={status} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <StatusDot status={status} />
          {count}
          <span className="sr-only">{STATUS_LABEL[status]}</span>
        </span>
      ))}
    </div>
  );
}
