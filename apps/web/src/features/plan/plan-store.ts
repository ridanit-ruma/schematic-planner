import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { buildPlanGraph, containmentDepth } from '@schematic/schema';
import type { PlanComment, PlanDoc, PlanEdge, PlanNode, Position } from '@schematic/schema';
import {
  commentsMap,
  edgesMap,
  nodesMap,
  readPlanDoc,
  type Presence,
  type Reading,
} from '@schematic/ydoc';
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
  /**
   * Notes left on the drawing, in the order the document holds them.
   *
   * Not React Flow nodes: a note is not part of the graph, nothing connects to
   * it, and layout must never move it. It is drawn on its own layer over the
   * canvas, which is also what keeps it out of the export's Markdown tree.
   */
  comments: PlanComment[];
  /** The note being read or written, or null. */
  selectedComment: string | null;
  peers: Presence[];
  /**
   * Your own entry on the awareness channel, or null before it is published.
   *
   * The row shows you beside everybody else because a face you recognise is
   * what makes the others legible as faces: four coloured initials with none of
   * them yours reads as a list of strangers, not as who is in the room.
   */
  self: Presence | null;
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
  /**
   * Slugs and edge ids that appeared in the document a moment ago, each with
   * how long to wait before it draws itself in.
   *
   * Derived from the document rather than from a component mounting, so a node
   * scrolling back into view is not an arrival. Opening a plan is one: the
   * drawing puts itself down across the canvas instead of appearing whole. The
   * delays are what keep that from being forty things moving at once — however
   * many arrive, the sweep takes the same short time.
   */
  arrivals: ReadonlyMap<string, number>;
  /**
   * What stays lit while the pointer is on something, or null when it is on
   * nothing. Reading a schematic is following one part's connections, so
   * pointing at a node answers that question directly: its own lines and what
   * they reach keep their colour and everything else steps back.
   */
  related: ReadonlySet<string> | null;
  /**
   * What is being pointed at, which the set above is the answer for.
   *
   * Kept because the answer outlives the question otherwise: delete the node
   * under the pointer and no leave event is ever sent for it, so the rest of
   * the drawing stays stepped back around a node that is not there any more.
   */
  relatedTo: string | null;
  /**
   * An agent walking this plan right now, or null. Published on the awareness
   * channel by whoever is reading, so it arrives and leaves the way a cursor
   * does and never touches the document.
   */
  reading: Reading | null;

  onNodesChange: (changes: NodeChange<PlanFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PlanFlowEdge>[]) => void;
  select: (slug: string | null) => void;
  /** Called as the pointer enters and leaves a node or a line. */
  highlight: (id: string | null, kind?: 'node' | 'edge') => void;
  selectEdge: (id: string | null) => void;
  selectComment: (id: string | null) => void;
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
  // The writing on the line is drawn by PlanEdgeLine, which knows where layout
  // put it. Handing React Flow a `label` as well would draw a second one.
  return { id: edge.id, source, target, type: 'plan', data: { edge } };
}

