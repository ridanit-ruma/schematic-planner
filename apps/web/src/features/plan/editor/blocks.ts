import type { Editor, Range } from '@tiptap/core';
import {
  AlertCircle,
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table,
  Type,
  type LucideIcon,
} from 'lucide-react';

import type { Messages } from '@/i18n';

export type BlockId = keyof Messages['editor']['blocks'];

export interface Block {
  readonly id: BlockId;
  readonly icon: LucideIcon;
  /** Words a person might type after `/` besides the label in their own language. */
  readonly aliases: readonly string[];
  /** Turns the block the `/` was typed in into this one, after removing `/query`. */
  readonly run: (editor: Editor, range: Range) => void;
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const BLOCKS: readonly Block[] = [
  {
    id: 'paragraph',
    icon: Type,
    aliases: ['text', 'p'],
    run: (e, r) => chain(e, r).setParagraph().run(),
  },
  {
    id: 'heading1',
    icon: Heading1,
    aliases: ['h1', '#'],
    run: (e, r) => chain(e, r).setHeading({ level: 1 }).run(),
  },
  {
    id: 'heading2',
    icon: Heading2,
    aliases: ['h2', '##'],
    run: (e, r) => chain(e, r).setHeading({ level: 2 }).run(),
  },
  {
    id: 'heading3',
    icon: Heading3,
    aliases: ['h3', '###'],
    run: (e, r) => chain(e, r).setHeading({ level: 3 }).run(),
  },
  {
    id: 'bulletList',
    icon: List,
    aliases: ['ul', 'bullet', '-'],
    run: (e, r) => chain(e, r).toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    icon: ListOrdered,
    aliases: ['ol', 'number', '1.'],
    run: (e, r) => chain(e, r).toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    icon: ListChecks,
    aliases: ['todo', 'task', 'check', '[]'],
    run: (e, r) => chain(e, r).toggleTaskList().run(),
  },
  {
    id: 'quote',
    icon: Quote,
    aliases: ['blockquote', '>'],
    run: (e, r) => chain(e, r).toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    icon: Code,
    aliases: ['code', '```'],
    run: (e, r) => chain(e, r).toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    icon: Minus,
    aliases: ['hr', 'rule', '---'],
    run: (e, r) => chain(e, r).setHorizontalRule().run(),
  },
  {
    id: 'table',
    icon: Table,
    aliases: ['table', 'grid'],
    run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
  },
  {
    id: 'toggle',
    icon: ChevronRight,
    aliases: ['details', 'collapse', 'toggle'],
    run: (e, r) => chain(e, r).setDetails().run(),
  },
  {
    id: 'callout',
    icon: AlertCircle,
    aliases: ['callout', 'note', 'tip', 'warning', 'admonition'],
    run: (e, r) => chain(e, r).wrapIn('callout', { variant: 'note' }).run(),
  },
];

/** The blocks matching what was typed after `/`, in the reader's language or by alias. */
export function matchBlocks(query: string, labels: Messages['editor']['blocks']): Block[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return [...BLOCKS];
  return BLOCKS.filter(
    (block) =>
      labels[block.id].toLowerCase().includes(wanted) ||
      block.aliases.some((alias) => alias.startsWith(wanted)) ||
      block.id.toLowerCase().startsWith(wanted),
  );
}
