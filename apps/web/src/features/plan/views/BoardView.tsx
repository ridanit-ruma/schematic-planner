import { boardColumns, type PlanNode, type PlanOp, type Vocabulary } from '@schematic/schema';
import { useMemo, useState } from 'react';

import {
  Pill,
  kindLabel,
  paletteVar,
  statusName,
  tagColor,
  UNKNOWN_COLOR,
} from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** What a dragged card carries, so a drop from anywhere else is not mistaken for one. */
const CARD_TYPE = 'application/x-schematic-node';

/**
 * The plan's work in columns by status.
 *
 * Moving a card to another column is the same write the inspector's status
 * picker makes, so the canvas and everyone else see it the moment it lands.
 * Dragging is the shortcut, not the only way: a card opens the inspector, and
 * the picker there works from the keyboard.
 */
export function BoardView({
  nodes,
  vocabulary,
  selected,
  readOnly,
  onSelect,
  onApplyOps,
}: {
  nodes: readonly PlanNode[];
  vocabulary: Vocabulary;
  selected: string | null;
  readOnly: boolean;
  onSelect: (slug: string) => void;
  onApplyOps: (ops: PlanOp[]) => void;
}) {
  const t = useT();
  const columns = useMemo(() => boardColumns(nodes, vocabulary), [nodes, vocabulary]);
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
      {columns.map(({ status, nodes: cards }) => {
        // The column of undefined statuses takes no drops: there is no one status to set.
        const target = readOnly || status === null ? null : status.id;
        return (
          <section
            key={status?.id ?? ''}
            aria-label={status === null ? t.plan.views.otherStatuses : statusName(t, status)}
            onDragOver={(event) => {
              if (target === null || !event.dataTransfer.types.includes(CARD_TYPE)) return;
              event.preventDefault();
              setOver(target);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              setOver(null);
              const slug = event.dataTransfer.getData(CARD_TYPE);
              if (target === null || slug === '') return;
              event.preventDefault();
              const node = nodes.find((one) => one.slug === slug);
              if (node === undefined || node.status === target) return;
              onApplyOps([{ op: 'upsert_node', node: { slug, status: target } }]);
            }}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-lg border border-rule bg-surface-2',
              over !== null && over === target && 'border-accent',
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b border-rule px-2 py-2">
              <Pill color={status === null ? UNKNOWN_COLOR : paletteVar(status.color)}>
                {status === null ? t.plan.views.otherStatuses : statusName(t, status)}
              </Pill>
              <span className="text-xs text-ink-faint">{cards.length}</span>
            </header>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {cards.map((node) => (
                <li key={node.slug}>
                  <button
                    type="button"
                    draggable={!readOnly}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(CARD_TYPE, node.slug);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    aria-current={node.slug === selected ? 'true' : undefined}
                    onClick={() => onSelect(node.slug)}
                    className={cn(
                      'block w-full space-y-1.5 rounded-md border border-rule bg-surface p-2 text-left transition-colors hover:border-rule-strong',
                      node.slug === selected && 'border-accent',
                    )}
                  >
                    <span className="block text-sm text-ink">{node.title}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-ink-muted">
                        {kindLabel(t, vocabulary, node.kind)}
                      </span>
                      {node.tags.map((tag) => (
                        <Pill key={tag} color={tagColor(vocabulary, tag)}>
                          {tag}
                        </Pill>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
