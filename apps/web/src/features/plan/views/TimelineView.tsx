import {
  dueDate,
  isSettled,
  timelineBuckets,
  type PlanNode,
  type Vocabulary,
} from '@schematic/schema';
import { useMemo } from 'react';

import { Pill, statusColor, statusLabel } from '@/components/ui/vocabulary';
import { formatLocale, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** Today as `YYYY-MM-DD` in the reader's own day, which is what a due date means to them. */
function today(): string {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
}

/**
 * The plan's work by when it is due, from `meta.due`.
 *
 * A date is a note on the node, not a schedule this product keeps: it is set in
 * the inspector, travels in the export's frontmatter, and an agent writes it the
 * same way. Work without one is listed at the end, never left out.
 */
export function TimelineView({
  nodes,
  vocabulary,
  selected,
  onSelect,
}: {
  nodes: readonly PlanNode[];
  vocabulary: Vocabulary;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const t = useT();
  const locale = formatLocale(useLocale());
  const buckets = useMemo(() => timelineBuckets(nodes, vocabulary), [nodes, vocabulary]);
  const now = today();
  const month = (key: string): string =>
    new Date(`${key}-01T00:00:00`).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    });
  const day = (due: string): string =>
    new Date(`${due}T00:00:00`).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });

  if (buckets.length === 0) {
    return <p className="p-6 text-sm text-ink-muted">{t.plan.views.empty}</p>;
  }
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
      {buckets.map((bucket) => (
        <section key={bucket.month ?? ''}>
          <h2 className="rail-heading mb-2 px-1">
            {bucket.month === null ? t.plan.views.noDate : month(bucket.month)}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-rule bg-surface-2">
            {bucket.nodes.map((node) => {
              const due = dueDate(node);
              const overdue = due !== null && due < now && !isSettled(vocabulary, node.status);
              return (
                <li key={node.slug} className="border-b border-rule/60 last:border-b-0">
                  <button
                    type="button"
                    aria-current={node.slug === selected ? 'true' : undefined}
                    onClick={() => onSelect(node.slug)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-3"
                  >
                    <span
                      className={cn(
                        'w-16 shrink-0 text-xs tabular-nums',
                        overdue ? 'text-danger' : 'text-ink-muted',
                      )}
                    >
                      {due === null ? '—' : day(due)}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-ink',
                        node.slug === selected && 'font-medium text-accent',
                      )}
                    >
                      {node.title}
                    </span>
                    <Pill color={statusColor(vocabulary, node.status)} className="shrink-0">
                      {statusLabel(t, vocabulary, node.status)}
                    </Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
