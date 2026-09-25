import { PALETTE, tagOf, type PaletteColor, type Vocabulary } from '@schematic/schema';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  DropdownAction,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
} from './dropdown-menu';
import { paletteVar, tagColor, tint } from './vocabulary';

/** What a node allows, mirrored from the schema so the field stops before the server says no. */
const MAX_TAGS = 20;
const MAX_LENGTH = 40;

type Option = { kind: 'pick'; name: string } | { kind: 'create'; name: string };

/**
 * Which options the list offers for what has been typed.
 *
 * The project's tags that contain it and that the node does not already have,
 * then — if nothing the project has is called exactly that — making it. An
 * exact match in another case is the project's tag, not a new one, so `auth`
 * picks `Auth` rather than inventing its twin.
 */
export function tagOptions(
  vocabulary: Pick<Vocabulary, 'tags'>,
  chosen: readonly string[],
  query: string,
): Option[] {
  const wanted = query.trim().toLowerCase();
  const taken = new Set(chosen.map((one) => one.toLowerCase()));
  const picks: Option[] = vocabulary.tags
    .filter((tag) => !taken.has(tag.name.toLowerCase()))
    .filter((tag) => wanted === '' || tag.name.toLowerCase().includes(wanted))
    .map((tag) => ({ kind: 'pick', name: tag.name }));
  const exact = tagOf(vocabulary, wanted) !== undefined || taken.has(wanted);
  if (wanted === '' || exact) return picks;
  return [...picks, { kind: 'create', name: query.trim().slice(0, MAX_LENGTH) }];
}

/**
 * Tags as a multi-select: chips for what the node has, a field that filters
 * what the project has, and Enter to take the highlighted one or make a new
 * one. Backspace in an empty field takes the last chip off.
 *
 * It replaces a comma-separated text field that was re-derived from the node
 * on every keystroke, so a comma or a space typed at the end vanished as it
 * was typed.
 */
