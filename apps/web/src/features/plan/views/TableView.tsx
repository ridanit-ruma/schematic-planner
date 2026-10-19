import type { PlanNode, Vocabulary } from '@schematic/schema';

import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Pill, kindLabel, statusColor, statusLabel, tagColor } from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Every node in the plan as a row, in the order the document holds them.
 *
 * Unfiltered, nothing is left out: this is the view to find whatever the
 * drawing makes hard to find. A row opens the same inspector the canvas does.
 */
export function TableView({
  nodes,
  vocabulary,
  selected,
  filtered,
  onSelect,
}: {
  nodes: readonly PlanNode[];
  /** Whether a filter is narrowing the list, so an empty one says why. */
  filtered: boolean;
  vocabulary: Vocabulary;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const t = useT();
  if (nodes.length === 0) {
    return (
      <p className="p-6 text-sm text-ink-muted">
        {filtered ? t.plan.views.noMatch : t.plan.views.empty}
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <Table>
        <THead>
          <TH>{t.plan.inspector.title}</TH>
          <TH hide="sm" className="w-32">
            {t.plan.inspector.kind}
          </TH>
          <TH className="w-32 sm:w-36">{t.plan.inspector.status}</TH>
          <TH hide="md" className="w-56">
            {t.plan.inspector.tags}
          </TH>
        </THead>
        <tbody>
          {nodes.map((node) => (
            <TR key={node.slug}>
              <TD>
                <button
                  type="button"
                  aria-current={node.slug === selected ? 'true' : undefined}
                  onClick={() => onSelect(node.slug)}
                  className={cn(
                    'block w-full truncate rounded-sm text-left text-ink hover:underline',
                    node.slug === selected && 'font-medium text-accent',
                  )}
                >
                  {node.title}
                </button>
              </TD>
              <TD hide="sm" className="truncate text-ink-muted">
                {kindLabel(t, vocabulary, node.kind)}
              </TD>
              <TD>
                <Pill color={statusColor(vocabulary, node.status)}>
                  {statusLabel(t, vocabulary, node.status)}
                </Pill>
              </TD>
              <TD hide="md">
                <span className="flex gap-1 overflow-hidden">
                  {node.tags.map((tag) => (
                    <Pill key={tag} color={tagColor(vocabulary, tag)}>
                      {tag}
                    </Pill>
                  ))}
                </span>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
