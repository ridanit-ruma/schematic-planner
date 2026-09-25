import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import type * as M from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

import { bodySchema } from './schema.js';

/** Something the schema has no block for. The block it is in is kept as source instead. */
class Unsupported extends Error {}

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface Context {
  /** The string every `position` offset in the tree refers to. */
  readonly source: string;
  /**
   * Whether the nodes in this flow are whole lines of `source`, so that a
   * slice of it is the Markdown of that node alone. True at the top of a
   * document; false inside a quote or a list, whose lines carry the
   * container's prefix.
   */
  readonly exact: boolean;
}

export function parseMarkdown(markdown: string): M.Root {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

/**
 * Markdown as the editor's document, in ProseMirror's JSON form.
 *
 * Never throws and never drops text: a top-level block the schema cannot hold
 * becomes a `rawMarkdown` block of exactly the lines it was written as.
 */
export function markdownToJSON(markdown: string): JSONContent {
  const content = flow(parseMarkdown(markdown).children, { source: markdown, exact: true });
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

export function markdownToDoc(markdown: string, schema: Schema = bodySchema): PMNode {
  const doc = schema.nodeFromJSON(markdownToJSON(markdown));
  doc.check();
  return doc;
}

function raw(text: string): JSONContent {
  return text === ''
    ? { type: 'rawMarkdown' }
    : { type: 'rawMarkdown', content: [{ type: 'text', text }] };
}

function slice(source: string, from: M.Node, to: M.Node = from): string {
  const start = from.position?.start.offset;
  const end = to.position?.end.offset;
  if (start === undefined || end === undefined) throw new Unsupported('no position');
  return source.slice(start, end);
}

/** Throws unless the node is one the schema accepts, with the content it has. */
function verify(node: JSONContent): JSONContent {
  bodySchema.nodeFromJSON(node).check();
  return node;
}

function nonEmpty(blocks: JSONContent[]): JSONContent[] {
  return blocks.length > 0 ? blocks : [{ type: 'paragraph' }];
}

function flow(children: readonly M.RootContent[], context: Context): JSONContent[] {
  const inner: Context = { source: context.source, exact: false };
  const out: JSONContent[] = [];

  for (let at = 0; at < children.length; at += 1) {
    const child = children[at]!;

    if (child.type === 'html' && DETAILS_START.test(child.value.trim())) {
      let end = -1;
      try {
        const opened = openDetails(child.value);
        end = opened.inner !== null ? at : closingDetails(children, at);
        if (end === -1) throw new Unsupported('unclosed details');
        const content =
          opened.inner !== null
            ? (markdownToJSON(opened.inner).content ?? [])
            : flow(children.slice(at + 1, end), context);
        const summary: JSONContent =
          opened.summary === ''
            ? { type: 'detailsSummary' }
            : { type: 'detailsSummary', content: [{ type: 'text', text: opened.summary }] };
        const node: JSONContent = {
          type: 'details',
          content: [summary, { type: 'detailsContent', content: nonEmpty(content) }],
        };
        out.push(context.exact ? verify(node) : node);
        at = end;
      } catch (error) {
        if (!context.exact || !recoverable(error)) throw error;
        out.push(raw(slice(context.source, child, end > at ? children[end] : child)));
        if (end > at) at = end;
      }
      continue;
    }

    if (!context.exact) {
      out.push(...block(child, inner));
      continue;
    }
    try {
      out.push(...block(child, inner).map(verify));
    } catch (error) {
      if (!recoverable(error)) throw error;
      out.push(raw(slice(context.source, child)));
    }
  }

  return out;
}

/** An unsupported construct, or content ProseMirror refuses (a list item that opens with a heading). */
function recoverable(error: unknown): boolean {
  return error instanceof Unsupported || error instanceof RangeError;
}

function block(node: M.RootContent, context: Context): JSONContent[] {
  switch (node.type) {
    case 'paragraph':
      return [withContent({ type: 'paragraph' }, inline(node.children))];
    case 'heading':
      return [
        withContent({ type: 'heading', attrs: { level: node.depth } }, inline(node.children)),
      ];
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];
    case 'blockquote':
      return [
        callout(node, context) ?? {
          type: 'blockquote',
          content: nonEmpty(flow(node.children, context)),
        },
      ];
    case 'list':
      return [list(node, context)];
    case 'code': {
      const language = node.lang ? (node.meta ? `${node.lang} ${node.meta}` : node.lang) : null;
      return [
        withContent(
          { type: 'codeBlock', attrs: { language } },
          node.value === '' ? [] : [{ type: 'text', text: node.value }],
        ),
      ];
    }
    case 'table':
      return [table(node)];
    default:
      throw new Unsupported(node.type);
  }
}

function withContent(node: JSONContent, content: JSONContent[]): JSONContent {
  return content.length > 0 ? { ...node, content } : node;
}

function list(node: M.List, context: Context): JSONContent {
  const children = node.children.map((item) => boxed(item, node, context.source));
  const checks = children.map((item) => item.checked);
  const task = checks.some((checked) => typeof checked === 'boolean');
  // A task list is a bullet list whose every item has a box. A numbered one, or
  // one where only some items have a box, has no block to go in.
  if (task && (node.ordered === true || checks.some((checked) => typeof checked !== 'boolean'))) {
    throw new Unsupported('mixed task list');
  }

  const items = children.map((item) => ({
    type: task ? 'taskItem' : 'listItem',
    ...(task && { attrs: { checked: item.checked === true } }),
    content: nonEmpty(flow(item.children, context)),
  }));

  if (task) return { type: 'taskList', content: items };
  if (node.ordered === true) {
    return { type: 'orderedList', attrs: { start: node.start ?? 1 }, content: items };
  }
  return { type: 'bulletList', content: items };
}

const BOX = /^\[([ xX])\]$/;

/**
 * `- [ ]` with nothing after the box is an empty to-do, which is how serialize
 * writes one; GFM reads that box as text. An escaped `\[ ]` stays text.
 */
export function boxed(item: M.ListItem, list: M.List, source: string): M.ListItem {
  const head = item.children[0];
  if (list.ordered === true || typeof item.checked === 'boolean' || head?.type !== 'paragraph') {
    return item;
  }
  const box = BOX.exec(slice(source, head));
  if (box === null) return item;
  return { ...item, checked: box[1] !== ' ', children: item.children.slice(1) };
}

function table(node: M.Table): JSONContent {
  const align = node.align ?? [];
  const width = Math.max(...node.children.map((row) => row.children.length));
  return {
    type: 'table',
    content: node.children.map((row, index) => {
      const cells: JSONContent[] = [];
      for (let column = 0; column < width; column += 1) {
        const cell = row.children[column];
        cells.push({
          type: index === 0 ? 'tableHeader' : 'tableCell',
          attrs: { align: align[column] ?? null },
          content: [withContent({ type: 'paragraph' }, cell ? inline(cell.children) : [])],
        });
      }
      return { type: 'tableRow', content: cells };
    }),
  };
}

export const CALLOUT = /^\[!([A-Za-z][\w-]*)\]([+-]?)/;

/**
 * `> [!note] Title` and what follows it, as a callout; anything else is null.
 *
 * The title is taken from the source line rather than from the parsed inline
 * nodes, so it comes back out exactly as it was written.
 */
function callout(quote: M.Blockquote, context: Context): JSONContent | null {
  const first = quote.children[0];
  if (first?.type !== 'paragraph') return null;
  const lead = first.children[0];
  if (lead?.type !== 'text') return null;
  const marker = CALLOUT.exec(lead.value);
  if (marker === null) return null;

  const start = first.position?.start.offset;
  const end = first.position?.end.offset;
  if (start === undefined || end === undefined) return null;
  const newline = context.source.indexOf('\n', start);
  const line = context.source.slice(start, newline === -1 || newline > end ? end : newline);
  // An escaped `\[!note]` is a quote that starts with those words.
  if (!line.startsWith(marker[0])) return null;
  const title = line.slice(marker[0].length).trim();

  const body: JSONContent[] = [];
  const rest = afterFirstLine(first.children);
  const opening = inline(rest);
  if (opening.length > 0) body.push({ type: 'paragraph', content: opening });
  body.push(...flow(quote.children.slice(1), context));

  return {
    type: 'callout',
    attrs: { variant: marker[1], fold: marker[2], title },
    content: nonEmpty(body),
  };
}

/** The inline nodes of a paragraph after its first line ends. */
function afterFirstLine(children: readonly M.PhrasingContent[]): M.PhrasingContent[] {
  for (let at = 0; at < children.length; at += 1) {
    const child = children[at]!;
    if (child.type === 'break') return children.slice(at + 1);
    if (child.type === 'text') {
      const newline = child.value.indexOf('\n');
      if (newline === -1) continue;
      const after = child.value.slice(newline + 1);
      return [...(after === '' ? [] : [{ ...child, value: after }]), ...children.slice(at + 1)];
    }
    // A line break inside emphasis on the title line: nothing to cut it at.
    if (JSON.stringify(child).includes('\\n')) throw new Unsupported('multi-line title');
  }
  return [];
}

const BR = /^<br\s*\/?>$/i;

function inline(nodes: readonly M.PhrasingContent[], marks: readonly Mark[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  const text = (value: string, with_: readonly Mark[]): void => {
    if (value === '') return;
    out.push(
      with_.length > 0
        ? { type: 'text', text: value, marks: [...with_] }
        : { type: 'text', text: value },
    );
  };

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        text(node.value, marks);
        break;
      case 'strong':
        out.push(...inline(node.children, add(marks, { type: 'bold' })));
        break;
      case 'emphasis':
        out.push(...inline(node.children, add(marks, { type: 'italic' })));
        break;
      case 'delete':
        out.push(...inline(node.children, add(marks, { type: 'strike' })));
        break;
      case 'inlineCode':
        text(node.value, add(marks, { type: 'code' }));
        break;
      case 'link': {
        const content = inline(
          node.children,
          add(marks, { type: 'link', attrs: { href: node.url, title: node.title ?? null } }),
        );
        if (content.length === 0) throw new Unsupported('empty link');
        out.push(...content);
        break;
      }
      case 'break':
        out.push({ type: 'hardBreak' });
        break;
      case 'html':
        if (!BR.test(node.value.trim())) throw new Unsupported('inline html');
        out.push({ type: 'hardBreak' });
        break;
      default:
        throw new Unsupported(node.type);
    }
  }
  return out;
}

