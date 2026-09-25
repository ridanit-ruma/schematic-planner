import type * as M from 'mdast';

import { CALLOUT, DETAILS_START, closingDetails, openDetails, parseMarkdown } from './parse.js';

/*
 * A Markdown tree reshaped for a renderer that turns mdast into HTML elements
 * (react-markdown, through mdast-util-to-hast), so that a card draws a body the
 * way the editor does:
 *
 * - a `<details>` toggle becomes real `details`/`summary` elements rather than
 *   HTML source printed as text;
 * - an Obsidian callout is a blockquote marked `data-callout="<type>"`, its
 *   `[!type]` marker taken off and its title line set apart;
 * - a single newline breaks the line, as it does in the editor.
 *
 * `data.hName` and `data.hProperties` are how mdast asks the HTML step for a
 * particular element; nothing here builds markup.
 */
export function shapeForDisplay(tree: M.Root): void {
  shapeFlow(tree);
}

type FlowParent = M.Parent & { children: M.RootContent[] };

const PHRASING_PARENTS = new Set([
  'paragraph',
  'heading',
  'tableCell',
  'emphasis',
  'strong',
  'delete',
  'link',
]);

function shapeFlow(parent: FlowParent): void {
  const out: M.RootContent[] = [];
  const children = parent.children;

  for (let at = 0; at < children.length; at += 1) {
    const child = children[at]!;

    if (child.type === 'html' && DETAILS_START.test(child.value.trim())) {
      const toggle = details(children, at);
      if (toggle !== null) {
        out.push(toggle.node);
        at = toggle.end;
        continue;
      }
    }

    if (child.type === 'blockquote') markCallout(child);
    shape(child);
    out.push(child);
  }

  parent.children = out;
}

function shape(node: M.RootContent): void {
  if (!('children' in node)) return;
  if (PHRASING_PARENTS.has(node.type)) {
    shapeInline(node as M.Parent);
  } else {
    shapeFlow(node as FlowParent);
  }
}

function details(
  children: readonly M.RootContent[],
  at: number,
): { node: M.RootContent; end: number } | null {
  try {
    const opened = openDetails((children[at] as M.Html).value);
    const end = opened.inner !== null ? at : closingDetails(children, at);
    if (end === -1) return null;
    const content =
      opened.inner !== null ? parseMarkdown(opened.inner).children : children.slice(at + 1, end);
    const summary: M.Paragraph = {
      type: 'paragraph',
      data: { hName: 'summary' },
      children: opened.summary === '' ? [] : [{ type: 'text', value: opened.summary }],
    };
    const node = {
      type: 'blockquote',
      data: { hName: 'details' },
      children: [summary, ...content],
    } as M.Blockquote;
    shapeFlow(node as FlowParent);
    return { node, end };
  } catch {
    // Not a toggle the editor would make either; it stays as it was written.
    return null;
  }
}

function markCallout(quote: M.Blockquote): void {
  const first = quote.children[0];
  if (first?.type !== 'paragraph') return;
  const lead = first.children[0];
  if (lead?.type !== 'text') return;
  const marker = CALLOUT.exec(lead.value);
  if (marker === null) return;

  quote.data = { ...quote.data, hProperties: { dataCallout: (marker[1] ?? 'note').toLowerCase() } };

  // Split the first paragraph at the end of its first line: before is the
  // title, after is the start of the body.
  const rest: M.PhrasingContent[] = [
    { ...lead, value: lead.value.slice(marker[0].length).replace(/^[ \t]+/, '') },
    ...first.children.slice(1),
  ];
  const title: M.PhrasingContent[] = [];
  let body: M.PhrasingContent[] = [];
  for (let at = 0; at < rest.length; at += 1) {
    const child = rest[at]!;
    if (child.type === 'break') {
      body = rest.slice(at + 1);
      break;
    }
    if (child.type === 'text' && child.value.includes('\n')) {
      const newline = child.value.indexOf('\n');
      title.push({ ...child, value: child.value.slice(0, newline) });
      const after = child.value.slice(newline + 1);
      body = [...(after === '' ? [] : [{ ...child, value: after }]), ...rest.slice(at + 1)];
      break;
    }
    title.push(child);
  }

  const blocks: M.BlockContent[] = [];
  const titleText = title.filter((child) => child.type !== 'text' || child.value.trim() !== '');
  if (titleText.length > 0) {
    blocks.push({
      type: 'paragraph',
      data: { hProperties: { dataCalloutTitle: '' } },
      children: title,
    });
  }
  if (body.length > 0) blocks.push({ type: 'paragraph', children: body });
  quote.children = [...blocks, ...quote.children.slice(1)];
}

/** A newline inside a paragraph is a line break, as it is in the editor. */
function shapeInline(parent: M.Parent): void {
  const out: M.RootContent[] = [];
  for (const child of parent.children as M.RootContent[]) {
    if (child.type === 'text' && child.value.includes('\n')) {
      const lines = child.value.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) out.push({ type: 'break' });
        if (line !== '') out.push({ type: 'text', value: line });
      });
      continue;
    }
    if ('children' in child) shapeInline(child as M.Parent);
    out.push(child);
  }
  (parent as FlowParent).children = out;
}
