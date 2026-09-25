import { getSchema, mergeAttributes, Node, type AnyExtension } from '@tiptap/core';
import { Code } from '@tiptap/extension-code';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import type { Schema } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

/** The callout types the block menu offers. Others read from Markdown are kept as written. */
export const CALLOUT_VARIANTS = ['note', 'tip', 'warning', 'danger'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

/**
 * An Obsidian callout: `> [!note] Title` and the quoted lines under it.
 *
 * The title is an attribute rather than a first child: it is one line of
 * Markdown source that Obsidian treats as a heading of the box, and keeping it
 * as written is what lets `> [!tip] **Why**` come back out unchanged.
 */
export const Callout = Node.create<{ HTMLAttributes: Record<string, string> }>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      variant: { default: 'note' },
      title: { default: '' },
      /** Obsidian's fold marker, `+` or `-`, kept so a folded callout stays one. */
      fold: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
        getAttrs: (element) => ({
          variant: element.getAttribute('data-callout') ?? 'note',
          title: element.getAttribute('data-title') ?? '',
          fold: element.getAttribute('data-fold') ?? '',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout': node.attrs['variant'] as string,
        'data-title': node.attrs['title'] as string,
        'data-fold': node.attrs['fold'] as string,
      }),
      0,
    ];
  },
});

/**
 * Markdown the schema has no block for — an image, raw HTML, a footnote —
 * held as the source it was written in.
 *
 * Shown as code and written back verbatim, so an agent's Markdown is never
 * silently dropped or rewritten by a person opening the editor.
 */
export const RawMarkdown = Node.create<{ HTMLAttributes: Record<string, string> }>({
  name: 'rawMarkdown',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'pre[data-raw-markdown]', preserveWhitespace: 'full' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-raw-markdown': '' }),
      ['code', 0],
    ];
  },
});

/**
 * Inline code that can sit inside a link or bold text, as it can in Markdown
 * (`[`api`](…)`). Tiptap's default excludes every other mark, which would turn
 * such a line into something the schema cannot hold.
 */
const CodeInLinks = Code.extend({ excludes: 'code' });

/** A GFM cell holds one line of inline content, so a cell is one paragraph. */
const Cell = TableCell.extend({ content: 'paragraph' });
const HeaderCell = TableHeader.extend({ content: 'paragraph' });

/**
 * Every extension that contributes to the document schema.
 *
 * The browser adds collaboration, menus and node views on top of these; the
 * server uses them as they are. Both therefore agree on what a body can hold,
 * which is what lets the server read and write the same Y.XmlFragment the
 * editor is bound to.
 */
export function bodyExtensions(
  overrides: Partial<Record<'callout' | 'rawMarkdown' | 'details', AnyExtension>> = {},
): AnyExtension[] {
  return [
    StarterKit.configure({
      // No Markdown form, so it would be lost on the first export.
      underline: false,
      code: false,
      // Collaboration brings its own history, and a trailing paragraph written
      // on open would be a write every viewer makes just by looking.
      undoRedo: false,
      trailingNode: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true },
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    CodeInLinks,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    HeaderCell,
    Cell,
    // Open or closed is each reader's own business, as it is in a browser.
    overrides.details ?? Details.configure({ persist: false }),
    DetailsSummary,
    DetailsContent,
    overrides.callout ?? Callout,
    overrides.rawMarkdown ?? RawMarkdown,
  ];
}

/** The schema of a body, for code that has no editor. */
export const bodySchema: Schema = getSchema(bodyExtensions());
