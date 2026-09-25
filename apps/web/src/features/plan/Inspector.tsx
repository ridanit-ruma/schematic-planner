import {
  isSlug,
  kindOf,
  pickable,
  statusOf,
  type PlanNode,
  type PlanOp,
  type Vocabulary,
} from '@schematic/schema';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type * as Y from 'yjs';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Select, type SelectOption } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import {
  KindSwatch,
  Pill,
  UNKNOWN_COLOR,
  kindName,
  paletteVar,
  statusName,
} from '@/components/ui/vocabulary';
import { useT, type Messages } from '@/i18n';
import { DEFAULT_WORDS, type PlanWords } from '@/lib/vocabulary';
import { BodyEditor, type Awareness } from './editor/BodyEditor';
import { watchNodeBody } from './node-body';
import { SIDE_PANEL } from './side-panel';

/** Picked like any other value, and caught before it reaches the node. */
const EDIT = '__edit_vocabulary__';

/**
 * What the pickers offer: the project's values that are in use, the one the
 * node already has even if it has been archived or was never defined, and —
 * for an editor — a way to change the list itself.
 */
function kindOptions(
  t: Messages,
  vocabulary: Vocabulary,
  current: string,
  editable: boolean,
): SelectOption<string>[] {
  const options: SelectOption<string>[] = pickable(vocabulary.kinds, current).map((kind) => ({
    value: kind.id,
    label: kind.archived ? t.vocab.archivedValue(kindName(t, kind)) : kindName(t, kind),
    icon: <KindSwatch look={kind.id === 'group' ? 'strong' : kind.look} />,
  }));
  if (kindOf(vocabulary, current) === undefined) {
    options.push({
      value: current,
      label: t.vocab.unknown(current),
      icon: <KindSwatch look={null} />,
    });
  }
  if (editable) options.push({ value: EDIT, label: t.vocab.edit, divided: true });
  return options;
}

function statusOptions(
  t: Messages,
  vocabulary: Vocabulary,
  current: string,
  editable: boolean,
): SelectOption<string>[] {
  const options: SelectOption<string>[] = pickable(vocabulary.statuses, current).map((status) => {
    const label = status.archived
      ? t.vocab.archivedValue(statusName(t, status))
      : statusName(t, status);
    return {
      value: status.id,
      label,
      display: <Pill color={paletteVar(status.color)}>{label}</Pill>,
    };
  });
  if (statusOf(vocabulary, current) === undefined) {
    const label = t.vocab.unknown(current);
    options.push({ value: current, label, display: <Pill color={UNKNOWN_COLOR}>{label}</Pill> });
  }
  if (editable) options.push({ value: EDIT, label: t.vocab.edit, divided: true });
  return options;
}

/**
 * Everything typed here is written straight into the shared document, so two
 * people editing one node see each other rather than overwrite each other.
 */
export function Inspector({
  doc,
  node,
  slugs,
  readOnly,
  awareness,
  onApplyOps,
  onRenamed,
  onClose,
  words = DEFAULT_WORDS,
}: {
  doc: Y.Doc;
  node: PlanNode;
  /** Every identifier in the plan, so a clash is said before it is attempted. */
  slugs: readonly string[];
  readOnly: boolean;
  /** The plan's presence channel, so other people's carets show in the body. */
  awareness?: Awareness | null;
  onApplyOps: (ops: PlanOp[]) => void;
  /** The panel follows the node it is about when that node is readdressed. */
  onRenamed: (slug: string) => void;
  onClose: () => void;
  /** The project's kinds, statuses and tags. Defaults when there is no project to ask. */
  words?: PlanWords;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { vocabulary } = words;
  // Changing the list is offered to whoever may change it, once it is known where.
  const editable = words.canEdit && words.editHref !== null;
  const pick =
    (apply: (value: string) => void) =>
    (value: string): void => {
      if (value === EDIT) {
        if (words.editHref !== null) void navigate(words.editHref);
        return;
      }
      apply(value);
    };
  // The shared fragment the body is edited in, so two people and an agent
  // writing in one body merge rather than overwrite each other. Found in an
  // effect, since finding it can write to the document, and followed if the
  // node is replaced under the same slug.
  const [bound, setBound] = useState<{ slug: string; fragment: Y.XmlFragment | undefined }>();
  useEffect(
    () => watchNodeBody(doc, node.slug, (fragment) => setBound({ slug: node.slug, fragment })),
    [doc, node.slug],
  );
  const body = bound?.slug === node.slug ? bound.fragment : undefined;

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
          {t.common.close}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <Field label={t.plan.inspector.title}>
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
          label={t.plan.inspector.identifier}
          hint={
            clash
              ? t.plan.inspector.identifierClash
              : malformed
                ? t.plan.inspector.identifierMalformed
                : t.plan.inspector.identifierHint
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
          <Field label={t.plan.inspector.kind}>
            {(id) => (
              <Select
                id={id}
                value={node.kind}
                options={kindOptions(t, vocabulary, node.kind, editable)}
                disabled={readOnly}
                onChange={pick((kind) => patch({ kind }))}
              />
            )}
          </Field>

          <Field label={t.plan.inspector.status}>
            {(id) => (
              <Select
                id={id}
                value={node.status}
                options={statusOptions(t, vocabulary, node.status, editable)}
                disabled={readOnly}
                onChange={pick((status) => patch({ status }))}
              />
            )}
          </Field>
        </div>

        <Field label={t.plan.inspector.tags} hint={readOnly ? undefined : t.vocab.tags.hint}>
          {(id) => (
            <TagInput
              id={id}
              value={node.tags}
              vocabulary={vocabulary}
              disabled={readOnly}
              canEditVocabulary={words.canEdit}
              onChange={(tags) => patch({ tags })}
              onCreate={(name) => void words.addTag(name)}
              onRecolor={(name, color) =>
                void words.edit((current) => ({
                  ...current,
                  tags: current.tags.map((tag) =>
                    tag.name.toLowerCase() === name.toLowerCase() ? { ...tag, color } : tag,
                  ),
                }))
              }
              onDelete={(name) =>
                void words.edit((current) => ({
                  ...current,
                  tags: current.tags.filter((tag) => tag.name.toLowerCase() !== name.toLowerCase()),
                }))
              }
            />
          )}
        </Field>

        <Field label={t.plan.inspector.detail} hint={readOnly ? undefined : t.editor.hint}>
          {() =>
            body === undefined ? null : readOnly && node.body.trim() === '' ? (
              <p className="text-sm text-ink-faint">{t.plan.inspector.nothingYet}</p>
            ) : (
              <BodyEditor fragment={body} awareness={awareness} editable={!readOnly} />
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
            {t.plan.inspector.deleteNode}
          </Button>
          <p className="mt-2 text-xs text-ink-faint">{t.plan.inspector.deleteNodeNote}</p>
        </div>
      )}
    </aside>
  );
}
