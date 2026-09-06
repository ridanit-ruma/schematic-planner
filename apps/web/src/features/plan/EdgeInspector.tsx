import { planEdgeKinds, type PlanEdge, type PlanEdgeKind, type PlanOp } from '@schematic/schema';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export const EDGE_LABEL: Record<PlanEdgeKind, string> = {
  depends_on: 'Depends on',
  contains: 'Contains',
  relates_to: 'Relates to',
};

const EDGE_MEANING: Record<PlanEdgeKind, string> = {
  depends_on: 'Orders the two. Becomes the number on each filename when you export.',
  contains: 'Nests one inside the other. Becomes a directory when you export.',
  relates_to: 'A plain association. Carries no structure.',
};

const select =
  'w-full rounded-[2px] border border-rule bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none';

/**
 * Changing the kind is a delete and a create, because an edge is identified by
 * its endpoints and its kind. Both go in one batch, so the canvas never shows a
 * moment with no edge between the two nodes.
 */
export function EdgeInspector({
  edge,
  readOnly,
  onApplyOps,
  onClose,
}: {
  edge: PlanEdge;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  onClose: () => void;
}) {
  const change = (next: Partial<Pick<PlanEdge, 'kind' | 'label'>>): void => {
    const kind = next.kind ?? edge.kind;
    const label = next.label === undefined ? edge.label : next.label;

    onApplyOps([
      { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to },
      { op: 'upsert_edge', edge: { kind, from: edge.from, to: edge.to, label } },
    ]);
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-rule bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <span className="text-xs font-medium text-ink">Connection</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <p className="text-xs text-ink-muted">
          <span className="slug text-ink">{edge.from}</span>
          {' → '}
          <span className="slug text-ink">{edge.to}</span>
        </p>

        <Field label="Meaning" hint={EDGE_MEANING[edge.kind]}>
          {(id) => (
            <select
              id={id}
              className={select}
              value={edge.kind}
              disabled={readOnly}
              onChange={(event) => change({ kind: event.target.value as PlanEdgeKind })}
            >
              {planEdgeKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {EDGE_LABEL[kind]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Label" hint="Drawn on the line. Optional.">
          {(id) => (
            <Input
              id={id}
              value={edge.label ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                change({ label: event.target.value === '' ? null : event.target.value })
              }
            />
          )}
        </Field>
      </div>

      {!readOnly && (
        <div className="border-t border-rule p-3">
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => {
              onApplyOps([
                { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to },
              ]);
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            Remove connection
          </Button>
        </div>
      )}
    </aside>
  );
}
