import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type * as M from 'mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown, type Handle, type Options } from 'mdast-util-to-markdown';

/*
 * Two block types have no mdast node of their own. They travel through the
 * tree as these, and the handlers below write them.
 */
interface CalloutNode extends M.Parent {
  type: 'callout';
  variant: string;
  fold: string;
  title: string;
  children: M.BlockContent[];
}

interface DetailsNode extends M.Parent {
  type: 'details';
  summary: string;
  children: M.BlockContent[];
}

const callout: Handle = (node: CalloutNode, _parent, state, info) => {
  const exit = state.enter('blockquote');
  const tracker = state.createTracker(info);
  tracker.move('> ');
  tracker.shift(2);
  const head = `[!${node.variant}]${node.fold}${node.title === '' ? '' : ` ${node.title}`}`;
  const body = state.containerFlow(node as unknown as M.Blockquote, tracker.current());
  exit();
  // A paragraph runs straight on under the title line, which is how Obsidian
  // writes one; anything else starts after a blank quoted line so it cannot be
  // read as a continuation of the title.
  const joiner = node.children[0]?.type === 'paragraph' ? '\n' : '\n\n';
  const value = body === '' ? head : `${head}${joiner}${body}`;
  return state.indentLines(value, (line, _, blank) => `>${blank ? '' : ' '}${line}`);
};

const details: Handle = (node: DetailsNode, _parent, state, info) => {
  const tracker = state.createTracker(info);
  const open = `<details>\n<summary>${escapeHtml(node.summary)}</summary>`;
  const body = state.containerFlow(node as unknown as M.Blockquote, tracker.current());
  return body === '' ? `${open}\n\n</details>` : `${open}\n\n${body}\n\n</details>`;
};

const OPTIONS: Options = {
  bullet: '-',
  bulletOther: '*',
  emphasis: '*',
  strong: '*',
  fence: '`',
  fences: true,
  rule: '-',
  listItemIndent: 'one',
  incrementListMarker: true,
  extensions: [gfmToMarkdown({ tablePipeAlign: false })],
  handlers: { callout, details } as unknown as Options['handlers'],
};

/** The editor's document as Markdown: GFM, with `<details>` toggles and Obsidian callouts. */
export function jsonToMarkdown(doc: JSONContent): string {
  const root: M.Root = { type: 'root', children: flow(doc.content ?? []) as M.RootContent[] };
  return toMarkdown(root, OPTIONS).replace(/\n+$/, '');
}

export function docToMarkdown(doc: PMNode): string {
  return jsonToMarkdown(doc.toJSON() as JSONContent);
}

function text(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(text).join('');
}

function flow(nodes: readonly JSONContent[]): M.BlockContent[] {
  const out: M.BlockContent[] = [];
  for (const node of nodes) {
    const converted = blockOut(node);
    if (converted !== null) out.push(converted);
  }
  return out;
}

function blockOut(node: JSONContent): M.BlockContent | null {
  const attrs = node.attrs ?? {};
  const content = node.content ?? [];
  switch (node.type) {
    case 'paragraph': {
      // Markdown has no empty paragraph: two blank lines are one.
      const children = phrasing(content);
      return children.length === 0 ? null : { type: 'paragraph', children };
    }
    case 'heading': {
      const level = Number(attrs['level'] ?? 1);
      const depth = (level >= 1 && level <= 6 ? level : 1) as M.Heading['depth'];
      return { type: 'heading', depth, children: phrasing(content) };
    }
    case 'blockquote':
      return { type: 'blockquote', children: flow(content) };
    case 'callout':
      return {
        type: 'callout',
        variant: String(attrs['variant'] ?? 'note') || 'note',
        fold: String(attrs['fold'] ?? ''),
        title: String(attrs['title'] ?? '').replace(/\s*\n\s*/g, ' '),
        children: flow(content),
      } as CalloutNode as unknown as M.BlockContent;
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const task = node.type === 'taskList';
      const ordered = node.type === 'orderedList';
      const start = Number(attrs['start'] ?? 1);
      return {
        type: 'list',
        ordered,
        ...(ordered && { start: Number.isFinite(start) ? start : 1 }),
        spread: false,
        children: content.map((item) => ({
          type: 'listItem',
          spread: false,
          checked: task ? item.attrs?.['checked'] === true : null,
          children: flow(item.content ?? []),
        })),
      };
    }
    case 'codeBlock': {
      const info = typeof attrs['language'] === 'string' ? attrs['language'].trim() : '';
      const space = info.indexOf(' ');
      return {
        type: 'code',
        lang: info === '' ? null : space === -1 ? info : info.slice(0, space),
        meta: space === -1 ? null : info.slice(space + 1),
        value: text(node),
      };
    }
    case 'horizontalRule':
      return { type: 'thematicBreak' };
    case 'table':
      return table(content);
    case 'details': {
      const summary = content.find((child) => child.type === 'detailsSummary');
      const inside = content.find((child) => child.type === 'detailsContent');
      return {
        type: 'details',
        summary: summary === undefined ? '' : text(summary).replace(/\s*\n\s*/g, ' '),
        children: flow(inside?.content ?? []),
      } as DetailsNode as unknown as M.BlockContent;
    }
    case 'rawMarkdown':
      // Written back as it was read. `html` is the one mdast node that is
      // emitted verbatim, and a container still prefixes each of its lines.
      return { type: 'html', value: text(node) } as unknown as M.BlockContent;
    default:
      // A block from a newer schema than this one: keep its words.
      if (content.some((child) => child.type === 'text' || child.type === 'hardBreak')) {
        const children = phrasing(content);
        return children.length === 0 ? null : { type: 'paragraph', children };
      }
      return content.length === 0 ? null : { type: 'blockquote', children: flow(content) };
  }
}