export function TagInput({
  id,
  value,
  vocabulary,
  disabled,
  canEditVocabulary,
  onChange,
  onCreate,
  onRecolor,
  onDelete,
}: {
  id?: string;
  value: readonly string[];
  vocabulary: Pick<Vocabulary, 'tags'>;
  disabled?: boolean;
  /** Whether the chip menu may change the project's tags, not only this node's. */
  canEditVocabulary: boolean;
  onChange: (tags: string[]) => void;
  /** A tag typed here that the project did not have. */
  onCreate: (name: string) => void;
  onRecolor: (name: string, color: PaletteColor) => void;
  /** Out of the project's list. Nodes keep the name. */
  onDelete: (name: string) => void;
}) {
  const t = useT();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const options = useMemo(() => tagOptions(vocabulary, value, query), [vocabulary, value, query]);
  const full = value.length >= MAX_TAGS;
  const active = Math.min(highlight, Math.max(options.length - 1, 0));

  const choose = (option: Option): void => {
    if (full) return;
    if (option.kind === 'create') onCreate(option.name);
    onChange([...value, option.name]);
    setQuery('');
    setHighlight(0);
  };

  const remove = (name: string): void => onChange(value.filter((one) => one !== name));

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-rule bg-surface px-1.5 py-1',
          'transition-[border-color,box-shadow] duration-100 focus-within:focus-glow',
          disabled === true && 'pointer-events-none opacity-45',
        )}
        onClick={() => input.current?.focus()}
      >
        {value.map((name) => (
          <TagChip
            key={name}
            name={name}
            color={tagColor(vocabulary, name)}
            known={tagOf(vocabulary, name) !== undefined}
            canEditVocabulary={canEditVocabulary && disabled !== true}
            onRemove={() => remove(name)}
            onRecolor={(color) => onRecolor(name, color)}
            onDelete={() => onDelete(name)}
          />
        ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          maxLength={MAX_LENGTH}
          placeholder={value.length === 0 ? t.vocab.tags.placeholder : ''}
          className="min-w-20 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-faint"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setHighlight((active + step + options.length) % Math.max(options.length, 1));
              setOpen(true);
            } else if (event.key === 'Enter' || event.key === ',') {
              // A comma still ends a tag, for hands that learned the old field,
              // and so never becomes part of one.
              event.preventDefault();
              const option = options[active];
              if (option === undefined || (event.key === ',' && query.trim() === '')) return;
              choose(option);
            } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
              event.preventDefault();
              remove(value[value.length - 1] ?? '');
            } else if (event.key === 'Escape') {
              if (query !== '') {
                event.stopPropagation();
                setQuery('');
              } else {
                setOpen(false);
              }
            }
          }}
        />
      </div>

      {open && !full && (options.length > 0 || query.trim() !== '') ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-rule bg-surface-3 p-1 elevated"
        >
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-ink-faint">{t.vocab.tags.none}</li>
          ) : (
            options.map((option, index) => (
              <li
                key={`${option.kind}:${option.name}`}
                role="option"
                aria-selected={index === active}
                // Keeps the field focused, so the list does not close before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(option)}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm text-ink',
                  index === active && 'bg-surface-4',
                )}
              >
                {option.kind === 'create' ? (
                  <>
                    <Plus className="size-3.5 text-ink-faint" />
                    <span className="truncate">{t.vocab.tags.create(option.name)}</span>
                  </>
                ) : (
                  <span
                    className="truncate rounded-sm border px-1.5 text-xs leading-5"
                    style={tint(tagColor(vocabulary, option.name))}
                  >
                    {option.name}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function TagChip({
  name,
  color,
  known,
  canEditVocabulary,
  onRemove,
  onRecolor,
  onDelete,
}: {
  name: string;
  color: string;
  /** Still in the project's list. A deleted tag has no colour or menu entries to offer. */
  known: boolean;
  canEditVocabulary: boolean;
  onRemove: () => void;
  onRecolor: (color: PaletteColor) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const current = PALETTE.find((one) => paletteVar(one) === color);

  return (
    <span
      className="inline-flex max-w-full items-center rounded-sm border text-xs leading-5"
      style={tint(color)}
    >
      <DropdownMenu
        trigger={
          <button
            type="button"
            aria-label={t.vocab.tags.menu(name)}
            className="inline-flex min-w-0 items-center gap-0.5 rounded-l-sm py-0 pr-0.5 pl-1.5 outline-none focus-visible:focus-glow"
          >
            <span className="truncate">{name}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </button>
        }
      >
        {known && canEditVocabulary ? (
          <>
            <DropdownLabel>
              <span className="text-2xs text-ink-faint">{t.vocab.tags.color}</span>
            </DropdownLabel>
            <div className="grid grid-cols-5 gap-1 px-2 pb-1.5">
              {PALETTE.map((one) => (
                <button
                  key={one}
                  type="button"
                  title={t.vocab.colors[one]}
                  aria-label={t.vocab.colors[one]}
                  onClick={() => onRecolor(one)}
                  className="grid size-5 place-items-center rounded-full outline-none focus-visible:focus-glow"
                  style={{ background: paletteVar(one) }}
                >
                  {current === one ? <Check className="size-3 text-white" /> : null}
                </button>
              ))}
            </div>
            <DropdownSeparator />
          </>
        ) : null}
        <DropdownItem onSelect={onRemove}>{t.vocab.tags.removeFromNode}</DropdownItem>
        {known && canEditVocabulary ? (
          <DropdownAction tone="danger" onSelect={onDelete}>
            <span className="flex flex-col">
              <span>{t.vocab.tags.deleteFromProject}</span>
              <span className="text-2xs text-ink-faint">{t.vocab.tags.deleteHint}</span>
            </span>
          </DropdownAction>
        ) : null}
      </DropdownMenu>
      <button
        type="button"
        aria-label={t.vocab.tags.remove(name)}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="rounded-r-sm px-0.5 opacity-60 outline-none hover:opacity-100 focus-visible:focus-glow"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
