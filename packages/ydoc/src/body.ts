import { applyMarkdown, fragmentToMarkdown } from '@schematic/body';
import { toggleTask } from '@schematic/schema';
import * as Y from 'yjs';

import { nodesMap } from './bind.js';
import { ORIGIN_LOCAL, ORIGIN_MIGRATE, type YNode } from './keys.js';

/*
 * A node's body is a Y.XmlFragment the block editor is bound to. Everything
 * outside the editor — the canvas, the history, export, agents — reads and
 * writes it as Markdown, through the functions here.
 *
 * Beside it, under `bodySource`, sits the Markdown it was last written as and
 * what that Markdown reads back as. The serialiser writes one spelling of each
 * construct (`-` bullets, `**bold**`), so without this a body an agent wrote
 * with `*` bullets would come back rewritten the moment it became a fragment:
 * every export would change and the history would report an edit nobody made.
 * While the fragment still says what it said when it was written, the words
 * as written are what is read; the first real edit retires them.
 */

const BODY = 'body';
const SOURCE = 'bodySource';

interface BodySource {
  /** The Markdown as it was written. */
  readonly markdown: string;
  /** What the fragment read back as straight after that write. */
  readonly normalized: string;
}

function isSource(value: unknown): value is BodySource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BodySource).markdown === 'string' &&
    typeof (value as BodySource).normalized === 'string'
  );
}

/** A node's body as Markdown, whichever form it is stored in. */
export function readNodeBody(node: YNode): string {
  const body = node.get(BODY);
  if (body instanceof Y.XmlFragment) {
    const markdown = fragmentToMarkdown(body);
    const source = node.get(SOURCE);
    return isSource(source) && source.normalized === markdown ? source.markdown : markdown;
  }
  // Written before bodies were fragments, and not yet loaded by the server
  // that converts them.
  if (body instanceof Y.Text) return body.toString();
  return typeof body === 'string' ? body : '';
}

function remember(node: YNode, markdown: string, fragment: Y.XmlFragment): void {
  const normalized = fragmentToMarkdown(fragment);
  if (normalized === markdown) {
    if (node.has(SOURCE)) node.delete(SOURCE);
  } else {
    node.set(SOURCE, { markdown, normalized } satisfies BodySource);
  }
}

/**
 * Make a node's body say `markdown`. Unchanged blocks are left alone, so a
 * person typing in the body at the same moment keeps their words and their
 * place. Call inside a transaction; the node must already be in the document.
 */
export function setNodeBody(node: YNode, markdown: string): void {
  let body = node.get(BODY);
  if (body instanceof Y.XmlFragment && readNodeBody(node) === markdown) return;
  if (!(body instanceof Y.XmlFragment)) {
    body = new Y.XmlFragment();
    node.set(BODY, body);
  }
  const fragment = body as Y.XmlFragment;
  applyMarkdown(fragment, markdown);
  remember(node, markdown, fragment);
}

/**
 * Give `target` a copy of `source`'s body. A Yjs type cannot move, so a
 * renamed node gets its blocks cloned — marks, attributes and all — rather
 * than re-read from Markdown.
 */
export function copyNodeBody(source: YNode, target: YNode): void {
  const body = source.get(BODY);
  if (!(body instanceof Y.XmlFragment)) return;
  const copy = new Y.XmlFragment();
  target.set(BODY, copy);
  copy.insert(
    0,
    body.toArray().map((child) => child.clone() as Y.XmlElement | Y.XmlText),
  );
  const remembered = source.get(SOURCE);
  if (isSource(remembered)) target.set(SOURCE, remembered);
}

/**
 * The fragment behind a node's body, for binding the editor to. A body still
 * in its old form is converted first, which the server normally does on load.
 */
export function nodeBodyFragment(doc: Y.Doc, slug: string): Y.XmlFragment | undefined {
  const node = nodesMap(doc).get(slug);
  if (node === undefined) return undefined;
  const body = node.get(BODY);
  if (body instanceof Y.XmlFragment) return body;
  Y.transact(doc, () => convert(node), ORIGIN_MIGRATE);
  return node.get(BODY) as Y.XmlFragment;
}

/**
 * Tick or untick the `index`th task in a node's body, counted as the canvas
 * counts them — in the Markdown it draws. Only that item's attribute changes.
 */
export function toggleNodeTask(
  doc: Y.Doc,
  slug: string,
  index: number,
  origin: unknown = ORIGIN_LOCAL,
): void {
  const node = nodesMap(doc).get(slug);
  if (node === undefined) return;
  const before = readNodeBody(node);
  const after = toggleTask(before, index);
  if (after === before) return;
  Y.transact(doc, () => setNodeBody(node, after), origin);
}

function convert(node: YNode): boolean {
  const body = node.get(BODY);
  if (body instanceof Y.XmlFragment) return false;
  const markdown = body instanceof Y.Text ? body.toString() : typeof body === 'string' ? body : '';
  const fragment = new Y.XmlFragment();
  node.set(BODY, fragment);
  if (markdown !== '') {
    applyMarkdown(fragment, markdown);
    remember(node, markdown, fragment);
  }
  return true;
}

/**
 * Turn every body still stored as text into a fragment, in one transaction.
 *
 * The server runs this when it loads a document and before any client syncs,
 * so each body is converted exactly once, in one place; running it again finds
 * nothing to do. Returns how many bodies it converted.
 */
export function migrateBodies(doc: Y.Doc, origin: unknown = ORIGIN_MIGRATE): number {
  let converted = 0;
  const nodes = nodesMap(doc);
  const pending = [...nodes.values()].filter((node) => !(node.get(BODY) instanceof Y.XmlFragment));
  if (pending.length === 0) return 0;
  Y.transact(
    doc,
    () => {
      for (const node of pending) {
        if (convert(node)) converted += 1;
      }
    },
    origin,
  );
  return converted;
}
