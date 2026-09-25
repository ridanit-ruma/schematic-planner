import type { Position } from '@schematic/schema';

import { resolveDrop, type DropTarget, type Rect } from './group-drop';

/** Everything held by a node, at any depth. */
export function descendantsOf(slug: string, parentOf: Readonly<Record<string, string>>): string[] {
  const held: string[] = [];
  const stack = [slug];
  const seen = new Set<string>([slug]);
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const [child, parent] of Object.entries(parentOf)) {
      if (parent !== current || seen.has(child)) continue;
      seen.add(child);
      held.push(child);
      stack.push(child);
    }
  }
  return held;
}

/**
 * What a move writes: where every affected node now is, how far each one went
 * (which is what carries the writing on its lines), and which of them changed
 * the box they are in.
 */
export interface Moves {
  /** Absolute positions, for the moved nodes and everything they hold. */
  positions: Map<string, Position>;
  /** How far each of those went. */
  shifts: Map<string, Position>;
  /** The nodes that were moved by hand, which are pinned where they were put. */
  placed: string[];
  /** Nodes that left one box for another, or for the open canvas. */
  membership: { slug: string; from: string | null; to: string | null }[];
}

/**
 * Moving nodes carries what they hold.
 *
 * A box is drawn around its contents and every node stores an absolute
 * position, so a moved box whose children stayed put would be drawn back where
 * it was. Each moved node takes everything inside it the same distance.
 */
export function carry(
  moved: ReadonlyMap<string, Position>,
  absolute: Readonly<Record<string, Position>>,
  parentOf: Readonly<Record<string, string>>,
): Moves {
  const result: Moves = { positions: new Map(), shifts: new Map(), placed: [], membership: [] };
  for (const [slug, to] of moved) {
    const was = absolute[slug] ?? { x: 0, y: 0 };
    const shift = { x: to.x - was.x, y: to.y - was.y };
    result.positions.set(slug, to);
    result.shifts.set(slug, shift);
    result.placed.push(slug);
    for (const held of descendantsOf(slug, parentOf)) {
      if (moved.has(held)) continue;
      const at = absolute[held];
      if (at === undefined) continue;
      result.positions.set(held, { x: at.x + shift.x, y: at.y + shift.y });
      result.shifts.set(held, shift);
    }
  }
  return result;
}

/**
 * Where a dragged selection lands, one node at a time, as one answer.
 *
 * Each dragged node is resolved against the boxes the way a single node is —
 * it stays in the box it was in, or joins the one it was let go over — and
 * nothing that is moving counts: a dragged node is not dropped into a box that
 * is travelling with it, and it does not slide clear of where a travelling
 * neighbour used to be.
 *
 * `dropped` holds each dragged node's absolute bounds where it was let go,
 * already placed on the grid or the guide it was drawn at.
 */
export function dropSelection(
  dropped: readonly { slug: string; rect: Rect }[],
  context: {
    absolute: Readonly<Record<string, Position>>;
    parentOf: Readonly<Record<string, string>>;
    /** The absolute bounds of every node on the canvas. */
    rects: Readonly<Record<string, Rect>>;
    /** The boxes a node could be dropped into, the lit card among them. */
    targets: readonly DropTarget[];
  },
): Moves {
  const { absolute, parentOf, rects, targets } = context;
  const moving = new Set<string>();
  for (const { slug } of dropped) {
    moving.add(slug);
    for (const held of descendantsOf(slug, parentOf)) moving.add(held);
  }

  const occupants = new Map<string, Rect[]>();
  for (const [slug, holder] of Object.entries(parentOf)) {
    if (moving.has(slug)) continue;
    const rect = rects[slug];
    if (rect === undefined) continue;
    const list = occupants.get(holder) ?? [];
    list.push(rect);
    occupants.set(holder, list);
  }
  const still = targets.filter((target) => !moving.has(target.slug));

  const landed = new Map<string, Position>();
  const membership: Moves['membership'] = [];
  for (const { slug, rect } of dropped) {
    const was = parentOf[slug] ?? null;
    const drop = resolveDrop(rect, still, moving, occupants, was);
    landed.set(slug, drop.position);
    if (drop.parent !== was) membership.push({ slug, from: was, to: drop.parent });
  }

  return { ...carry(landed, absolute, parentOf), membership };
}
