import type { JSONContent } from '@tiptap/core';
import { updateYFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

import { markdownToDoc } from './parse.js';
import { jsonToMarkdown } from './serialize.js';

/** How y-prosemirror names a mark it allows to overlap with itself. */
const HASHED_MARK = /--[a-zA-Z0-9+/=]{8}$/;

/**
 * A body fragment as ProseMirror JSON, read straight from the Yjs types.
 *
 * Not through y-prosemirror's own reader: that one deletes any element the
 * schema refuses, which is right inside an editor and wrong in code that is
 * only meant to look.
 */
export function fragmentToJSON(fragment: Y.XmlFragment): JSONContent {
  return { type: 'doc', content: children(fragment) };
}

function children(parent: Y.XmlFragment): JSONContent[] {
  const out: JSONContent[] = [];
  for (const child of parent.toArray()) {
    if (child instanceof Y.XmlElement) {
      const node: JSONContent = { type: child.nodeName };
      const attrs = child.getAttributes() as Record<string, unknown>;
      if (Object.keys(attrs).length > 0) node.attrs = attrs;
      const content = children(child);
      if (content.length > 0) node.content = content;
      out.push(node);
    } else if (child instanceof Y.XmlText) {
      for (const op of child.toDelta() as {
        insert: unknown;
        attributes?: Record<string, unknown>;
      }[]) {
        if (typeof op.insert !== 'string' || op.insert === '') continue;
        const marks = Object.entries(op.attributes ?? {})
          .filter(([name]) => name !== 'ychange')
          .map(([name, attrs]) => {
            const type = name.replace(HASHED_MARK, '');
            return attrs !== null && typeof attrs === 'object' && Object.keys(attrs).length > 0
              ? { type, attrs: attrs as Record<string, unknown> }
              : { type };
          });
        out.push(
          marks.length > 0
            ? { type: 'text', text: op.insert, marks }
            : { type: 'text', text: op.insert },
        );
      }
    }
  }
  return out;
}

/*
 * Markdown per fragment, kept until the fragment changes.
 *
 * Every change to a plan re-projects the whole document, and serialising
 * every body each time would make typing in one node cost as much as the plan
 * is long. Invalidation happens in `beforeObserverCalls` — before any observer
 * runs — so a projection made from an observer never sees a stale body,
 * whatever order the observers happen to be called in.
 */
const cache = new WeakMap<Y.AbstractType<unknown>, string>();
const watched = new WeakSet<Y.Doc>();

function watch(doc: Y.Doc): void {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.on('beforeObserverCalls', (transaction: Y.Transaction) => {
    for (const type of transaction.changed.keys()) {
      let current: Y.AbstractType<unknown> | null = type as Y.AbstractType<unknown>;
      while (current !== null) {
        cache.delete(current);
        const item: Y.Item | null = current._item;
        current = item === null ? null : (item.parent as Y.AbstractType<unknown>);
      }
    }
  });
}

/** The body as Markdown. Cached per fragment outside a transaction. */
export function fragmentToMarkdown(fragment: Y.XmlFragment): string {
  const doc = fragment.doc;
  // Inside a transaction the fragment may already differ from what the next
  // invalidation will report, so nothing read there is kept.
  if (doc === null || doc._transaction !== null) return jsonToMarkdown(fragmentToJSON(fragment));

  watch(doc);
  const known = cache.get(fragment as Y.AbstractType<unknown>);
  if (known !== undefined) return known;
  const markdown = jsonToMarkdown(fragmentToJSON(fragment));
  cache.set(fragment as Y.AbstractType<unknown>, markdown);
  return markdown;
}

/**
 * Make the fragment say what the Markdown says, changing as little as it can.
 *
 * The blocks that did not change are left as the same Yjs items, and a
 * changed paragraph is edited as text rather than replaced — so somebody
 * typing in the body at the same moment keeps both their words and their
 * cursor. The fragment must already be part of a document.
 */
export function applyMarkdown(fragment: Y.XmlFragment, markdown: string, origin?: unknown): void {
  const doc = fragment.doc;
  if (doc === null) throw new Error('applyMarkdown needs a fragment that is part of a document');
  const target = markdownToDoc(markdown);
  doc.transact(() => {
    updateYFragment(doc, fragment, target, { mapping: new Map(), isOMark: new Map() });
  }, origin);
}
