import {
  matrixCells,
  type MatrixAxes,
  type MatrixAxis,
  type PlanNode,
  type Vocabulary,
} from '@schematic/schema';
import { useMemo } from 'react';

import { kindLabel, statusLabel } from '@/components/ui/vocabulary';
import { useT, type Messages } from '@/i18n';
import { cn } from '@/lib/utils';

function valueLabel(t: Messages, vocabulary: Vocabulary, axis: MatrixAxis, value: string | null) {
  if (value === null) return t.plan.views.noTag;
  if (axis === 'status') return statusLabel(t, vocabulary, value);
  if (axis === 'kind') return kindLabel(t, vocabulary, value);
  return value;
}

/**
 * Every node placed by two of its properties at once — kind against status by
 * default — so a gap reads as an empty cell rather than as an absence nobody
 * notices. A node opens the inspector from here like from anywhere else.
 */
export function MatrixView({
  nodes,
  vocabulary,
  axes,
  selected,
  onSelect,
}: {
  nodes: readonly PlanNode[];
  vocabulary: Vocabulary;
  axes: MatrixAxes;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const t = useT();
  const matrix = useMemo(() => matrixCells(nodes, vocabulary, axes), [nodes, vocabulary, axes]);

  if (nodes.length === 0) {
    return <p className="p-6 text-sm text-ink-muted">{t.plan.views.empty}</p>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <table className="border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th />
            {matrix.columns.map((column) => (
              <th
                key={column ?? ''}
                scope="col"
                className="rail-heading px-2 py-1 text-left font-medium"
              >
                {valueLabel(t, vocabulary, axes.columns, column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, r) => (
            <tr key={row ?? ''}>
              <th
                scope="row"
                className="rail-heading px-2 py-1 text-left align-top font-medium whitespace-nowrap"
              >
                {valueLabel(t, vocabulary, axes.rows, row)}
              </th>
              {matrix.columns.map((column, c) => (
                <td
                  key={column ?? ''}
                  className="w-44 min-w-44 rounded-md bg-surface-2 p-1.5 align-top"
                >
                  <ul className="space-y-1">
                    {matrix.cells[r]?.[c]?.map((node) => (
                      <li key={node.slug}>
                        <button
                          type="button"
                          aria-current={node.slug === selected ? 'true' : undefined}
                          onClick={() => onSelect(node.slug)}
                          className={cn(
                            'block w-full truncate rounded-sm border border-rule bg-surface px-1.5 py-0.5 text-left text-xs text-ink hover:border-rule-strong',
                            node.slug === selected && 'border-accent',
                          )}
                        >
                          {node.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
