import { topologicalOrder } from './graph.js';
import type { PlanDoc, PlanNode } from './plan.js';
import { categoryOf, isSettled, isWorkKind, type Vocabulary } from './vocabulary.js';

/**
 * What has to come before what, for ordering and for readiness.
 *
 * A flow says the thing it leaves comes first. A `depends_on` points the other
 * way round — at what must exist already — and means the same thing. `contains`
 * is nesting and `relates_to` carries no structure, so neither says anything
 * about order.
 */
export function precedence(doc: Pick<PlanDoc, 'edges'>): Map<string, string[]> {
  const before = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.kind === 'contains' || edge.kind === 'relates_to') continue;
    const [after, first] = edge.kind === 'depends_on' ? [edge.from, edge.to] : [edge.to, edge.from];
    const list = before.get(after) ?? [];
    list.push(first);
    before.set(after, list);
  }
  return before;
}

/**
 * The nodes somebody works on: not the boxes that hold things, nor the
 * remarks beside them.
 *
 * Holding others is the second way to be a box, and the canvas has always drawn
 * it that way — a node with children is the boundary around them whatever it
 * calls itself. A Plan groups its tasks under features, so without this the
 * four slices of a Plan were offered as four things to start.
 */
export function workNodes(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  vocabulary: Vocabulary,
): PlanNode[] {
  const holds = new Set(
    doc.edges.filter((edge) => edge.kind === 'contains').map((edge) => edge.from),
  );
  return doc.nodes.filter((node) => isWorkKind(vocabulary, node.kind) && !holds.has(node.slug));
}

export interface WorkState {
  /** Every piece of work, settled or not. */
  work: PlanNode[];
  /** In an `active` status. */
  running: PlanNode[];
  /** Not started, and nothing it waits on is unfinished — in the order the flows run. */
  ready: PlanNode[];
  /** In a `blocked` status. */
  stuck: PlanNode[];
  /** Not started, with what it still waits on. */
  waiting: { node: PlanNode; on: string[] }[];
}

/**
 * Where a plan's work has got to: what is under way, what can be started now,
 * what is blocked and what waits on unfinished work. Read by status category,
 * not by status id, so a project's own statuses still answer.
 */
export function workState(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  vocabulary: Vocabulary,
): WorkState {
  const before = precedence(doc);
  const status = new Map(doc.nodes.map((node) => [node.slug, node.status]));
  const work = workNodes(doc, vocabulary);
  const settledBy = (slug: string): boolean => isSettled(vocabulary, status.get(slug) ?? '');
  const waitingOn = (slug: string): string[] =>
    (before.get(slug) ?? []).filter((one) => status.has(one) && !settledBy(one));

  const bySlug = new Map(work.map((node) => [node.slug, node]));
  const state: WorkState = { work, running: [], ready: [], stuck: [], waiting: [] };
  for (const slug of topologicalOrder(
    work.map((node) => node.slug),
    before,
  ).order) {
    const node = bySlug.get(slug);
    if (node === undefined || isSettled(vocabulary, node.status)) continue;
    const category = categoryOf(vocabulary, node.status);
    if (category === 'active') state.running.push(node);
    else if (category === 'blocked') state.stuck.push(node);
    else if (waitingOn(slug).length === 0) state.ready.push(node);
    else state.waiting.push({ node, on: waitingOn(slug) });
  }
  return state;
}
