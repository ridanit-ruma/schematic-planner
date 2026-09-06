import { planEdgeKinds, type PlanEdge, type PlanEdgeKind, type PlanOp } from '@schematic/schema';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

export const EDGE_LABEL: Record<PlanEdgeKind, string> = {
  flows_to: 'Flows to',
  depends_on: 'Depends on',
  contains: 'Contains',
  relates_to: 'Relates to',
};

const EDGE_MEANING: Record<PlanEdgeKind, string> = {
  flows_to: 'Control or data moves this way. A reply is its own flow, pointing back.',
  depends_on: 'Orders the two. Becomes the number on each filename when you export.',
  contains: 'Nests one inside the other. Becomes a directory when you export.',
  relates_to: 'A plain association. Carries no structure.',
};

const KIND_OPTIONS = planEdgeKinds.map((kind) => ({
  value: kind,
  label: EDGE_LABEL[kind],
  hint: EDGE_MEANING[kind],
}));

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
  const change = (next: Partial<Pick<PlanEdge, 'kind' | 'label' | 'via' | 'carries'>>): void => {
    const merged = {
      kind: next.kind ?? edge.kind,
      label: next.label === undefined ? edge.label : next.label,
      via: next.via === undefined ? edge.via : next.via,
      carries: next.carries === undefined ? edge.carries : next.carries,
    };

    onApplyOps([
      { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to, via: edge.via },
      { op: 'upsert_edge', edge: { from: edge.from, to: edge.to, ...merged } },
    ]);
  };

  const blank = (value: string): string | null => (value.trim() === '' ? null : value);
  const isFlow = edge.kind === 'flows_to';

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
            <Select
              id={id}
              value={edge.kind}
              options={KIND_OPTIONS}
              disabled={readOnly}
              onChange={(kind) => change({ kind })}
            />
          )}
        </Field>

        {isFlow ? (
          <>
            <Field label="Set off by" hint="What starts it: a click, a route, a request, a timer.">
              {(id) => (
                <Input
                  id={id}
                  value={edge.via ?? ''}
                  disabled={readOnly}
                  placeholder="click Sign in"
                  onChange={(event) => change({ via: blank(event.target.value) })}
                />
              )}
            </Field>

            <Field label="Carries" hint="What travels along it: a payload, a record, a return value.">
              {(id) => (
                <Input
                  id={id}
                  value={edge.carries ?? ''}
                  disabled={readOnly}
                  placeholder="{ email, password }"
                  onChange={(event) => change({ carries: blank(event.target.value) })}
                />
              )}
            </Field>
          </>
        ) : (
          <Field label="Label" hint="Drawn on the line. Optional.">
            {(id) => (
              <Input
                id={id}
                value={edge.label ?? ''}
                disabled={readOnly}
                onChange={(event) => change({ label: blank(event.target.value) })}
              />
            )}
          </Field>
        )}
      </div>

      {!readOnly && (
        <div className="border-t border-rule p-3">
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => {
              onApplyOps([
                { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to, via: edge.via },
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