function table(rows: readonly JSONContent[]): M.Table {
  const header = rows[0]?.content ?? [];
  const align = header.map((cell) => {
    const value = cell.attrs?.['align'];
    return value === 'left' || value === 'center' || value === 'right' ? value : null;
  });
  return {
    type: 'table',
    align,
    children: rows.map((row) => ({
      type: 'tableRow',
      children: (row.content ?? []).map((cell) => ({
        type: 'tableCell',
        // A cell is one line: several paragraphs, if some client made them,
        // are kept as line breaks.
        children: phrasing(
          (cell.content ?? []).flatMap((paragraph, index) => [
            ...(index > 0 ? [{ type: 'hardBreak' }] : []),
            ...(paragraph.content ?? []),
          ]),
          true,
        ),
      })),
    })),
  };
}

/* Inline content ---------------------------------------------------------- */

interface Run {
  readonly node: JSONContent;
  readonly marks: readonly { type: string; attrs?: Record<string, unknown> }[];
}

/** Outermost first. Code is not here: it is a leaf, never a wrapper. */
const WRAPPERS = ['link', 'bold', 'italic', 'strike'] as const;

function phrasing(nodes: readonly JSONContent[], inTable = false): M.PhrasingContent[] {
  const runs: Run[] = nodes.map((node) => ({ node, marks: node.marks ?? [] }));
  return nest(runs, inTable);
}

function sameMark(
  a: { type: string; attrs?: Record<string, unknown> },
  b: { type: string; attrs?: Record<string, unknown> },
): boolean {
  if (a.type !== b.type) return false;
  if (a.type !== 'link') return true;
  return (
    a.attrs?.['href'] === b.attrs?.['href'] &&
    (a.attrs?.['title'] ?? null) === (b.attrs?.['title'] ?? null)
  );
}

/**
 * Flat runs of marked text as a tree: consecutive runs sharing a mark become
 * one wrapper, so `**a *b* c**` is written as that rather than as three
 * separate bold spans.
 */
function nest(runs: readonly Run[], inTable: boolean): M.PhrasingContent[] {
  const out: M.PhrasingContent[] = [];
  let at = 0;
  while (at < runs.length) {
    const run = runs[at]!;
    const outer = WRAPPERS.find((type) => run.marks.some((mark) => mark.type === type));
    if (outer === undefined) {
      const leafNode = leaf(run, inTable);
      if (leafNode !== null) out.push(leafNode);
      at += 1;
      continue;
    }
    const mark = run.marks.find((candidate) => candidate.type === outer)!;
    let end = at + 1;
    while (end < runs.length && runs[end]!.marks.some((candidate) => sameMark(candidate, mark))) {
      end += 1;
    }
    const inner = runs.slice(at, end).map((each) => ({
      node: each.node,
      marks: each.marks.filter((candidate) => candidate.type !== outer),
    }));
    const children = nest(inner, inTable);
    at = end;
    if (children.length === 0) continue;
    switch (outer) {
      case 'link':
        out.push({
          type: 'link',
          url: typeof mark.attrs?.['href'] === 'string' ? mark.attrs['href'] : '',
          title: typeof mark.attrs?.['title'] === 'string' ? mark.attrs['title'] : null,
          children,
        });
        break;
      case 'bold':
        out.push({ type: 'strong', children });
        break;
      case 'italic':
        out.push({ type: 'emphasis', children });
        break;
      case 'strike':
        out.push({ type: 'delete', children });
        break;
    }
  }
  return merge(out);
}

function leaf(run: Run, inTable: boolean): M.PhrasingContent | null {
  if (run.node.type === 'hardBreak') {
    // A table row is one line; `<br>` is how GFM tables break one.
    return inTable ? { type: 'html', value: '<br>' } : { type: 'break' };
  }
  const value = run.node.text ?? '';
  if (value === '') return null;
  if (run.marks.some((mark) => mark.type === 'code')) return { type: 'inlineCode', value };
  return { type: 'text', value: inTable ? value.replace(/\n/g, ' ') : value };
}

/** Adjacent text, or adjacent code, is one node: two backtick spans side by side would read as one. */
function merge(nodes: M.PhrasingContent[]): M.PhrasingContent[] {
  const out: M.PhrasingContent[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (last?.type === 'text' && node.type === 'text') {
      last.value += node.value;
    } else if (last?.type === 'inlineCode' && node.type === 'inlineCode') {
      last.value += node.value;
    } else {
      out.push(node);
    }
  }
  return out;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
