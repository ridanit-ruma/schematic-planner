import * as Y from 'yjs';
import type { Position } from '@schematic/schema';

import { edgesMap, nodesMap } from './bind.js';
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

export interface NodeSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Carries the writing on a line along with the ends that moved.
 *
 * A label's stored point is absolute, chosen by the layout run that placed the
 * nodes — the only thing that knows what else is nearby, which is why it is
 * worth keeping. Move one end by hand and the line goes without it.
 *
 * Moving one end moves the middle of a line by half as far, and moving both
 * moves it by the whole, so that is what the note is shifted by. It keeps the
 * separation layout worked out while staying on its own line; dropping the
 * point instead and letting every note fall to its midpoint put three of them
 * on top of each other.
 */
export function nudgeLabels(
  doc: Y.Doc,
  moved: ReadonlyMap<string, Position>,
  origin: unknown,
): void {
  if (moved.size === 0) return;
  const edges = edgesMap(doc);
  const shift = (slug: unknown): Position =>
    (typeof slug === 'string' ? moved.get(slug) : undefined) ?? { x: 0, y: 0 };

  Y.transact(
    doc,
    () => {
      for (const [, edge] of edges) {
        const at = edge.get('labelPosition');
        if (at === null || at === undefined) continue;
        const from = shift(edge.get('from'));
        const to = shift(edge.get('to'));
        const dx = (from.x + to.x) / 2;
        const dy = (from.y + to.y) / 2;
        if (dx === 0 && dy === 0) continue;
        const point = at as Position;
        edge.set('labelPosition', {
          x: Math.round(point.x + dx),
          y: Math.round(point.y + dy),
        });
      }
    },
    origin,
  );
}

/**
 * Apply a batch of positions from an auto-layout run in one transaction, plus
 * the bounds computed for any node that contains others.
 */
export function commitLayout(
  doc: Y.Doc,
  positions: ReadonlyMap<string, Position>,
  origin: unknown,
  sizes?: ReadonlyMap<string, NodeSize>,
  labels?: ReadonlyMap<string, Position>,
): void {
  const nodes = nodesMap(doc);
  const edges = edgesMap(doc);
  Y.transact(
    doc,
    () => {
      for (const [slug, position] of positions) {
        const node = nodes.get(slug);
        if (node === undefined) continue;
        node.set('position', { x: Math.round(position.x), y: Math.round(position.y) });
      }
      for (const [slug, size] of sizes ?? []) {
        const node = nodes.get(slug);
        if (node === undefined) continue;
        node.set('size', { width: Math.round(size.width), height: Math.round(size.height) });
      }
      // Where the writing on each line goes, worked out by the same run that
      // placed the nodes — it is the only thing that knows what else is there.
      for (const [id, position] of labels ?? []) {
        const edge = edges.get(id);
        if (edge === undefined) continue;
        edge.set('labelPosition', { x: Math.round(position.x), y: Math.round(position.y) });
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