export function createPlanStore(doc: Y.Doc) {
  const store = createStore<PlanState>((set, get) => ({
    nodes: [],
    edges: [],
    title: '',
    description: '',
    selected: null,
    selectedEdge: null,
    comments: [],
    selectedComment: null,
    peers: [],
    self: null,
    remoteDrag: {},
    absolute: {},
    parentOf: {},
    arrivals: new Map<string, number>(),
    related: null,
    relatedTo: null,
    reading: null,

    onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
    onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
    select: (selected) => set({ selected, selectedEdge: null, selectedComment: null }),
    selectComment: (selectedComment) =>
      set({ selectedComment, selected: null, selectedEdge: null }),

    highlight: (id, kind = 'node') => {
      if (id === null) {
        if (get().related !== null) set({ related: null, relatedTo: null });
        return;
      }
      const { edges, parentOf } = get();
      const related = new Set<string>([id]);

      // The groups a node sits in stay lit with it: a bright card inside a
      // dimmed box reads as a mistake rather than as an answer.
      const withAncestors = (slug: string): void => {
        related.add(slug);
        let parent = parentOf[slug];
        for (let depth = 0; parent !== undefined && depth < 20; depth += 1) {
          related.add(parent);
          parent = parentOf[parent];
        }
      };

      if (kind === 'node') {
        withAncestors(id);
        for (const edge of edges) {
          if (edge.source !== id && edge.target !== id) continue;
          related.add(edge.id);
          withAncestors(edge.source === id ? edge.target : edge.source);
        }
      } else {
        const edge = edges.find((candidate) => candidate.id === id);
        if (edge !== undefined) {
          withAncestors(edge.source);
          withAncestors(edge.target);
        }
      }
      set({ related, relatedTo: id });
    },
    selectEdge: (selectedEdge) => set({ selectedEdge, selected: null, selectedComment: null }),
  }));

  const project = (): PlanDoc => readPlanDoc(doc).doc;

  /** Everything the document has held since this store was built. */
  let known: Set<string> | null = null;
  let settle: ReturnType<typeof setTimeout> | undefined;

  /**
   * How long the sweep takes, whatever arrives in it. Two nodes are two beats
   * apart; forty are forty beats inside the same short window, which is the
   * difference between a drawing being put down and a screen full of movement.
   */
  const NODE_SWEEP_MS = 420;
  const LINE_SWEEP_MS = 320;
  /** Long enough for the last line in the sweep to have finished drawing. */
  const ARRIVAL_MS = NODE_SWEEP_MS + LINE_SWEEP_MS + 640;

  /** Spreads n things across a window, in the order given. */
  function spread(count: number, from: number, over: number): (index: number) => number {
    if (count <= 1) return () => from;
    return (index) => from + (over * index) / (count - 1);
  }

  function noteArrivals(plan: PlanDoc): ReadonlyMap<string, number> {
    const present = new Set<string>([
      ...plan.nodes.map((node) => node.slug),
      ...plan.edges.map((edge) => edge.id),
    ]);

    // The first read of a plan is the empty document, before the socket has
    // said anything; what follows it is the plan arriving, and it is drawn as
    // one. Nothing is exempt, so opening and being drawn into look alike —
    // which is the truth of it.
    const first = known ?? new Set<string>();
    known = present;

    // Left to right, the way it would be drawn by hand. A node with no place
    // yet goes last rather than at the origin.
    const nodes = plan.nodes
      .filter((node) => !first.has(node.slug))
      .sort((a, b) => (a.position?.x ?? Infinity) - (b.position?.x ?? Infinity));
    if (nodes.length === 0 && plan.edges.every((edge) => first.has(edge.id))) {
      return store.getState().arrivals;
    }

    const arrivals = new Map<string, number>();
    const nodeAt = spread(nodes.length, 0, NODE_SWEEP_MS);
    nodes.forEach((node, index) => arrivals.set(node.slug, nodeAt(index)));

    // A line is drawn once both its ends are down, so they are ordered by the
    // later of the two and always start after the last node has settled.
    const edges = plan.edges
      .filter((edge) => !first.has(edge.id))
      .sort(
        (a, b) =>
          Math.max(arrivals.get(a.from) ?? 0, arrivals.get(a.to) ?? 0) -
          Math.max(arrivals.get(b.from) ?? 0, arrivals.get(b.to) ?? 0),
      );
    const edgeAt = spread(edges.length, NODE_SWEEP_MS, LINE_SWEEP_MS);
    edges.forEach((edge, index) => arrivals.set(edge.id, edgeAt(index)));

    // Cleared again so the same node arriving twice animates twice, and so the
    // map does not grow for the life of the page.
    clearTimeout(settle);
    settle = setTimeout(() => store.setState({ arrivals: new Map<string, number>() }), ARRIVAL_MS);
    return arrivals;
  }

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
      arrivals: noteArrivals(plan),
      nodes: nextNodes,
      edges: plan.edges
        .filter((edge) => !(edge.kind === 'contains' && drawnAsBoundary.has(edge.from)))
        .map(toFlowEdge),
      comments: plan.comments,
      title: plan.title,
      description: plan.description,
      absolute,
      parentOf,
      // Nobody is pointing at something that is no longer in the plan. Without
      // this, removing the node under the pointer leaves the whole drawing
      // dimmed with nothing lit, and the only way out is to point at something
      // else and then let go.
      ...(pointingAtSomethingGone(store, plan) ? { related: null, relatedTo: null } : {}),
    });
  };

  function pointingAtSomethingGone(target: typeof store, at: PlanDoc): boolean {
    const { relatedTo } = target.getState();
    if (relatedTo === null) return false;
    return (
      !at.nodes.some((node) => node.slug === relatedTo) &&
      !at.edges.some((edge) => edge.id === relatedTo)
    );
  }

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
  const comments = commentsMap(doc);
  const meta = doc.getMap('meta');

  nodes.observeDeep(onNodes);
  edges.observeDeep(onEdgesOrMeta);
  comments.observeDeep(onEdgesOrMeta);
  meta.observe(onEdgesOrMeta);
  refresh();

  return {
    store,
    doc,
    refresh,
    destroy: () => {
      clearTimeout(settle);
      nodes.unobserveDeep(onNodes);
      edges.unobserveDeep(onEdgesOrMeta);
      comments.unobserveDeep(onEdgesOrMeta);
      meta.unobserve(onEdgesOrMeta);
    },
  };
}
