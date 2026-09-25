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

export function StatusDot({ status, className }: { status: PlanNodeStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: STATUS_COLOR[status] }}
    />
  );
}
