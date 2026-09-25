import {
  isDefaultName,
  kindOf,
  statusOf,
  tagOf,
  type KindLook,
  type PaletteColor,
  type Vocabulary,
  type VocabularyKind,
  type VocabularyStatus,
} from '@schematic/schema';
import type { CSSProperties, ReactNode } from 'react';

import type { Messages } from '@/i18n';
import { cn } from '@/lib/utils';

/** A palette colour as the stylesheet defines it. */
export function paletteVar(color: PaletteColor): string {
  return `var(--palette-${color})`;
}

/** What a value nobody defined is drawn in: present, and saying nothing. */
export const UNKNOWN_COLOR = 'var(--ink-faint)';

export function statusColor(vocabulary: Vocabulary, id: string): string {
  const status = statusOf(vocabulary, id);
  return status === undefined ? UNKNOWN_COLOR : paletteVar(status.color);
}

/**
 * What a status is called on screen.
 *
 * A default that nobody renamed is shown in the reader's language: the name
 * stored for it is the English one it was born with, and a Korean team that
 * never touched its statuses should not find them in English. Once somebody
 * renames it, the name is theirs and is shown as written.
 */
export function statusName(t: Messages, status: Pick<VocabularyStatus, 'id' | 'name'>): string {
  if (isDefaultName(status, 'statuses')) {
    return (t.plan.labels.status as Record<string, string>)[status.id] ?? status.name;
  }
  return status.name;
}

export function kindName(t: Messages, kind: Pick<VocabularyKind, 'id' | 'name'>): string {
  if (isDefaultName(kind, 'kinds')) {
    return (t.plan.labels.nodeKind as Record<string, string>)[kind.id] ?? kind.name;
  }
  return kind.name;
}

/** A node's status as words, including one the project does not know. */
export function statusLabel(t: Messages, vocabulary: Vocabulary, id: string): string {
  const status = statusOf(vocabulary, id);
  return status === undefined ? t.vocab.unknown(id) : statusName(t, status);
}

export function kindLabel(t: Messages, vocabulary: Vocabulary, id: string): string {
  const kind = kindOf(vocabulary, id);
  return kind === undefined ? t.vocab.unknown(id) : kindName(t, kind);
}

/** Tinted rather than filled, so a row of them reads as labels and not as buttons. */
export function tint(color: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    color: `color-mix(in srgb, ${color} 55%, var(--ink))`,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
  };
}

export function Pill({
  color,
  children,
  className,
}: {
  color: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 truncate rounded-full border px-2 py-px text-xs leading-5',
        className,
      )}
      style={tint(color)}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * How a card of each look is outlined. The card and the swatches in the
 * pickers both read this, so the picker shows what choosing it will draw.
 */
export const LOOK_BORDER: Record<KindLook, string> = {
  solid: 'border border-rule',
  strong: 'border border-rule-strong',
  dashed: 'border border-dashed border-rule',
  clipped:
    'border border-rule-strong [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]',
};

/** The same outlines at swatch size, a little brighter so they read in a menu. */
const SWATCH: Record<KindLook | 'unknown', string> = {
  solid: 'border border-ink-faint',
  strong: 'border-2 border-ink-muted',
  dashed: 'border border-dashed border-ink-muted',
  clipped:
    'border border-ink-muted [clip-path:polygon(0_0,calc(100%-4px)_0,100%_4px,100%_100%,0_100%)]',
  unknown: 'border border-dotted border-ink-faint',
};

export function KindSwatch({ look, className }: { look: KindLook | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2.5 w-3.5 shrink-0 rounded-[2px] bg-surface-2',
        SWATCH[look ?? 'unknown'],
        className,
      )}
    />
  );
}

/** The colour a tag is drawn in, or the neutral one for a name the project no longer lists. */
export function tagColor(vocabulary: Pick<Vocabulary, 'tags'>, name: string): string {
  const tag = tagOf(vocabulary, name);
  return tag === undefined ? UNKNOWN_COLOR : paletteVar(tag.color);
}
