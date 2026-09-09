import type { ChangeAuthor } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Who made a change.
 *
 * A key acts for the person who issued it, and naming only one of the two is
 * wrong in both directions: the person alone reads as somebody at a keyboard,
 * and the key alone hides whose permission it was working under. So an agent's
 * work is written under the key's own name, with the person after it.
 */
export function Author({
  by,
  className,
}: {
  by: Pick<ChangeAuthor, 'name' | 'agent'> | null;
  className?: string;
}) {
  if (by === null) return <span className={cn('text-ink-faint', className)}>Someone</span>;
  if (by.agent === null) return <span className={cn('font-medium', className)}>{by.name}</span>;

  return (
    <span className={cn('min-w-0', className)}>
      <span className="font-medium text-collab">{by.agent}</span>
      <span className="text-ink-muted"> · via {by.name}</span>
    </span>
  );
}
