import type { PlanDoc, PlanEdge, PlanNode } from './plan.js';

export const planChangeKinds = [
  'plan.title',
  'plan.description',
  'plan.arranged',
  'node.added',
  'node.removed',
  'node.renamed',
  'node.status',
  'node.kind',
  'node.body',
  'node.tags',
  'edge.added',
  'edge.removed',
] as const;

export type PlanChangeKind = (typeof planChangeKinds)[number];

export interface PlanChangeEntry {
  readonly kind: PlanChangeKind;
  /** The slug or edge id this is about. Empty for changes to the plan itself. */
  readonly subject: string;
  /** What the subject was called when it changed, so the log still reads after a rename. */
  readonly label: string;
  /** What it became, where saying so is short enough to be worth reading. */
  readonly detail: string | null;
}

/**
 * What changed between two versions of a plan.
 *
 * Everything reaches the document the same way — the editor, the REST API and
 * MCP all end in the same CRDT — so comparing the projection catches every
 * path, where intercepting operations would miss a drag or a keystroke.
 *
 * Moving nodes is deliberately summarised rather than listed. A drag or an
 * arrange rewrites coordinates by the dozen, and a log that reported each one
 * would bury the changes that alter what the plan says.
 */
export function diffPlans(before: PlanDoc, after: PlanDoc): PlanChangeEntry[] {
  const entries: PlanChangeEntry[] = [];

  if (before.title !== after.title) {
    entries.push({ kind: 'plan.title', subject: '', label: after.title, detail: before.title });
  }
  if (before.description !== after.description) {
    entries.push({ kind: 'plan.description', subject: '', label: after.title, detail: null });
  }

  const was = new Map(before.nodes.map((node) => [node.slug, node]));
  const is = new Map(after.nodes.map((node) => [node.slug, node]));

  for (const node of after.nodes) {
    const previous = was.get(node.slug);
    if (previous === undefined) {
      entries.push({ kind: 'node.added', subject: node.slug, label: node.title, detail: null });
      continue;
    }
    entries.push(...nodeChanges(previous, node));
  }

  for (const node of before.nodes) {
    if (!is.has(node.slug)) {
      entries.push({ kind: 'node.removed', subject: node.slug, label: node.title, detail: null });
    }
  }

  const edgesWere = new Map(before.edges.map((edge) => [edge.id, edge]));
  const edgesAre = new Map(after.edges.map((edge) => [edge.id, edge]));

  for (const edge of after.edges) {
    if (!edgesWere.has(edge.id)) {
      entries.push({ kind: 'edge.added', subject: edge.id, label: edgeLabel(edge, is), detail: edge.kind });
    }
  }
  for (const edge of before.edges) {
    if (!edgesAre.has(edge.id)) {
      entries.push({ kind: 'edge.removed', subject: edge.id, label: edgeLabel(edge, was), detail: edge.kind });
    }
  }

  const moved = after.nodes.filter((node) => {
    const previous = was.get(node.slug);
    return previous !== undefined && !samePosition(previous, node);
  }).length;
  if (moved > 0) {
    entries.push({
      kind: 'plan.arranged',
      subject: '',
      label: after.title,
      detail: String(moved),
    });
  }

  return entries;
}

function nodeChanges(before: PlanNode, after: PlanNode): PlanChangeEntry[] {
  const entries: PlanChangeEntry[] = [];
  const at = (kind: PlanChangeKind, detail: string | null): PlanChangeEntry => ({
    kind,
    subject: after.slug,
    label: after.title,
    detail,
  });

  if (before.title !== after.title) entries.push(at('node.renamed', before.title));
  if (before.status !== after.status) entries.push(at('node.status', `${before.status} → ${after.status}`));
  if (before.kind !== after.kind) entries.push(at('node.kind', `${before.kind} → ${after.kind}`));
  if (before.body !== after.body) entries.push(at('node.body', null));
  if (before.tags.join(' ') !== after.tags.join(' ')) {
    entries.push(at('node.tags', after.tags.join(' ')));
  }
  return entries;
}

function edgeLabel(edge: PlanEdge, nodes: ReadonlyMap<string, PlanNode>): string {
  const name = (slug: string): string => nodes.get(slug)?.title ?? slug;
  return `${name(edge.from)} → ${name(edge.to)}`;
}

function samePosition(before: PlanNode, after: PlanNode): boolean {
  if (before.position === null || after.position === null) {
    return before.position === after.position;
  }
  return before.position.x === after.position.x && before.position.y === after.position.y;
}
