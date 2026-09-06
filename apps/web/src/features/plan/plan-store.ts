import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { buildPlanGraph, containmentDepth } from '@schematic/schema';
import type { PlanDoc, PlanEdge, PlanEdgeKind, PlanNode, Position } from '@schematic/schema';
import { edgesMap, nodesMap, readPlanDoc, type Presence } from '@schematic/ydoc';
import { createStore } from 'zustand/vanilla';
import type * as Y from 'yjs';

import type { PlanFlowEdge, PlanFlowNode } from './types';

export interface PlanState {
  nodes: PlanFlowNode[];
  edges: PlanFlowEdge[];
  title: string;
  description: string;
  /** Slug of the selected node, or null. */
  selected: string | null;
  /** Id of the selected edge, or null. A node and an edge are never both selected. */
  selectedEdge: string | null;
  /** What the next connection drawn on the canvas will mean. */
  connectKind: PlanEdgeKind;
  peers: Presence[];
  /** Positions other people are dragging right now. Ephemeral, never stored. */
  remoteDrag: Record<string, Position>;
  /**
   * Absolute position of every node. The canvas hands React Flow positions
   * relative to the group a node sits in, so this is what anything reasoning
   * about the plan's own coordinates — a drop, a hit test — reads instead.
   */
  absolute: Record<string, Position>;
  /** The group each node belongs to, where that group is drawn as a boundary. */
  parentOf: Record<string, string>;

  onNodesChange: (changes: NodeChange<PlanFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PlanFlowEdge>[]) => void;
  select: (slug: string | null) => void;
  selectEdge: (id: string | null) => void;
  setConnectKind: (kind: PlanEdgeKind) => void;
}

export type PlanStore = ReturnType<typeof createPlanStore>;

function toFlowNode(
  node: PlanNode,
  childCount: number,
  parent: { slug: string; position: Position } | null,
  depth: number,
): PlanFlowNode {
  const isContainer = childCount > 0;
  const absolute = node.position ?? { x: 0, y: 0 };
  return {
    id: node.slug,
    type: 'plan',
    // React Flow places a child within its parent, which is what makes a group
    // carry its contents when it is dragged. The plan stores absolute
    // coordinates, so the two are converted at this boundary and nowhere else.
    position:
      parent === null
        ? absolute
        : { x: absolute.x - parent.position.x, y: absolute.y - parent.position.y },
    ...(parent !== null && { parentId: parent.slug }),
    data: { node, childCount },
    // Every node sits above the edge layer, or a line routed across a group's
    // terminal buries it and the group cannot be connected to at all. Within
    // that, a container stays under what it holds, at every depth of nesting.
    zIndex: depth * 10 + (isContainer ? 1 : 2),
    ...(isContainer &&
      node.size !== null && {
        style: { width: node.size.width, height: node.size.height },
      }),
  };
}

function toFlowEdge(edge: PlanEdge): PlanFlowEdge {
  // Dependencies point from what is needed to what needs it, so the arrows read
  // in build order — the same direction the export numbers files in. A flow is
  // drawn the way it actually moves, which is the whole of what it says.
  const [source, target] = edge.kind === 'depends_on' ? [edge.to, edge.from] : [edge.from, edge.to];
  const note = edge.kind === 'flows_to' ? (edge.via ?? edge.carries) : edge.label;
  return {
    id: edge.id,
    source,
    target,
    type: 'plan',
    data: { edge },
    ...(note !== null && { label: note }),
  };
}

