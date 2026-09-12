import * as Y from 'yjs';
import type { Position } from '@schematic/schema';

import { commentsMap, edgesMap, nodesMap } from './bind.js';
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

/**
 * The bends somebody has dragged a line through.
 *
 * Written whole rather than per point: the list is short, its order is the
 * meaning, and two people bending the same line are disagreeing about its shape
 * rather than editing separate fields of it. Last writer wins, which is what
 * they would both expect to see.
 */
export function commitEdgeWaypoints(
  doc: Y.Doc,
  id: string,
  waypoints: readonly Position[],
  origin: unknown = ORIGIN_LOCAL,
): void {
  const edge = edgesMap(doc).get(id);
  if (edge === undefined) return;
  Y.transact(
    doc,
    () => {
      edge.set(
        'waypoints',
        waypoints.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
      );
    },
    origin,
  );
}

/**
 * Where a note sits, after somebody has moved it. Same reasoning as a node's
 * position: the drag itself is ephemeral and only the resting place is written.
 */
export function commitCommentPosition(
  doc: Y.Doc,
  id: string,
  position: Position,
  origin: unknown = ORIGIN_LOCAL,
): void {
  const comment = commentsMap(doc).get(id);
  if (comment === undefined) return;
  Y.transact(
    doc,
    () => comment.set('position', { x: Math.round(position.x), y: Math.round(position.y) }),
    origin,
  );
}

/** The shared text of one note, so two people can type into it at once. */
export function commentBodyText(doc: Y.Doc, id: string): Y.Text | undefined {
  const body = commentsMap(doc).get(id)?.get('body');
  return body instanceof Y.Text ? body : undefined;
}

export interface NodeSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Carries everything placed along a line — its writing and its bends — with the
 * ends that moved.
 *
 * Both are stored absolute, so a line whose end has been dragged goes without
 * them unless they are brought along. A point a fraction `t` of the way from one
 * end to the other travels `from·(1−t) + to·t`: the end it is nearer pulls it
 * harder, and a point in the middle of a line with one end moving goes half as
 * far. That is exactly the rule the writing already followed, which sat at
 * `t = ½` — it kept the separation layout had worked out instead of letting
 * every note drop back to its midpoint and land on top of the others.
 *
 * The bends are why this cannot simply withdraw the points instead. A person put
 * them there; nothing on the server is entitled to decide they have gone stale.
 */
export function nudgeEdges(
  doc: Y.Doc,
  moved: ReadonlyMap<string, Position>,
  origin: unknown,
): void {
  if (moved.size === 0) return;
  const edges = edgesMap(doc);
  const shift = (slug: unknown): Position =>
    (typeof slug === 'string' ? moved.get(slug) : undefined) ?? { x: 0, y: 0 };
  const carry = (point: Position, from: Position, to: Position, t: number): Position => ({
    x: Math.round(point.x + from.x * (1 - t) + to.x * t),
    y: Math.round(point.y + from.y * (1 - t) + to.y * t),
  });

  Y.transact(
    doc,
    () => {
      for (const [, edge] of edges) {
        const from = shift(edge.get('from'));
        const to = shift(edge.get('to'));
        if (from.x === 0 && from.y === 0 && to.x === 0 && to.y === 0) continue;

        const at = edge.get('labelPosition');
        if (at !== null && at !== undefined) {
          edge.set('labelPosition', carry(at as Position, from, to, 0.5));
        }

        const bends = edge.get('waypoints');
        if (Array.isArray(bends) && bends.length > 0) {
          const points = bends as Position[];
          edge.set(
            'waypoints',
            points.map((point, index) => carry(point, from, to, (index + 1) / (points.length + 1))),
          );
        }
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
