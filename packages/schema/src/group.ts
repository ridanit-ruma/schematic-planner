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

/** The area two boxes have in common, which is zero when they only touch. */
export function overlapArea(one: Rect, other: Rect): number {
  const width = Math.min(one.x + one.width, other.x + other.width) - Math.max(one.x, other.x);
  const height = Math.min(one.y + one.height, other.y + other.height) - Math.max(one.y, other.y);
  return width <= 0 || height <= 0 ? 0 : width * height;
}

/** How much of `moved` lies inside `over`, as a fraction of its own area. */
export function overlapShare(moved: Rect, over: Rect): number {
  const area = moved.width * moved.height;
  return area <= 0 ? 0 : overlapArea(moved, over) / area;
}

/**
 * How much two boxes have in common, as a fraction of the smaller one.
 *
 * The share of the moved node alone is the obvious measure and it cannot
 * express one box going into another: a box is drawn tight around its contents,
 * so nothing the size of a box ever covers half of another box, and nesting
 * became impossible. Against the smaller of the two, a card half over an edge
 * and a box dropped squarely onto another both read the way they look.
 */
export function mutualShare(one: Rect, other: Rect): number {
  const smaller = Math.min(one.width * one.height, other.width * other.height);
  return smaller <= 0 ? 0 : overlapArea(one, other) / smaller;
}
