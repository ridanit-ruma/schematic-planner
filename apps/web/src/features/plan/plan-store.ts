import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { buildPlanGraph } from '@schematic/schema';
import type { PlanDoc, PlanEdge, PlanNode, Position } from '@schematic/schema';
import { edgesMap, nodesMap, readPlanDoc, type Presence } from '@schematic/ydoc';
import { createStore } from 'zustand/vanilla';
import type * as Y from 'yjs';

import type { PlanFlowEdge, PlanFlowNode } from './types';

export interface PlanState {
  nodes: PlanFlowNode[];
  edges: PlanFlowEdge[];
  title: string;
  description: string;
  selected: string | null;
  peers: Presence[];
  /** Positions other people are dragging right now. Ephemeral, never stored. */
  remoteDrag: Record<string, Position>;

  onNodesChange: (changes: NodeChange<PlanFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PlanFlowEdge>[]) => void;
  select: (slug: string | null) => void;
}

export type PlanStore = ReturnType<typeof createPlanStore>;

function toFlowNode(node: PlanNode, childCount: number): PlanFlowNode {
  return {
    id: node.slug,
    type: 'plan',
    position: node.position ?? { x: 0, y: 0 },
    data: { node, childCount },
    ...(node.kind === 'group' && { zIndex: -1 }),
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
    peers: [],
    remoteDrag: {},

    onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
    onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
    select: (selected) => set({ selected }),
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

    store.setState({
      nodes: nextNodes,
      edges: plan.edges.map(toFlowEdge),
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
