import * as Y from 'yjs';
import type { Position } from '@schematic/schema';

import { nodesMap } from './bind.js';
import { ORIGIN_LOCAL } from './keys.js';

/**
 * Commit a finished drag. Called from `onNodeDragStop`, never from `onNodesChange`:
 * in-flight movement travels over awareness instead. See `Presence`.
 */
export function commitNodePosition(
  doc: Y.Doc,
  slug: string,
  position: Position,
  origin: unknown = ORIGIN_LOCAL,
): void {
  const node = nodesMap(doc).get(slug);
  if (node === undefined) return;
  Y.transact(
    doc,
    () => {
      node.set('position', { x: Math.round(position.x), y: Math.round(position.y) });
      node.set('pinned', true);
    },
    origin,
  );
}

/** Apply a batch of positions from an auto-layout run in one transaction. */
export function commitLayout(
  doc: Y.Doc,
  positions: ReadonlyMap<string, Position>,
  origin: unknown,
): void {
  const nodes = nodesMap(doc);
  Y.transact(
    doc,
    () => {
      for (const [slug, position] of positions) {
        const node = nodes.get(slug);
        if (node === undefined) continue;
        node.set('position', { x: Math.round(position.x), y: Math.round(position.y) });
      }
    },
    origin,
  );
}

/**
 * The collaborative text behind a node's body, for binding a rich text editor.
 * Editing through this merges character by character; replacing the whole string
 * would make the last writer win.
 */
export function nodeBodyText(doc: Y.Doc, slug: string): Y.Text | undefined {
  const node = nodesMap(doc).get(slug);
  if (node === undefined) return undefined;
  const body = node.get('body');
  if (body instanceof Y.Text) return body;

  const text = new Y.Text();
  if (typeof body === 'string' && body !== '') text.insert(0, body);
  node.set('body', text);
  return text;
}
