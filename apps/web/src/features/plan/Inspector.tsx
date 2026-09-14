import {
  isSlug,
  planNodeKinds,
  planNodeStatuses,
  type PlanNode,
  type PlanOp,
} from '@schematic/schema';
import { nodeBodyText } from '@schematic/ydoc';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type * as Y from 'yjs';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Markdown } from '@/components/ui/markdown';
import { Select } from '@/components/ui/select';
import { STATUS_LABEL } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import { SIDE_PANEL } from './side-panel';
import { useYText } from './use-y-text';

const KIND_LABEL: Record<string, string> = {
  feature: 'Feature',
  task: 'Task',
  decision: 'Decision',
  note: 'Note',
  group: 'Group',
};

const KIND_OPTIONS = planNodeKinds.map((kind) => ({
  value: kind,
  label: KIND_LABEL[kind] ?? kind,
}));
const STATUS_OPTIONS = planNodeStatuses.map((status) => ({
  value: status,
  label: STATUS_LABEL[status],
}));

/**
 * Everything typed here is written straight into the shared document, so two
 * people editing one node see each other rather than overwrite each other.
 */
export function Inspector({
  doc,
  node,
  slugs,
  readOnly,
  onApplyOps,
  onRenamed,
  onClose,
}: {
  doc: Y.Doc;
  node: PlanNode;
  /** Every identifier in the plan, so a clash is said before it is attempted. */
  slugs: readonly string[];
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  /** The panel follows the node it is about when that node is readdressed. */
  onRenamed: (slug: string) => void;
  onClose: () => void;
}) {
  const body = useMemo(() => nodeBodyText(doc, node.slug), [doc, node.slug]);
  const [text, writeText] = useYText(body);
  // Raw while the cursor is in it, drawn when it is not — the same bargain a
  // note already makes by being a textarea open and text closed.
  const [writing, setWriting] = useState(false);

  const patch = (changes: Partial<PlanNode>): void => {
    onApplyOps([{ op: 'upsert_node', node: { slug: node.slug, ...changes } }]);
  };

  /*
   * The identifier is edited as a draft and written once, on leaving the field.
   * Renaming per keystroke would issue a rename for every prefix of what is
   * being typed, each one reissuing every line that touches the node — and the
   * first keystroke would take a slug some other node might legitimately want.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const wanted = (draft ?? node.slug).trim();
  const clash = wanted !== node.slug && slugs.includes(wanted);
  const malformed = wanted !== '' && !isSlug(wanted);

  const rename = (): void => {
    setDraft(null);
    if (wanted === '' || wanted === node.slug || clash || malformed) return;
    onApplyOps([{ op: 'rename_node', from: node.slug, to: wanted }]);
    onRenamed(wanted);
  };

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        {/*
          The panel says what it is about. It used to show the slug here, which
          is derived from the title when a node is made and never changes after
          — so beside the Title field below it read as the same name twice, one
          of them stale. The identifier still matters, because it is how an
          agent addresses this node, so it is named as one under the field it
          came from rather than standing in for it.
        */}
        <span className="truncate text-xs font-medium text-ink">{node.title}</span>
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

        {/* Derived from the title when the node is made, and changeable after —
            which the Add node dialog promised long before anything delivered
            it. It is how an agent addresses this node and the name of the file
            it exports to, so a node whose title has moved on was carrying a
            name from its first minute in both places. */}
        <Field
          label="Identifier"
          hint={
            clash
              ? 'Another node already answers to that'
              : malformed
                ? 'Lowercase words joined by single hyphens'
                : 'How an agent addresses this node, and the file it exports to'
          }
        >
          {(id) => (
            <Input
              id={id}
              className="font-mono"
              value={draft ?? node.slug}
              disabled={readOnly}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={rename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setDraft(null);
              }}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            {(id) => (
              <Select
                id={id}
                value={node.kind}
                options={KIND_OPTIONS}
                disabled={readOnly}
                onChange={(kind) => patch({ kind })}
              />
            )}
          </Field>

          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                value={node.status}
                options={STATUS_OPTIONS}
                disabled={readOnly}
                onChange={(status) => patch({ status })}
              />
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

        <Field label="Detail" hint="Markdown. Drawn as Markdown on the canvas">
          {(id) =>
            writing && !readOnly ? (
              <Textarea
                id={id}
                rows={10}
                autoFocus
                value={text}
                onChange={(event) => writeText(event.target.value)}
                onBlur={() => setWriting(false)}
              />
            ) : (
              <div
                id={id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                onClick={() => !readOnly && setWriting(true)}
                onFocus={() => !readOnly && setWriting(true)}
                className={cn(
                  'min-h-24 w-full rounded-md border border-rule bg-surface px-2.5 py-1.5',
                  !readOnly && 'cursor-text',
                )}
              >
                {text.trim() === '' ? (
                  <span className="text-sm text-ink-faint">Nothing yet</span>
                ) : (
                  <Markdown body={text} className="text-sm" />
                )}
              </div>
            )
          }
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
