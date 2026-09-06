import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { Problem, Spinner } from '@/components/ui/feedback';
import { plans, type PlanChangeRecord } from '@/lib/api';

/**
 * What each kind of change reads as, with the subject filled in by the caller.
 * The plan's own history is written from the difference between two versions of
 * the document, so this covers edits made in the canvas, over the API and by an
 * agent alike.
 */
function sentence(change: PlanChangeRecord): string {
  const name = change.label === '' ? 'this plan' : change.label;
  switch (change.kind) {
    case 'plan.title':
      return `renamed the plan to ${name}`;
    case 'plan.description':
      return 'wrote the plan description';
    case 'plan.arranged':
      return `moved ${change.detail ?? 'some'} node${change.detail === '1' ? '' : 's'}`;
    case 'node.added':
      return `added ${name}`;
    case 'node.removed':
      return `removed ${name}`;
    case 'node.renamed':
      return `renamed ${change.detail ?? 'a node'} to ${name}`;
    case 'node.status':
      return `set ${name} to ${(change.detail ?? '').split('→').pop()?.trim() ?? 'a new state'}`;
    case 'node.kind':
      return `made ${name} a ${(change.detail ?? '').split('→').pop()?.trim() ?? 'different kind'}`;
    case 'node.body':
      return `wrote in ${name}`;
    case 'node.tags':
      return change.detail === ''
        ? `cleared the tags on ${name}`
        : `tagged ${name} ${change.detail}`;
    case 'edge.added':
      return `connected ${name}`;
    case 'edge.removed':
      return `disconnected ${name}`;
    default:
      return `changed ${name}`;
  }
}

/**
 * Exact to the minute, and no more. A label that rewrote itself every second
 * would blink at the edge of vision; the full moment is on hover.
 */
function when(iso: string): string {
  const at = new Date(iso);
  const today = new Date();
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate();
  return at.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
  });
}

export function HistoryPanel({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [changes, setChanges] = useState<PlanChangeRecord[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    setChanges(null);
    plans
      .changes(planId)
      .then((next) => live && setChanges(next))
      .catch((cause) => live && setError(cause));
    return () => {
      live = false;
    };
  }, [planId]);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-rule bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-medium text-ink">History</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-[2px] text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error !== null ? (
          <div className="p-3">
            <Problem error={error} />
          </div>
        ) : changes === null ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : changes.length === 0 ? (
          <p className="p-3 text-xs text-ink-muted">
            Nothing yet. Every change to this plan is recorded here, whoever makes it.
          </p>
        ) : (
          <ol>
            {changes.map((change) => (
              <li
                key={change.id}
                className="flex gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0"
              >
                <Avatar
                  src={change.by?.avatarUrl}
                  name={change.by?.name ?? '?'}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-ink">
                    <span className="font-medium">{change.by?.name ?? 'Someone'}</span>
                    {change.by?.agent === true ? (
                      <span className="ml-1 border border-rule px-1 text-2xs text-ink-muted">
                        agent
                      </span>
                    ) : null}{' '}
                    {sentence(change)}
                  </p>
                  <Tooltip content={new Date(change.at).toLocaleString()}>
                    <p className="mt-0.5 inline-block text-2xs text-ink-faint">{when(change.at)}</p>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
