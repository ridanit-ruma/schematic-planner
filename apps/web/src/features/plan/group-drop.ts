import { mutualShare, overlapShare, type Position, type Rect } from '@schematic/schema';

export interface Size {
  width: number;
  height: number;
}

export type { Rect };

export interface DropTarget {
  slug: string;
  /** Absolute bounds of the group as it is drawn. */
  rect: Rect;
  /** Containment depth. The deepest group under the cursor wins. */
  depth: number;
}

export interface DropResolution {
  /** The group the node belongs to after the drop, or null for the open canvas. */
  parent: string | null;
  /** Absolute position, moved clear of anything it was dropped on top of. */
  position: Position;
}

/**
 * How much has to be in common before the box owns the node.
 *
 * Half, because half is the answer a person can see. The rule this replaces
 * asked where the node's centre landed, which is the same threshold measured at
 * a single point — and a point is invisible, so a card overhanging an edge went
 * in or stayed out for reasons nobody watching could predict. An area is the
 * thing the eye is already judging.
 */
const BELONGS = 0.5;

/**
 * Where a dropped node belongs, and where it ends up.
 *
 * **A drag never takes a node out of a box.** Growing a box and leaving one
 * cannot both be a drag: a box is the bounding box of what it holds, so the way
 * to make one bigger is to drag a child outward — and under a threshold the
 * child left the box at exactly the moment it would have stretched it. A box
 * was grown in small steps, each careful to stay under a number nobody could
 * see, which is the opposite of direct manipulation. **Take out of <box>** in
 * the node's own menu is the way out.
 *
 * For a node on the open canvas the rule is unchanged, because there is no box
 * to stretch and so nothing to trade against: it joins the box it has at least
 * half of the smaller of the two in common with, most in common first. Nothing
 * is clamped either way — a node dropped past an edge takes the edge with it.
 */
export function resolveDrop(
  moved: Rect,
  targets: readonly DropTarget[],
  forbidden: ReadonlySet<string>,
  /** What is already in each box, so a drop does not land on top of one. */
  occupants: ReadonlyMap<string, readonly Rect[]> = new Map(),
  /** The box the node was in before the drag, or null for the open canvas. */
  held: string | null = null,
): DropResolution {
  // Already in one: it stays there, and the box follows it. The share is not
  // consulted, because there is no answer it could give that would be right.
  if (held !== null) {
    return { parent: held, position: clearOf(moved, occupants.get(held) ?? []) };
  }

  const inside = targets
    .filter((target) => !forbidden.has(target.slug))
    .map((target) => ({ target, share: mutualShare(moved, target.rect) }))
    .filter((candidate) => candidate.share >= BELONGS)
    // Most covered first. Among boxes that hold the node equally — one nested
    // inside another, both swallowing it whole — the deeper and then the
    // tighter one, which is the one a person pointed at.
    .sort(
      (a, b) =>
        b.share - a.share ||
        b.target.depth - a.target.depth ||
        a.target.rect.width * a.target.rect.height - b.target.rect.width * b.target.rect.height,
    );

  const chosen = inside[0]?.target;
  if (chosen === undefined) return { parent: null, position: { x: moved.x, y: moved.y } };

  return {
    parent: chosen.slug,
    position: clearOf(moved, occupants.get(chosen.slug) ?? []),
  };
}

/**
 * The same place, unless something is already there.
 *
 * A drop used to be clamped into the room a box had, which put it wherever that
 * arithmetic landed — sometimes exactly on top of a node already in the box.
 * Now that a box grows to hold whatever is in it, there is room in every
 * direction and the only thing worth avoiding is a collision: the node slides
 * down past what it overlaps, keeping the column the person aimed at.
 */
function clearOf(moved: Rect, occupants: readonly Rect[]): Position {
  const GAP = 20;
  let at = { x: moved.x, y: moved.y };

  // Each pass can push the node onto something else, so it settles rather than
  // testing once. Bounded, because occupants that ring each other would loop.
  for (let pass = 0; pass < occupants.length + 1; pass += 1) {
    const hit = occupants.find(
      (other) => overlapShare({ ...at, width: moved.width, height: moved.height }, other) > 0,
    );
    if (hit === undefined) break;
    at = { x: at.x, y: hit.y + hit.height + GAP };
  }

  return at;
}
