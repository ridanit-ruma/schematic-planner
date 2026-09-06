import type { Position } from '@schematic/schema';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

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
  /** Absolute position, moved inside the group if the drop left it straddling. */
  position: Position;
  /** Larger bounds for the group, when what was dropped does not fit the ones it has. */
  grow: Size | null;
}

/**
 * Room a group keeps for its own label and margins. Mirrors CONTAINER_PADDING
 * in @schematic/layout; a node placed by hand should sit where the layout would
 * have put it.
 */
const PADDING = { top: 40, left: 16, bottom: 16, right: 16 };

/**
 * Where a dropped node belongs.
 *
 * Membership follows the drop: whichever group the node's centre lands in owns
 * it, and the node is then moved wholly inside that group. Half in and half out
 * is the one outcome a drop can never produce — the picture would say a node is
 * in a group while the plan says it is not.
 */
export function resolveDrop(
  moved: Rect,
  targets: readonly DropTarget[],
  forbidden: ReadonlySet<string>,
): DropResolution {
  const centre = { x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 };

  const inside = targets
    .filter((target) => !forbidden.has(target.slug))
    .filter(
      (target) =>
        centre.x >= target.rect.x &&
        centre.x <= target.rect.x + target.rect.width &&
        centre.y >= target.rect.y &&
        centre.y <= target.rect.y + target.rect.height,
    )
    // Deepest first, and among equals the tightest fit: dropping into a group
    // that sits inside another means the inner one.
    .sort((a, b) => b.depth - a.depth || a.rect.width * a.rect.height - b.rect.width * b.rect.height);

  const target = inside[0];
  if (target === undefined) {
    return { parent: null, position: { x: moved.x, y: moved.y }, grow: null };
  }

  const room = {
    x: target.rect.x + PADDING.left,
    y: target.rect.y + PADDING.top,
    width: target.rect.width - PADDING.left - PADDING.right,
    height: target.rect.height - PADDING.top - PADDING.bottom,
  };

  const width = Math.max(room.width, moved.width);
  const height = Math.max(room.height, moved.height);
  const grew = width !== room.width || height !== room.height;

  return {
    parent: target.slug,
    position: {
      x: clamp(moved.x, room.x, room.x + width - moved.width),
      y: clamp(moved.y, room.y, room.y + height - moved.height),
    },
    grow: grew
      ? {
          width: width + PADDING.left + PADDING.right,
          height: height + PADDING.top + PADDING.bottom,
        }
      : null,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
