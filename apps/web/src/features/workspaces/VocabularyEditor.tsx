import {
  GROUP_KIND,
  KIND_LOOKS,
  PALETTE,
  STATUS_CATEGORIES,
  randomTagColor,
  tagOf,
  vocabularyId,
  type KindLook,
  type PaletteColor,
  type StatusCategory,
  type VocabularyKind,
  type VocabularyStatus,
} from '@schematic/schema';
import { Archive, ArrowDown, ArrowUp, Check, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Problem } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { Panel } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { KindSwatch, kindName, paletteVar, statusName, tint } from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useProjectVocabulary, type VocabularyEdit } from '@/lib/vocabulary';

/** What a status made under each heading starts as, before anybody recolours it. */
const CATEGORY_COLOR: Record<StatusCategory, PaletteColor> = {
  todo: 'blue',
  active: 'amber',
  blocked: 'red',
  done: 'green',
  cancelled: 'dim',
};

/** Moves one entry past its nearest neighbour that passes `peer`, leaving the rest in place. */
export function moveAmong<T>(
  list: readonly T[],
  index: number,
  step: -1 | 1,
  peer: (one: T) => boolean,
): T[] {
  let other = index + step;
  while (other >= 0 && other < list.length && !peer(list[other] as T)) other += step;
  if (other < 0 || other >= list.length) return [...list];
  const next = [...list];
  [next[index], next[other]] = [next[other] as T, next[index] as T];
  return next;
}

const replaceStatus =
  (id: string, change: Partial<VocabularyStatus>): VocabularyEdit =>
  (vocabulary) => ({
    ...vocabulary,
    statuses: vocabulary.statuses.map((one) => (one.id === id ? { ...one, ...change } : one)),
  });

const replaceKind =
  (id: string, change: Partial<VocabularyKind>): VocabularyEdit =>
  (vocabulary) => ({
    ...vocabulary,
    kinds: vocabulary.kinds.map((one) => (one.id === id ? { ...one, ...change } : one)),
  });

/**
 * The project's statuses, kinds and tags, edited in place.
 *
 * Every change is saved as it is made, one at a time. Each is kept as what it
 * does — rename this, archive that — so when somebody else saved in between it
 * is replayed onto their version rather than replacing it.
 */
