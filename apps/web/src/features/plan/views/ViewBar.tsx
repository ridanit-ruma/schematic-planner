import {
  BUILT_IN_VIEW_IDS,
  EMPTY_FILTER,
  MATRIX_AXES,
  isEmptyFilter,
  pickable,
  uniqueSlug,
  type MatrixAxes,
  type MatrixAxis,
  type SavedView,
  type SavedViewType,
  type ViewFilter,
  type Vocabulary,
} from '@schematic/schema';
import { Bookmark, ChevronDown, Filter, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownAction,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownSub,
} from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { kindName, statusName } from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import type { ViewsEdit } from '@/lib/saved-views';

const toggle = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((one) => one !== value) : [...values, value];

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * What a table or a board shows, and the views the project has saved.
 *
 * The filter narrows this view only; the canvas always draws the whole plan.
 */
export function ViewBar({
  type,
  filter,
  onFilter,
  axes,
  onAxes,
  vocabulary,
  tags,
  views,
  current,
  canSave,
  onOpen,
  onSave,
}: {
  type: SavedViewType;
  filter: ViewFilter;
  onFilter: (filter: ViewFilter) => void;
  /** What a matrix lays out along each side. */
  axes: MatrixAxes;
  onAxes: (axes: MatrixAxes) => void;
  vocabulary: Vocabulary;
  /** Every tag there is to filter by: the project's, and any a node carries that it does not list. */
  tags: readonly string[];
  views: readonly SavedView[];
  /** The saved view on screen, if one is. */
  current: SavedView | null;
  canSave: boolean;
  /** Opens a saved view, or this type unsaved when null. */
  onOpen: (view: SavedView | null) => void;
  onSave: (edit: ViewsEdit) => Promise<void>;
}) {
  const t = useT();
  const [naming, setNaming] = useState<string | null>(null);
  const edited =
    current !== null &&
    !(same(current.filter, filter) && (type !== 'matrix' || same(current.axes, axes)));
  const count =
    filter.kinds.length +
    filter.statuses.length +
    filter.tags.length +
    (filter.text === '' ? 0 : 1);

  const saveAs = async (name: string): Promise<void> => {
    const id = uniqueSlug(name, [...BUILT_IN_VIEW_IDS, ...views.map((view) => view.id)]);
    const view: SavedView = { id, name, type, filter, axes };
    await onSave((list) => [...list, view]);
    onOpen(view);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
      <DropdownMenu
        trigger={
          <Button size="sm" variant="ghost" className="max-w-56">
            <Bookmark className="size-3.5" />
            <span className="truncate">
              {current === null ? t.plan.views.unsaved : current.name}
              {edited ? ` · ${t.plan.views.edited}` : ''}
            </span>
            <ChevronDown className="size-3.5 text-ink-faint" />
          </Button>
        }
      >
        <DropdownItem selected={current === null} onSelect={() => onOpen(null)}>
          {t.plan.views.unsaved}
        </DropdownItem>
        {views.map((view) => (
          <DropdownItem
            key={view.id}
            selected={view.id === current?.id}
            onSelect={() => onOpen(view)}
          >
            <span className="flex-1 truncate">{view.name}</span>
            <span className="text-xs text-ink-faint">{t.plan.views[view.type]}</span>
          </DropdownItem>
        ))}
        {canSave ? (
          <>
            <DropdownSeparator />
            {edited ? (
              <DropdownAction
                onSelect={() =>
                  void onSave((list) =>
                    list.map((view) => (view.id === current.id ? { ...view, filter, axes } : view)),
                  )
                }
              >
                {t.plan.views.saveChanges}
              </DropdownAction>
            ) : null}
            {/* Opened once the menu has closed: the menu hands focus back to its
                trigger as it goes, which would take it from the name field. */}
            <DropdownAction onSelect={() => window.setTimeout(() => setNaming(''))}>
              {t.plan.views.saveAs}
            </DropdownAction>
            {current === null ? null : (
              <DropdownAction
                tone="danger"
                onSelect={() => {
                  void onSave((list) => list.filter((view) => view.id !== current.id));
                  onOpen(null);
                }}
              >
                {t.plan.views.deleteView}
              </DropdownAction>
            )}
          </>
        ) : null}
      </DropdownMenu>

      <DropdownMenu
        trigger={
          <Button size="sm" variant="ghost">
            <Filter className="size-3.5" />
            {count === 0 ? t.plan.views.filter : t.plan.views.filterCount(count)}
          </Button>
        }
      >
        <DropdownSub label={t.plan.inspector.kind}>
          {pickable(vocabulary.kinds)
            .filter((kind) => type !== 'board' || kind.work)
            .map((kind) => (
              <DropdownItem
                key={kind.id}
                selected={filter.kinds.includes(kind.id)}
                onSelect={() => onFilter({ ...filter, kinds: toggle(filter.kinds, kind.id) })}
              >
                {kindName(t, kind)}
              </DropdownItem>
            ))}
        </DropdownSub>
        <DropdownSub label={t.plan.inspector.status}>
          {pickable(vocabulary.statuses).map((status) => (
            <DropdownItem
              key={status.id}
              selected={filter.statuses.includes(status.id)}
              onSelect={() => onFilter({ ...filter, statuses: toggle(filter.statuses, status.id) })}
            >
              {statusName(t, status)}
            </DropdownItem>
          ))}
        </DropdownSub>
        <DropdownSub label={t.plan.inspector.tags}>
          {tags.length === 0 ? (
            <DropdownAction disabled onSelect={() => undefined}>
              {t.plan.views.noTags}
            </DropdownAction>
          ) : (
            tags.map((tag) => (
              <DropdownItem
                key={tag}
                selected={filter.tags.includes(tag)}
                onSelect={() => onFilter({ ...filter, tags: toggle(filter.tags, tag) })}
              >
                {tag}
              </DropdownItem>
            ))
          )}
        </DropdownSub>
        <DropdownSeparator />
        <DropdownAction disabled={isEmptyFilter(filter)} onSelect={() => onFilter(EMPTY_FILTER)}>
          {t.plan.views.clearFilter}
        </DropdownAction>
      </DropdownMenu>

      {type === 'matrix' ? <AxisPickers axes={axes} onAxes={onAxes} /> : null}

      <label className="relative min-w-40 flex-1 sm:max-w-64">
        <span className="sr-only">{t.plan.views.search}</span>
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          value={filter.text}
          placeholder={t.plan.views.search}
          onChange={(event) => onFilter({ ...filter, text: event.target.value })}
          className="h-7 pl-7 text-xs"
        />
      </label>

      <Modal
        open={naming !== null}
        onOpenChange={(open) => !open && setNaming(null)}
        title={t.plan.views.saveTitle}
        description={t.plan.views.saveDescription}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const name = (naming ?? '').trim();
            if (name === '') return;
            setNaming(null);
            void saveAs(name);
          }}
        >
          <Field label={t.plan.views.viewName}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                maxLength={60}
                value={naming ?? ''}
                onChange={(event) => setNaming(event.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNaming(null)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={(naming ?? '').trim() === ''}>
              {t.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** Two pickers, rows and columns; choosing for one side what the other has swaps them. */
function AxisPickers({ axes, onAxes }: { axes: MatrixAxes; onAxes: (axes: MatrixAxes) => void }) {
  const t = useT();
  const names: Record<MatrixAxis, string> = {
    status: t.plan.inspector.status,
    kind: t.plan.inspector.kind,
    tag: t.plan.inspector.tags,
  };
  const options = MATRIX_AXES.map((axis) => ({ value: axis, label: names[axis] }));
  const pick = (side: keyof MatrixAxes) => (axis: MatrixAxis) => {
    const other = side === 'rows' ? 'columns' : 'rows';
    onAxes({ ...axes, [side]: axis, ...(axes[other] === axis && { [other]: axes[side] }) });
  };
  return (
    <>
      {(['rows', 'columns'] as const).map((side) => (
        <label key={side} className="flex items-center gap-1.5 text-xs text-ink-muted">
          {t.plan.views[side]}
          <Select
            value={axes[side]}
            options={options}
            onChange={pick(side)}
            className="h-7 w-28 py-0 text-xs"
          />
        </label>
      ))}
    </>
  );
}
