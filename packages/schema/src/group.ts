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
 * Mirrors ELK's container padding, so a node placed by hand sits where layout
 * would have put it. Every side is a multiple of the grid, which is what leaves
 * an intersection inside a box for a snapped drop to land on.
 */
export const GROUP_PADDING = { top: 40, left: 20, bottom: 20, right: 20 } as const;

export interface Box {
  width: number;
  height: number;
}

/**
 * The bounds a box is drawn at: the larger of what somebody gave it and what
 * its contents need.
 *
 * Both halves matter, and the rule this replaces had only one of them. Keeping
 * a stored size untouched is right against an arrange rewriting a person's box
 * and wrong against a child that has outgrown it — and a child can outgrow it
 * now simply by being typed into, since a card is as tall as what it says. A
 * boundary a node visibly overflows is the drawing contradicting the document.
 */
export function growToHold(stored: Box | null, needed: Box | null): Box {
  const floor = stored ?? DEFAULT_GROUP_SIZE;
  if (needed === null) return { width: floor.width, height: floor.height };
  return {
    width: Math.max(floor.width, needed.width),
    height: Math.max(floor.height, needed.height),
  };
}