export function VocabularyEditor({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const t = useT();
  const m = t.vocab.editor;
  const { vocabulary, error, edit } = useProjectVocabulary(projectId);
  const panel = useRef<HTMLDivElement>(null);

  // Opened from a picker's Edit… on the canvas: bring this panel into view.
  useEffect(() => {
    if (window.location.hash === '#vocabulary') panel.current?.scrollIntoView({ block: 'start' });
  }, []);

  const liveStatuses = vocabulary.statuses.filter((one) => !one.archived);
  const liveKinds = vocabulary.kinds.filter((one) => !one.archived && one.id !== GROUP_KIND);
  const archivedStatuses = vocabulary.statuses.filter((one) => one.archived);
  const archivedKinds = vocabulary.kinds.filter((one) => one.archived);

  const addStatus = (name: string, category: StatusCategory): void =>
    void edit((current) => ({
      ...current,
      statuses: [
        ...current.statuses,
        {
          id: vocabularyId(
            name,
            current.statuses.map((one) => one.id),
            'status',
          ),
          name,
          color: CATEGORY_COLOR[category],
          category,
          archived: false,
        },
      ],
    }));

  const addKind = (name: string): void =>
    void edit((current) => ({
      ...current,
      kinds: [
        ...current.kinds,
        {
          id: vocabularyId(
            name,
            current.kinds.map((one) => one.id),
            'kind',
          ),
          name,
          look: 'solid',
          work: true,
          archived: false,
        },
      ],
    }));

  const addTag = (name: string): void =>
    void edit((current) =>
      tagOf(current, name) !== undefined
        ? current
        : { ...current, tags: [...current.tags, { name, color: randomTagColor() }] },
    );

  const moveStatus = (id: string, step: -1 | 1): void =>
    void edit((current) => {
      const index = current.statuses.findIndex((one) => one.id === id);
      const category = current.statuses[index]?.category;
      if (index < 0) return current;
      return {
        ...current,
        statuses: moveAmong(
          current.statuses,
          index,
          step,
          (one) => !one.archived && one.category === category,
        ),
      };
    });

  const moveKind = (id: string, step: -1 | 1): void =>
    void edit((current) => {
      const index = current.kinds.findIndex((one) => one.id === id);
      if (index < 0) return current;
      return {
        ...current,
        kinds: moveAmong(
          current.kinds,
          index,
          step,
          (one) => !one.archived && one.id !== GROUP_KIND,
        ),
      };
    });

  return (
    <div ref={panel} id="vocabulary" className="scroll-mt-6">
      <Panel title={m.title} description={m.description}>
        <div className="space-y-6">
          {error !== null ? <Problem error={new Error(m.saveFailed)} /> : null}
          {!canEdit ? <p className="text-xs text-ink-faint">{m.readOnly}</p> : null}

          <Section title={m.statuses}>
            {STATUS_CATEGORIES.map((category) => {
              const inCategory = liveStatuses.filter((one) => one.category === category);
              return (
                <div key={category} className="space-y-1.5">
                  <div>
                    <h4 className="text-xs font-medium text-ink">{t.vocab.categories[category]}</h4>
                    <p className="text-2xs text-ink-faint">{t.vocab.categoryMeaning[category]}</p>
                  </div>
                  {inCategory.map((status, index) => (
                    <Row key={status.id}>
                      <ColorPicker
                        color={status.color}
                        disabled={!canEdit}
                        onPick={(color) => void edit(replaceStatus(status.id, { color }))}
                      />
                      <NameInput
                        value={statusName(t, status)}
                        disabled={!canEdit}
                        onCommit={(name) => void edit(replaceStatus(status.id, { name }))}
                      />
                      {/* What the pickers will show, in a column of its own so the
                          names line up whatever each is called. */}
                      <span className="hidden w-32 shrink-0 sm:flex">
                        <span
                          className="truncate rounded-full border px-2 text-2xs leading-5"
                          style={tint(paletteVar(status.color))}
                        >
                          {statusName(t, status)}
                        </span>
                      </span>
                      <Arrows
                        disabled={!canEdit}
                        first={index === 0}
                        last={index === inCategory.length - 1}
                        onMove={(step) => moveStatus(status.id, step)}
                      />
                      <IconButton
                        label={liveStatuses.length === 1 ? m.lastStatus : m.archive}
                        disabled={!canEdit || liveStatuses.length === 1}
                        onClick={() => void edit(replaceStatus(status.id, { archived: true }))}
                      >
                        <Archive className="size-3.5" />
                      </IconButton>
                    </Row>
                  ))}
                  {canEdit ? (
                    <AddInput
                      placeholder={m.newStatus}
                      label={m.addStatus}
                      onAdd={(name) => addStatus(name, category)}
                    />
                  ) : null}
                </div>
              );
            })}
            <Archived
              label={m.archived(archivedStatuses.length)}
              entries={archivedStatuses.map((status) => ({
                id: status.id,
                label: statusName(t, status),
                icon: (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: paletteVar(status.color) }}
                  />
                ),
                restore: () => void edit(replaceStatus(status.id, { archived: false })),
              }))}
              restoreLabel={m.restore}
              disabled={!canEdit}
            />
          </Section>

          <Section title={m.kinds} hint={m.kindsHint}>
            {liveKinds.map((kind, index) => (
              <Row key={kind.id}>
                <div className="w-36 shrink-0">
                  <Select<KindLook>
                    value={kind.look}
                    disabled={!canEdit}
                    options={KIND_LOOKS.map((look) => ({
                      value: look,
                      label: t.vocab.looks[look],
                      icon: <KindSwatch look={look} />,
                    }))}
                    onChange={(look) => void edit(replaceKind(kind.id, { look }))}
                  />
                </div>
                <NameInput
                  value={kindName(t, kind)}
                  disabled={!canEdit}
                  onCommit={(name) => void edit(replaceKind(kind.id, { name }))}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={kind.work}
                    disabled={!canEdit}
                    onChange={(event) =>
                      void edit(replaceKind(kind.id, { work: event.target.checked }))
                    }
                  />
                  {m.work}
                </label>
                <Arrows
                  disabled={!canEdit}
                  first={index === 0}
                  last={index === liveKinds.length - 1}
                  onMove={(step) => moveKind(kind.id, step)}
                />
                <IconButton
                  label={liveKinds.length === 1 ? m.lastKind : m.archive}
                  disabled={!canEdit || liveKinds.length === 1}
                  onClick={() => void edit(replaceKind(kind.id, { archived: true }))}
                >
                  <Archive className="size-3.5" />
                </IconButton>
              </Row>
            ))}
            {vocabulary.kinds
              .filter((one) => one.id === GROUP_KIND)
              .map((group) => (
                <Row key={group.id}>
                  <div className="flex w-36 shrink-0 items-center gap-2 px-2.5 text-xs text-ink-faint">
                    <KindSwatch look="strong" />
                    {m.builtIn}
                  </div>
                  <span className="min-w-0 flex-1 truncate px-2.5 text-sm text-ink-muted">
                    {kindName(t, group)}
                  </span>
                </Row>
              ))}
            {canEdit ? (
              <AddInput placeholder={m.newKind} label={m.addKind} onAdd={addKind} />
            ) : null}
            <Archived
              label={m.archived(archivedKinds.length)}
              entries={archivedKinds.map((kind) => ({
                id: kind.id,
                label: kindName(t, kind),
                icon: <KindSwatch look={kind.look} />,
                restore: () => void edit(replaceKind(kind.id, { archived: false })),
              }))}
              restoreLabel={m.restore}
              disabled={!canEdit}
            />
          </Section>

          <Section title={m.tags} hint={m.tagsHint}>
            {vocabulary.tags.length === 0 ? (
              <p className="text-xs text-ink-faint">{m.noTags}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {vocabulary.tags.map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 rounded-sm border py-px pr-0.5 pl-1 text-xs leading-5"
                    style={tint(paletteVar(tag.color))}
                  >
                    <ColorPicker
                      color={tag.color}
                      small
                      disabled={!canEdit}
                      onPick={(color) =>
                        void edit((current) => ({
                          ...current,
                          tags: current.tags.map((one) =>
                            one.name === tag.name ? { ...one, color } : one,
                          ),
                        }))
                      }
                    />
                    {tag.name}
                    {canEdit ? (
                      <IconButton
                        label={t.vocab.tags.deleteFromProject}
                        small
                        onClick={() =>
                          void edit((current) => ({
                            ...current,
                            tags: current.tags.filter((one) => one.name !== tag.name),
                          }))
                        }
                      >
                        <Trash2 className="size-3" />
                      </IconButton>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
            {canEdit ? <AddInput placeholder={m.newTag} label={m.addTag} onAdd={addTag} /> : null}
          </Section>
        </div>
      </Panel>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
        {hint !== undefined ? <p className="mt-0.5 text-2xs text-ink-faint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2">{children}</div>;
}

/**
 * A name, written back when the field is left or Enter is pressed — not per
 * keystroke, which would be a save and a version for every letter.
 */
function NameInput({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    const name = (draft ?? value).trim();
    setDraft(null);
    if (name !== '' && name !== value) onCommit(name.slice(0, 40));
  };
  return (
    <Input
      className="min-w-0 flex-1"
      value={draft ?? value}
      maxLength={40}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(null);
      }}
    />
  );
}

function AddInput({
  placeholder,
  label,
  onAdd,
}: {
  placeholder: string;
  label: string;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const add = (): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    onAdd(trimmed.slice(0, 40));
    setName('');
  };
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <Input
        className="min-w-0 flex-1"
        value={name}
        maxLength={40}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" size="sm" disabled={name.trim() === ''}>
        {label}
      </Button>
    </form>
  );
}

function ColorPicker({
  color,
  disabled,
  small,
  onPick,
}: {
  color: PaletteColor;
  disabled: boolean;
  small?: boolean;
  onPick: (color: PaletteColor) => void;
}) {
  const t = useT();
  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={`${t.vocab.editor.color}: ${t.vocab.colors[color]}`}
          className={cn(
            'grid shrink-0 place-items-center rounded-full outline-none focus-visible:focus-glow disabled:opacity-60',
            small === true ? 'size-3' : 'size-7 border border-rule bg-surface',
          )}
        >
          <span
            aria-hidden
            className={cn('rounded-full', small === true ? 'size-2.5' : 'size-3.5')}
            style={{ background: paletteVar(color) }}
          />
        </button>
      }
    >
      <div className="grid grid-cols-5 gap-1 p-1.5">
        {PALETTE.map((one) => (
          <button
            key={one}
            type="button"
            title={t.vocab.colors[one]}
            aria-label={t.vocab.colors[one]}
            onClick={() => onPick(one)}
            className="grid size-6 place-items-center rounded-full outline-none focus-visible:focus-glow"
            style={{ background: paletteVar(one) }}
          >
            {one === color ? <Check className="size-3.5 text-white" /> : null}
          </button>
        ))}
      </div>
    </DropdownMenu>
  );
}

function IconButton({
  label,
  disabled,
  small,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      {/* A span, so the tooltip still explains a button that is disabled. */}
      <span className="inline-flex shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={small === true ? 'h-5 w-5' : undefined}
        >
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}

function Arrows({
  disabled,
  first,
  last,
  onMove,
}: {
  disabled: boolean;
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
}) {
  const t = useT();
  return (
    <div className="flex shrink-0">
      <IconButton
        label={t.vocab.editor.moveUp}
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-3.5" />
      </IconButton>
      <IconButton
        label={t.vocab.editor.moveDown}
        disabled={disabled || last}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="size-3.5" />
      </IconButton>
    </div>
  );
}

function Archived({
  label,
  entries,
  restoreLabel,
  disabled,
}: {
  label: string;
  entries: { id: string; label: string; icon: ReactNode; restore: () => void }[];
  restoreLabel: string;
  disabled: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <details className="rounded-md border border-rule px-2.5 py-1.5">
      <summary className="cursor-pointer text-xs text-ink-muted select-none">{label}</summary>
      <ul className="mt-1.5 space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-sm text-ink-muted">
            {entry.icon}
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            <span className="slug text-ink-faint">{entry.id}</span>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={entry.restore}>
              <RotateCcw className="size-3" />
              {restoreLabel}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
