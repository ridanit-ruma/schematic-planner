import {
  planNodeKinds,
  planNodeStatuses,
  type PlanNode,
  type PlanOp,
} from '@schematic/schema';
import { nodeBodyText } from '@schematic/ydoc';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type * as Y from 'yjs';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { STATUS_LABEL } from '@/components/ui/status';
import { useYText } from './use-y-text';

const KIND_LABEL: Record<string, string> = {
  feature: 'Feature',
  task: 'Task',
  decision: 'Decision',
  note: 'Note',
  group: 'Group',
};

const select =
  'w-full rounded-[2px] border border-rule bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none';

/**
 * Everything typed here is written straight into the shared document, so two
 * people editing one node see each other rather than overwrite each other.
 */
export function Inspector({
  doc,
  node,
  readOnly,
  onApplyOps,
  onClose,
}: {
  doc: Y.Doc;
  node: PlanNode;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  onClose: () => void;
}) {
  const body = useMemo(() => nodeBodyText(doc, node.slug), [doc, node.slug]);
  const [text, writeText] = useYText(body);

  const patch = (changes: Partial<PlanNode>): void => {
    onApplyOps([{ op: 'upsert_node', node: { slug: node.slug, ...changes } }]);
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-rule bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <span className="slug truncate text-ink-faint">{node.slug}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={node.title}
              disabled={readOnly}
              onChange={(event) => patch({ title: event.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            {(id) => (
              <select
                id={id}
                className={select}
                value={node.kind}
                disabled={readOnly}
                onChange={(event) => patch({ kind: event.target.value as PlanNode['kind'] })}
              >
                {planNodeKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind] ?? kind}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Status">
            {(id) => (
              <select
                id={id}
                className={select}
                value={node.status}
                disabled={readOnly}
                onChange={(event) => patch({ status: event.target.value as PlanNode['status'] })}
              >
                {planNodeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field label="Tags" hint="Separated by commas">
          {(id) => (
            <Input
              id={id}
              value={node.tags.join(', ')}
              disabled={readOnly}
              onChange={(event) =>
                patch({
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter((tag) => tag !== ''),
                })
              }
            />
          )}
        </Field>

        <Field label="Detail" hint="Becomes the body of this node's Markdown file">
          {(id) => (
            <Textarea
              id={id}
              rows={10}
              value={text}
              disabled={readOnly}
              onChange={(event) => writeText(event.target.value)}
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
              onApplyOps([{ op: 'delete_node', slug: node.slug }]);
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            Delete node
          </Button>
          <p className="mt-2 text-xs text-ink-faint">
            Removes the node and every connection attached to it.
          </p>
        </div>
      )}
    </aside>
  );
}
