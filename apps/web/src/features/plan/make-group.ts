import { normalizeEdge, planEdgeInputSchema, uniqueSlug, type PlanOp } from '@schematic/schema';

import { t } from '@/i18n';
import type { Rect } from './group-drop';

export interface GroupMember {
  slug: string;
  rect: Rect;
}

/**
 * Room the new box keeps around what it was drawn for. The same margins
 * `resolveDrop` clamps a dropped node into, so a group made by hand and a group
 * laid out by ELK hold their contents the same way.
 */
const PADDING = { top: 40, left: 20, bottom: 20, right: 20 };

/**
 * What a group's identifier is made from. Fixed rather than taken from the
 * title, which is in the reader's language and may have no letters a slug keeps.
 */
const SLUG = 'group';

/**
 * A box drawn around a selection, as one batch of operations.
 *
 * One batch because it is one act: the box, and the fact that these nodes are
 * in it, arrive and are undone together. Two batches would let a person undo
 * into a group that exists and holds nothing.
 *
 * Membership is exclusive — a node sits in one box — so anything that was
 * already held is taken out of what held it. When everything in the selection
 * came out of the *same* box, the new one is put back into it rather than
 * beside it: grouping three of a feature's five tasks makes a box inside that
 * feature, which is what was meant and what the drawing then shows.
 *
 * Returns null when the selection has nothing to group: a box and one thing
 * already inside it is a group, and drawing another around it says nothing.
 */
export function groupOps(
  selection: readonly GroupMember[],
  parentOf: Readonly<Record<string, string>>,
  taken: Iterable<string>,
): { ops: PlanOp[]; slug: string } | null {
  const chosen = new Set(selection.map((member) => member.slug));

  // Anything already inside another node in the selection travels with it.
  // Grouping a box and its contents is grouping the box.
  const members = selection.filter((member) => {
    let parent = parentOf[member.slug];
    for (let depth = 0; parent !== undefined && depth < 20; depth += 1) {
      if (chosen.has(parent)) return false;
      parent = parentOf[parent];
    }
    return true;
  });
  // A selection that collapses to one node is already a group, or is one
  // node. Drawing a box around it says nothing the node does not say itself.
  if (members.length < 2) return null;

  const parents = new Set(members.map((member) => parentOf[member.slug]));
  const shared = parents.size === 1 ? [...parents][0] : undefined;

  const left = Math.min(...members.map((member) => member.rect.x));
  const top = Math.min(...members.map((member) => member.rect.y));
  const right = Math.max(...members.map((member) => member.rect.x + member.rect.width));
  const bottom = Math.max(...members.map((member) => member.rect.y + member.rect.height));

  const slug = uniqueSlug(SLUG, taken);
  const ops: PlanOp[] = [
    {
      op: 'upsert_node',
      node: {
        slug,
        kind: 'group',
        title: t().plan.group.defaultTitle,
        position: { x: Math.round(left - PADDING.left), y: Math.round(top - PADDING.top) },
        size: {
          width: Math.round(right - left + PADDING.left + PADDING.right),
          height: Math.round(bottom - top + PADDING.top + PADDING.bottom),
        },
      },
    },
  ];

  if (shared !== undefined) ops.push(contains(shared, slug));
  for (const member of members) {
    const held = parentOf[member.slug];
    if (held !== undefined) {
      ops.push({ op: 'delete_edge', kind: 'contains', from: held, to: member.slug });
    }
  }
  for (const member of members) ops.push(contains(slug, member.slug));

  return { ops, slug };
}

function contains(from: string, to: string): PlanOp {
  return {
    op: 'upsert_edge',
    edge: normalizeEdge(planEdgeInputSchema.parse({ kind: 'contains', from, to })),
  };
}
