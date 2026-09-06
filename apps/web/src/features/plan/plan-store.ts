import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { buildPlanGraph } from '@schematic/schema';
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

  onNodesChange: (changes: NodeChange<PlanFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PlanFlowEdge>[]) => void;
  select: (slug: string | null) => void;
  selectEdge: (id: string | null) => void;
  setConnectKind: (kind: PlanEdgeKind) => void;
}

export type PlanStore = ReturnType<typeof createPlanStore>;

function toFlowNode(node: PlanNode, childCount: number): PlanFlowNode {
  const isContainer = childCount > 0;
  return {
    id: node.slug,
    type: 'plan',
    position: node.position ?? { x: 0, y: 0 },
    data: { node, childCount },
    // A container paints below the nodes it holds, but not below the edge layer:
    // a negative index put it behind the edges, and its own handles then could
    // not be reached at all. Its body is click-through instead — see PlanNodeCard.
    zIndex: isContainer ? 0 : 1,
    ...(isContainer &&
      node.size !== null && {
        style: { width: node.size.width, height: node.size.height },
      }),
  };
}

function toFlowEdge(edge: PlanEdge): PlanFlowEdge {
  // Dependencies point from what is needed to what needs it, so the arrows read
  // in build order — the same direction the export numbers files in.
  const [source, target] = edge.kind === 'depends_on' ? [edge.to, edge.from] : [edge.from, edge.to];
  return {
    id: edge.id,
    source,
    target,
    type: 'plan',
    data: { edge },
    ...(edge.label !== null && { label: edge.label }),
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
    connectKind: 'depends_on',
    peers: [],
    remoteDrag: {},

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

    const nextNodes = plan.nodes.map((node) => {
      const existing = previous.get(node.slug);
      const childCount = graph.childrenOf.get(node.slug)?.length ?? 0;
      if (existing !== undefined && touched !== undefined && !touched.has(node.slug)) {
        return existing;
      }
      if (
        existing !== undefined &&
        existing.data.node === node &&
        existing.data.childCount === childCount
      ) {
        return existing;
      }
      return { ...toFlowNode(node, childCount), selected: existing?.selected ?? false };
    });

    // A node holding others is drawn as the boundary around them, which already
    // says what a containment line would. Drawing it as well produced long
    // dashed paths wandering across the canvas and reading as phantom boxes.
    const drawnAsBoundary = new Set(
      plan.nodes
        .filter((node) => (graph.childrenOf.get(node.slug)?.length ?? 0) > 0 && node.size !== null)
        .map((node) => node.slug),
    );

    store.setState({
      nodes: nextNodes,
      edges: plan.edges
        .filter((edge) => !(edge.kind === 'contains' && drawnAsBoundary.has(edge.from)))
        .map(toFlowEdge),
      title: plan.title,
      description: plan.description,
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
