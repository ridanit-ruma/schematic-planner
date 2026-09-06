import * as Y from 'yjs';
import {
  applyPlanOps,
  sanitizePlanDoc,
  type PlanDoc,
  type PlanEdge,
  type PlanNode,
  type PlanOp,
  type SanitizeResult,
} from '@schematic/schema';

import { EDGES_KEY, META_KEY, NODES_KEY, ORIGIN_AGENT, type YEdge, type YNode } from './keys.js';

export function metaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(META_KEY);
}

/**
 * Nodes and edges are keyed maps, never arrays. React Flow reorders its arrays
 * freely and an array CRDT turns that into duplicated or lost entries under
 * concurrent editing; a map keyed by id has no order to disagree about.
 */
export function nodesMap(doc: Y.Doc): Y.Map<YNode> {
  return doc.getMap<YNode>(NODES_KEY);
}

export function edgesMap(doc: Y.Doc): Y.Map<YEdge> {
  return doc.getMap<YEdge>(EDGES_KEY);
}

export function isEmpty(doc: Y.Doc): boolean {
  return nodesMap(doc).size === 0 && edgesMap(doc).size === 0 && metaMap(doc).size === 0;
}

function readBody(node: YNode): string {
  const body = node.get('body');
  if (body instanceof Y.Text) return body.toString();
  return typeof body === 'string' ? body : '';
}

function setBody(node: YNode, value: string): void {
  const body = node.get('body');
  if (body instanceof Y.Text) {
    // Replace in place so the Y.Text identity, and therefore any cursor another
    // client is holding inside it, survives the write.
    if (body.toString() === value) return;
    body.delete(0, body.length);
    if (value !== '') body.insert(0, value);
    return;
  }
  const text = new Y.Text();
  if (value !== '') text.insert(0, value);
  node.set('body', text);
}

function readNode(node: YNode): unknown {
  return {
    slug: node.get('slug'),
    kind: node.get('kind'),
    title: node.get('title'),
    body: readBody(node),
    status: node.get('status'),
    position: node.get('position') ?? null,
    pinned: node.get('pinned') ?? false,
    size: node.get('size') ?? null,
    tags: node.get('tags') ?? [],
  };
}

function readEdge(edge: YEdge): unknown {
  return {
    id: edge.get('id'),
    kind: edge.get('kind'),
    from: edge.get('from'),
    to: edge.get('to'),
    label: edge.get('label') ?? null,
    via: edge.get('via') ?? null,
    carries: edge.get('carries') ?? null,
    labelPosition: edge.get('labelPosition') ?? null,
  };
}

/**
 * Project the collaborative document into the validated read model. Repair, not
 * rejection: see `sanitizePlanDoc` for why a live CRDT can hold states no client
 * intended.
 */
export function readPlanDoc(doc: Y.Doc, options: { updatedAt?: string } = {}): SanitizeResult {
  const meta = metaMap(doc);
  const id = meta.get('id');

  return sanitizePlanDoc({
    id: typeof id === 'string' && id !== '' ? id : 'unknown',
    title: meta.get('title'),
    description: meta.get('description'),
    ...(options.updatedAt !== undefined && { updatedAt: options.updatedAt }),
    nodes: [...nodesMap(doc).values()].map(readNode),
    edges: [...edgesMap(doc).values()].map(readEdge),
  });
}

function writeNode(target: YNode, node: PlanNode): void {
  target.set('slug', node.slug);
  target.set('kind', node.kind);
  target.set('title', node.title);
  target.set('status', node.status);
  target.set('position', node.position);
  target.set('pinned', node.pinned);
  target.set('size', node.size);
  target.set('tags', node.tags);
  setBody(target, node.body);
}

function writeEdge(target: YEdge, edge: PlanEdge): void {
  target.set('id', edge.id);
  target.set('kind', edge.kind);
  target.set('from', edge.from);
  target.set('to', edge.to);
  target.set('label', edge.label);
  target.set('via', edge.via);
  target.set('carries', edge.carries);
  target.set('labelPosition', edge.labelPosition);
}

/** Write a whole plan into an empty document. Used when a plan is first opened. */
export function initializePlan(doc: Y.Doc, plan: PlanDoc, origin: unknown = ORIGIN_AGENT): void {
  Y.transact(
    doc,
    () => {
      const meta = metaMap(doc);
      meta.set('id', plan.id);
      meta.set('version', plan.version);
      meta.set('title', plan.title);
      meta.set('description', plan.description);

      const nodes = nodesMap(doc);
      const edges = edgesMap(doc);
      nodes.clear();
      edges.clear();

      for (const node of plan.nodes) {
        const target = new Y.Map<unknown>();
        nodes.set(node.slug, target);
        writeNode(target, node);
      }
      for (const edge of plan.edges) {
        const target = new Y.Map<unknown>();
        edges.set(edge.id, target);
        writeEdge(target, edge);
      }
    },
    origin,
  );
}

/**
 * The single write door, mirroring `applyPlanOps`.
 *
 * The pure implementation runs first over the current snapshot: if the batch
 * would leave the plan invalid it throws there and the CRDT is never touched.
 * Everything that survives is then applied inside one transaction, so a plan
 * built by an agent appears on every open canvas in a single step rather than
 * node by node.
 */
export function applyOps(doc: Y.Doc, ops: readonly PlanOp[], origin: unknown = ORIGIN_AGENT): PlanDoc {
  const current = readPlanDoc(doc).doc;
  const next = applyPlanOps(current, ops);
  const byslug = new Map(next.nodes.map((node) => [node.slug, node]));
  const byId = new Map(next.edges.map((edge) => [edge.id, edge]));

  Y.transact(
    doc,
    () => {
      const meta = metaMap(doc);
      const nodes = nodesMap(doc);
      const edges = edgesMap(doc);

      for (const op of ops) {
        switch (op.op) {
          case 'upsert_node': {
            const resolved = byslug.get(op.node.slug);
            if (resolved === undefined) break;
            let target = nodes.get(op.node.slug);
            if (target === undefined) {
              target = new Y.Map<unknown>();
              nodes.set(op.node.slug, target);
            }
            writeNode(target, resolved);
            break;
          }
          case 'delete_node': {
            nodes.delete(op.slug);
            for (const [id, edge] of edges) {
              if (edge.get('from') === op.slug || edge.get('to') === op.slug) edges.delete(id);
            }
            break;
          }
          case 'upsert_edge':
          case 'delete_edge': {
            // Both are resolved from the projected result, which already knows
            // the derived edge id and whether the edge survived.
            break;
          }
          case 'set_plan': {
            if (op.title !== undefined) meta.set('title', op.title);
            if (op.description !== undefined) meta.set('description', op.description);
            break;
          }
        }
      }

      // Edges are reconciled as a set rather than op by op: their ids are derived
      // from their endpoints, so the projected result is the authority on which
      // ones should exist.
      for (const [id] of edges) {
        if (!byId.has(id)) edges.delete(id);
      }
      for (const [id, edge] of byId) {
        let target = edges.get(id);
        if (target === undefined) {
          target = new Y.Map<unknown>();
          edges.set(id, target);
        }
        writeEdge(target, edge);
      }

      for (const [slug] of nodes) {
        if (!byslug.has(slug)) nodes.delete(slug);
      }

      meta.set('id', next.id);
      meta.set('version', next.version);
    },
    origin,
  );

  return next;
}
