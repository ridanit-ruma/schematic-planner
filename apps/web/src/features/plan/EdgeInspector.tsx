import { planEdgeKinds, type PlanEdge, type PlanOp } from '@schematic/schema';
import { Spline, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useT, type Messages } from '@/i18n';
import { SIDE_PANEL } from './side-panel';

const kindOptions = (t: Messages) =>
  planEdgeKinds.map((kind) => ({
    value: kind,
    label: t.plan.labels.edgeKind[kind],
    hint: t.plan.labels.edgeMeaning[kind],
  }));

/**
 * Changing the kind is a delete and a create, because an edge is identified by
 * its endpoints and its kind. Both go in one batch, so the canvas never shows a
 * moment with no edge between the two nodes.
 *
 * Which means everything not named in that create is lost, and the two fields
 * nobody thinks of when renaming a line are the two a person placed by hand:
 * where its writing sits and the bends it runs through. They are carried across
 * explicitly here for that reason.
 */
export function EdgeInspector({
  edge,
  readOnly,
  onApplyOps,
  onStraighten,
  onClose,
}: {
  edge: PlanEdge;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  /** Back to the route the renderer would have chosen. */
  onStraighten: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const change = (next: Partial<Pick<PlanEdge, 'kind' | 'label' | 'via' | 'carries'>>): void => {
    const merged = {
      kind: next.kind ?? edge.kind,
      label: next.label === undefined ? edge.label : next.label,
      via: next.via === undefined ? edge.via : next.via,
      carries: next.carries === undefined ? edge.carries : next.carries,
      labelPosition: edge.labelPosition,
      waypoints: edge.waypoints,
    };

    onApplyOps([
      { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to, via: edge.via },
      { op: 'upsert_edge', edge: { from: edge.from, to: edge.to, ...merged } },
    ]);
  };

  const blank = (value: string): string | null => (value.trim() === '' ? null : value);
  const isFlow = edge.kind === 'flows_to';

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <span className="text-xs font-medium text-ink">{t.plan.edgeInspector.connection}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.common.close}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <p className="text-xs text-ink-muted">
          <span className="slug text-ink">{edge.from}</span>
          {' → '}
          <span className="slug text-ink">{edge.to}</span>
        </p>

        <Field label={t.plan.edgeInspector.meaning} hint={t.plan.labels.edgeMeaning[edge.kind]}>
          {(id) => (
            <Select
              id={id}
              value={edge.kind}
              options={kindOptions(t)}
              disabled={readOnly}
              onChange={(kind) => change({ kind })}
            />
          )}
        </Field>

        {isFlow ? (
          <>
            <Field label={t.plan.edgeInspector.setOffBy} hint={t.plan.edgeInspector.setOffByHint}>
              {(id) => (
                <Input
                  id={id}
                  value={edge.via ?? ''}
                  disabled={readOnly}
                  placeholder={t.plan.edgeInspector.setOffByPlaceholder}
                  onChange={(event) => change({ via: blank(event.target.value) })}
                />
              )}
            </Field>

            <Field label={t.plan.edgeInspector.carries} hint={t.plan.edgeInspector.carriesHint}>
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
          <Field label={t.plan.edgeInspector.label} hint={t.plan.edgeInspector.labelHint}>
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
        <div className="space-y-2 border-t border-rule p-3">
          {/*
            A line is bent by pushing one of its runs sideways, and a straight
            line has no run to push back, so undoing it cannot live on the line
            itself. Here it is findable, and it is the only control that says a
            line remembers a shape at all.
          */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={edge.waypoints.length === 0}
            onClick={onStraighten}
          >
            <Spline className="size-3.5" />
            {t.plan.edgeInspector.straighten}
          </Button>
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
            {t.plan.edgeInspector.removeConnection}
          </Button>
        </div>
      )}
    </aside>
  );
}
