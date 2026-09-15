import type { PlanNode } from './plan.js';

/**
 * Bounds a group is drawn at before anybody has sized it.
 *
 * Wide enough for a card and its padding with room to drop a second one
 * beside it, because the first thing anybody does with an empty group is put
 * something in it, and a box that has to be resized before it can be used is
 * not a box you can use.
 */
export const DEFAULT_GROUP_SIZE = { width: 380, height: 260 } as const;

/**
 * Whether a node is drawn as the boundary around others rather than as a card.
 *
 * Two ways in, and both are needed. Holding something is one: a plan drawn by
 * an agent nests nodes without ever saying the word group, and the box around
 * them is what `contains` means on a canvas. Saying so is the other, and it is
 * the one that was missing — while "is a group" was inferred from "already
 * holds something", a person had no first move. Declaring an empty group draws
 * a box, and a box is what you can drop the first node into.
 */
export function isGroup(node: Pick<PlanNode, 'kind'>, childCount: number): boolean {
  return node.kind === 'group' || childCount > 0;
}

/**
 * The bounds to draw a group at, which are also the bounds to test a drop
 * against. One answer, so the picture and the hit test cannot disagree.
 */
export function groupSize(node: Pick<PlanNode, 'size'>): { width: number; height: number } {
  return node.size ?? DEFAULT_GROUP_SIZE;
}

/**
 * Room a box keeps around what it holds, for its own label and its margins.
 *
 * Mirrors ELK container padding, so a node placed by hand sits where layout
 * would have put it. Every side is a multiple of the grid, which is what leaves
 * an intersection inside a box for a snapped drop to land on.
 */
export const GROUP_PADDING = { top: 40, left: 20, bottom: 20, right: 20 } as const;

export interface Box {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The box that holds these children.
 *
 * What a box is, is what is in it. There is no stored size to honour and no
 * handle to drag, because the two answers disagreed the moment anything moved:
 * a card grows by being typed into, a child is dragged past an edge, and a
 * boundary its contents visibly overflow is the drawing contradicting the
 * document. Deriving it removes the disagreement rather than arbitrating it.
 *
 * Every side follows, not just the right and the bottom. A child dragged above
 * or to the left of the box it is in used to leave it hanging outside; now the
 * box reaches up to it.
 *
 * Null for a box holding nothing — there is nothing to measure, and the caller
 * draws it at its own position and the default size instead.
 */
export function holdingBox(children: readonly Rect[]): Rect | null {
  if (children.length === 0) return null;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const child of children) {
    left = Math.min(left, child.x);
    top = Math.min(top, child.y);
    right = Math.max(right, child.x + child.width);
    bottom = Math.max(bottom, child.y + child.height);
  }

  return {
    x: left - GROUP_PADDING.left,
    y: top - GROUP_PADDING.top,
    width: right - left + GROUP_PADDING.left + GROUP_PADDING.right,
    height: bottom - top + GROUP_PADDING.top + GROUP_PADDING.bottom,
  };
}

/** How much of `moved` lies inside `over`, as a fraction of its own area. */
export function overlapShare(moved: Rect, over: Rect): number {
  const width = Math.min(moved.x + moved.width, over.x + over.width) - Math.max(moved.x, over.x);
  const height = Math.min(moved.y + moved.height, over.y + over.height) - Math.max(moved.y, over.y);
  if (width <= 0 || height <= 0) return 0;
  const area = moved.width * moved.height;
  return area <= 0 ? 0 : (width * height) / area;
}