export function createPlanStore(doc: Y.Doc) {
  const store = createStore<PlanState>((set, get) => ({
    nodes: [],
    edges: [],
    title: '',
    description: '',
    selected: null,
    selectedEdge: null,
    connectKind: 'flows_to',
    peers: [],
    remoteDrag: {},
    absolute: {},
    parentOf: {},

    onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
    onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
    select: (selected) => set({ selected, selectedEdge: null }),
    selectEdge: (selectedEdge) => set({ selectedEdge, selected: null }),
    setConnectKind: (connectKind) => set({ connectKind }),
  }));

  const project = (): PlanDoc => readPlanDoc(doc).doc;

  /**
   * Rebuilds only the entries whose slugs changed and keeps every other node
   * object identical. React Flow memoises node components on that identity, so
   * moving one node re-renders one node instead of the whole graph.
   */
  const refresh = (touched?: ReadonlySet<string>): void => {
    const plan = project();
    const graph = buildPlanGraph(plan);
    const previous = get_nodes();

    // A node holding others is drawn as the boundary around them, which already
    // says what a containment line would. Drawing it as well produced long
    // dashed paths wandering across the canvas and reading as phantom boxes.
    // Only a group with bounds can hold anything: without them there is no box
    // to be inside, so its children stay on the open canvas.
    const drawnAsBoundary = new Set(
      plan.nodes
        .filter((node) => (graph.childrenOf.get(node.slug)?.length ?? 0) > 0 && node.size !== null)
        .map((node) => node.slug),
    );

    const byslug = new Map(plan.nodes.map((node) => [node.slug, node]));
    const absolute: Record<string, Position> = {};
    const parentOf: Record<string, string> = {};
    for (const node of plan.nodes) {
      absolute[node.slug] = node.position ?? { x: 0, y: 0 };
      const parent = graph.parentOf.get(node.slug);
      if (parent !== undefined && drawnAsBoundary.has(parent)) parentOf[node.slug] = parent;
    }

    // React Flow needs a parent before its children, so the list is walked down
    // the containment tree rather than taken in document order.
    const ordered: PlanNode[] = [];
    const seen = new Set<string>();
    const walk = (slug: string): void => {
      const node = byslug.get(slug);
      if (node === undefined || seen.has(slug)) return;
      seen.add(slug);
      ordered.push(node);
      for (const child of graph.childrenOf.get(slug) ?? []) walk(child);
    };
    for (const root of graph.roots) walk(root);
    // A containment cycle leaves nodes unreachable from any root. They are still
    // part of the plan and still have to be drawn.
    for (const node of plan.nodes) if (!seen.has(node.slug)) ordered.push(node);

    const nextNodes = ordered.map((node) => {
      const existing = previous.get(node.slug);
      const childCount = graph.childrenOf.get(node.slug)?.length ?? 0;
      const parentSlug = parentOf[node.slug];
      const parent =
        parentSlug === undefined
          ? null
          : { slug: parentSlug, position: absolute[parentSlug] ?? { x: 0, y: 0 } };

      if (
        existing !== undefined &&
        existing.data.node === node &&
        existing.data.childCount === childCount &&
        existing.parentId === parentSlug
      ) {
        return existing;
      }
      if (
        existing !== undefined &&
        touched !== undefined &&
        !touched.has(node.slug) &&
        existing.parentId === parentSlug
      ) {
        return existing;
      }
      return {
        ...toFlowNode(node, childCount, parent, containmentDepth(graph, node.slug)),
        selected: existing?.selected ?? false,
      };
    });

    store.setState({
      nodes: nextNodes,
      edges: plan.edges
        .filter((edge) => !(edge.kind === 'contains' && drawnAsBoundary.has(edge.from)))
        .map(toFlowEdge),
      title: plan.title,
      description: plan.description,
      absolute,
      parentOf,
    });
  };

  function get_nodes(): Map<string, PlanFlowNode> {
    return new Map(store.getState().nodes.map((node) => [node.id, node]));
  }

  type DeepEvent = Y.YEvent<Y.AbstractType<unknown>>;

  const onNodes = (events: DeepEvent[]): void => {
    const touched = new Set<string>();
    for (const event of events) {
      if (event.target === nodesMap(doc)) {
        for (const key of event.changes.keys.keys()) touched.add(key);
      } else {
        const [key] = event.path;
        if (typeof key === 'string') touched.add(key);
      }
    }
    refresh(touched);
  };

  const onEdgesOrMeta = (): void => refresh(new Set());

  const nodes = nodesMap(doc);
  const edges = edgesMap(doc);
  const meta = doc.getMap('meta');

  nodes.observeDeep(onNodes);
  edges.observeDeep(onEdgesOrMeta);
  meta.observe(onEdgesOrMeta);
  refresh();

  return {
    store,
    doc,
    refresh,
    destroy: () => {
      nodes.unobserveDeep(onNodes);
      edges.unobserveDeep(onEdgesOrMeta);
      meta.unobserve(onEdgesOrMeta);
    },
  };
}