function add(marks: readonly Mark[], mark: Mark): Mark[] {
  return [...marks.filter((existing) => existing.type !== mark.type), mark];
}

export interface OpenedDetails {
  readonly summary: string;
  /** The inside, when the whole element was written as one HTML block. */
  readonly inner: string | null;
}

export const DETAILS_START = /^<details[\s>]/i;
const DETAILS_OPEN =
  /^<details(?:\s[^>]*)?>\s*(?:<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>)?\s*([\s\S]*)$/i;
const DETAILS_CLOSE = /^<\/details>\s*$/i;

export function openDetails(html: string): OpenedDetails {
  const found = DETAILS_OPEN.exec(html.trim());
  if (found === null) throw new Unsupported('details');
  const summary = decodeHtml((found[1] ?? '').trim());
  if (/<[a-z/!]/i.test(summary)) throw new Unsupported('markup in summary');
  const rest = found[2] ?? '';
  if (rest === '') return { summary, inner: null };
  const closed = /^([\s\S]*?)<\/details>$/i.exec(rest);
  // Content in the same HTML block as an opening tag that does not close
  // there is HTML text, not Markdown, and there is no honest way to split it.
  if (closed === null || /<\/?details/i.test(closed[1] ?? '')) throw new Unsupported('details');
  return { summary, inner: (closed[1] ?? '').trim() };
}

/** Where the `</details>` that closes the one opened at `from` is, or -1. */
export function closingDetails(children: readonly M.RootContent[], from: number): number {
  let depth = 1;
  for (let at = from + 1; at < children.length; at += 1) {
    const child = children[at]!;
    if (child.type !== 'html') continue;
    const value = child.value.trim();
    if (DETAILS_CLOSE.test(value)) {
      depth -= 1;
      if (depth === 0) return at;
    } else if (DETAILS_START.test(value) && !/<\/details>$/i.test(value)) {
      depth += 1;
    }
  }
  return -1;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}
