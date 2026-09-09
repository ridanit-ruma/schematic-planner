import { ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Author } from '@/components/ui/author';
import { Avatar } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { Problem, Spinner } from '@/components/ui/feedback';
import { plans, type PlanChangeRecord } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SIDE_PANEL } from './side-panel';

/**
 * What each kind of change reads as, with the subject filled in by the caller.
 * The plan's own history is written from the difference between two versions of
 * the document, so this covers edits made in the canvas, over the API and by an
 * agent alike.
 */
function sentence(change: PlanChangeRecord): string {
  const name = change.label === '' ? 'this plan' : change.label;
  switch (change.kind) {
    case 'plan.created':
      return change.detail === null
        ? 'started this plan'
        : `started this plan with ${change.detail} nodes`;
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
 * One act, and every entry it produced.
 *
 * A single call can add forty nodes. Those are forty true entries and none of
 * them is worth a line of its own, so a batch past FOLD_AT is written as what
 * it did to the plan and opens to the entries underneath.
 */
interface Batch {
  id: string;
  changes: PlanChangeRecord[];
}

const FOLD_AT = 5;

function batches(changes: readonly PlanChangeRecord[]): Batch[] {
  const out: Batch[] = [];
  for (const change of changes) {
    const last = out.at(-1);
    // Entries recorded before batches existed have no id, and two of those are
    // not the same act — they each stand alone.
    const same = last !== undefined && change.batchId !== null && last.id === change.batchId;
    if (same) last.changes.push(change);
    else out.push({ id: change.batchId ?? change.id, changes: [change] });
  }
  return out;
}

/**
 * What a batch did, counted rather than listed: `+41 nodes, +62 connections`.
 *
 * Additions and removals are kept apart because they answer different
 * questions, and everything that is neither — a rename, a status, a body — is
 * one number at the end, since naming each would be the list this replaces.
 */
function summary(changes: readonly PlanChangeRecord[]): string {
  const tally = { node: { added: 0, removed: 0 }, edge: { added: 0, removed: 0 }, other: 0 };
  for (const change of changes) {
    if (change.kind === 'node.added') tally.node.added += 1;
    else if (change.kind === 'node.removed') tally.node.removed += 1;
    else if (change.kind === 'edge.added') tally.edge.added += 1;
    else if (change.kind === 'edge.removed') tally.edge.removed += 1;
    else tally.other += 1;
  }

  const counted = (count: { added: number; removed: number }, noun: string): string | null => {
    const parts = [
      count.added > 0 ? `+${count.added}` : null,
      count.removed > 0 ? `−${count.removed}` : null,
    ].filter((part) => part !== null);
    if (parts.length === 0) return null;
    const total = count.added + count.removed;
    return `${parts.join(' ')} ${total === 1 ? noun : `${noun}s`}`;
  };

  const parts = [
    counted(tally.node, 'node'),
    counted(tally.edge, 'connection'),
    tally.other > 0 ? `${tally.other} edit${tally.other === 1 ? '' : 's'}` : null,
  ].filter((part) => part !== null);

  return parts.length === 0 ? 'made some changes' : parts.join(', ');
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
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

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

  const grouped = useMemo(() => batches(changes ?? []), [changes]);

  const toggle = (id: string): void => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-medium text-ink">History</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
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
        ) : grouped.length === 0 ? (
          <p className="p-3 text-xs text-ink-muted">
            Nothing yet. Every change to this plan is recorded here, whoever makes it.
          </p>
        ) : (
          <ol>
            {grouped.map((batch) =>
              batch.changes.length < FOLD_AT ? (
                batch.changes.map((change) => (
                  <Entry key={change.id} change={change} line={sentence(change)} />
                ))
              ) : (
                <Entry
                  key={batch.id}
                  change={batch.changes[0] as PlanChangeRecord}
                  line={summary(batch.changes)}
                  onOpen={() => toggle(batch.id)}
                  isOpen={open.has(batch.id)}
                >
                  {open.has(batch.id) ? (
                    <ol className="mt-1.5 border-l border-rule pl-2">
                      {batch.changes.map((change) => (
                        <li key={change.id} className="py-0.5 text-2xs leading-snug text-ink-muted">
                          {sentence(change)}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </Entry>
              ),
            )}
          </ol>
        )}
      </div>
    </aside>
  );
}

function Entry({
  change,
  line,
  onOpen,
  isOpen,
  children,
}: {
  change: PlanChangeRecord;
  line: string;
  onOpen?: () => void;
  isOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0">
      <Avatar
        src={change.by?.avatarUrl}
        name={change.by?.agent ?? change.by?.name ?? '?'}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-ink">
          <Author by={change.by} /> {line}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <Tooltip content={new Date(change.at).toLocaleString()}>
            <span className="text-2xs text-ink-faint">{when(change.at)}</span>
          </Tooltip>
          {onOpen === undefined ? null : (
            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-0.5 text-2xs text-ink-faint transition-colors hover:text-ink"
            >
              <ChevronRight
                aria-hidden
                className={cn('size-3 transition-transform', isOpen === true && 'rotate-90')}
              />
              {isOpen === true ? 'Fewer' : 'Each one'}
            </button>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}
