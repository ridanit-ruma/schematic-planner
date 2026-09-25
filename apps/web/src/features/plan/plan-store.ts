import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import {
  DEFAULT_GROUP_SIZE,
  buildPlanGraph,
  cardBounds,
  cardHeight,
  containmentDepth,
  holdingBox,
  isGroup,
  type Box,
  type Rect,
} from '@schematic/schema';
import type { PlanComment, PlanDoc, PlanEdge, PlanNode, Position } from '@schematic/schema';
import {
  ORIGIN_LOCAL,
  commentsMap,
  commitEdgeRoute,
  commitLayout,
  edgesMap,
  nodesMap,
  readPlanDoc,
  toggleNodeTask,
  type Presence,
  type Reading,
} from '@schematic/ydoc';
import { createStore } from 'zustand/vanilla';
import type * as Y from 'yjs';

import type { PlanFlowEdge, PlanFlowNode } from './types';

/** Every change but the one that says something no longer exists. */
function kept<T extends { type: string }>(changes: readonly T[]): T[] {
  return changes.filter((change) => change.type !== 'remove');
}

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
   * What each box holds, under the same rule `parentOf` is built by.
   *
   * The inverse of `parentOf`, built in the same pass so that the two cannot
   * disagree about what a box is. The lighting reads it: pointing at a box is
   * a walk down from it, and there was no way down before this.
   */
  childrenOf: Record<string, string[]>;
  /**
   * The box every node is drawn at.
   *
   * A card's height is not stored anywhere: what it has to say decides it, so
   * it is measured here, and a box around it is grown to hold what it measured.
   * Anything reasoning about where things are — a drop, a hit test — reads this
   * rather than asking the document for a size it may not have.
   */
  bounds: Record<string, Box>;
  /**
   * The width a card is being dragged to, while the drag is still happening.
   *
   * Not in the document, and gone the moment the grip is let go. A box is the
   * bounding box of what it holds and what it holds is read from the document,
   * so until the drag committed the box stayed the size it was while the card
   * grew straight out through its edge. This is what the box is worked out
   * from instead, for as long as there is a drag to work it out from.
   */
  sizing: Record<string, Box>;
  /**
   * The card a dragged node has been held over long enough to turn into a box,
   * or null.
   *
   * Dropping into something already drawn as a box is ordinary and immediate.
   * Turning an ordinary card into one is a change to the structure of the plan,
   * and in a dense drawing a card is very easy to pass over on the way to
   * somewhere else — so that one asks to be meant. Held still over a card, it
   * lights up, and what happens when you let go was visible before you did.
   */
  armed: string | null;
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

  /**
   * Whether this viewer may change the drawing.
   *
   * React Flow hands a custom edge its data and nothing else, so a line has no
   * way of being told by a prop whether to offer the handles that bend it. The
   * canvas, which is where the answer arrives, puts it here.
   */
  editable: boolean;
  setEditable: (editable: boolean) => void;
  /** The bends a line has been dragged through, on the grid if one is on. */
  routeEdge: (
    id: string,
    corners: readonly Position[],
    labelPosition?: Position | null,
  ) => void;

  onNodesChange: (changes: NodeChange<PlanFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<PlanFlowEdge>[]) => void;
  select: (slug: string | null) => void;
  /** Called as the pointer enters and leaves a node or a line. */
  highlight: (id: string | null, kind?: 'node' | 'edge') => void;
  /** Lights the card a drag has been held over. See `armed`. */
  arm: (slug: string | null) => void;
  /** Bounds a person has dragged a group's corner to. */
  resizeNode: (slug: string, size: { width: number; height: number }) => void;
  sizeNode: (slug: string, size: { width: number; height: number }) => void;
  /** Ticks or unticks a to-do in a node's body, counted as the card draws them. */
  toggleTask: (slug: string, index: number) => void;
  selectEdge: (id: string | null) => void;
  selectComment: (id: string | null) => void;
}

export type PlanStore = ReturnType<typeof createPlanStore>;

function toFlowNode(
  node: PlanNode,
  childCount: number,
  parent: { slug: string; position: Position } | null,
  depth: number,
  box: Box,
  // Where the node is drawn, which for a box is where its contents are rather
  // than what its own record says.
  absolute: Position,
): PlanFlowNode {
  const boundary = isGroup(node, childCount);
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
    zIndex: depth * 10 + (boundary ? 1 : 2),
    // Every node is drawn at the box that was worked out for it, boundary or
    // card alike. One number per node, used by the drawing, by the hit test
    // and by whatever encloses it, so none of the three can disagree.
    style: { width: box.width, height: box.height },
  };
}

/**
 * Colour is data here, and the one piece of data a line has of its own is
 * whether what it leaves has stopped.
 *
 * So a flow out of a blocked node is drawn in the blocked colour and every
 * other line stays neutral. It answers the question a reader actually brings to
 * a flow diagram — where does this stop — and it answers it in one hue, on a
 * minority of lines, in a plan that has anything wrong with it at all. Giving a
 * person a colour picker per line was the alternative and it is the wrong
 * trade: in this drawing line style already carries the relation, so a free
 * colour would be the only mark on the canvas that means whatever its author
 * privately decided.
 */
function toFlowEdge(edge: PlanEdge, from: PlanNode | undefined): PlanFlowEdge {
  // Dependencies point from what is needed to what needs it, so the arrows read
  // in build order — the same direction the export numbers files in. A flow is
  // drawn the way it actually moves, which is the whole of what it says.
  const [source, target] = edge.kind === 'depends_on' ? [edge.to, edge.from] : [edge.from, edge.to];
  // The writing on the line is drawn by PlanEdgeLine, which knows where layout
  // put it. Handing React Flow a `label` as well would draw a second one.
  const stopped = edge.kind === 'flows_to' && from?.status === 'blocked';
  return { id: edge.id, source, target, type: 'plan', data: { edge, stopped } };
}

/**
 * What a dragged width comes to for one node, or nothing at all.
 *
 * Only a card has a width to give. A box is what it holds, and writing a size
 * for one would be a second answer that the next drag contradicts. The height
 * is not a person's to choose: it is what the body comes to at that width, and
 * it is worked out here so that the drag and the commit cannot disagree about
 * it.
 */
function sizeOfCard(state: PlanState, slug: string, width: number): Box | null {
  if (!state.editable) return null;
  const node = state.nodes.find((candidate) => candidate.id === slug)?.data;
  if (node === undefined || isGroup(node.node, node.childCount)) return null;
  return { width, height: cardHeight(node.node.body, width) };
}

export function createPlanStore(doc: Y.Doc) {
  const store = createStore<PlanState>((set, get) => ({
    editable: false,
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
    childrenOf: {},
    bounds: {},
    sizing: {},
    arrivals: new Map<string, number>(),
    related: null,
    relatedTo: null,
    reading: null,
    armed: null,

    // A removal is not this store's to make. React Flow raises one for its
    // own delete key, and applying it here took the thing off the screen and
    // left it in the document, so it came back the moment anything else
    // changed. Existence is the document's answer; the canvas asks for a
    // deletion through an op and waits to be told.
    onNodesChange: (changes) =>
      set({ nodes: applyNodeChanges(kept(changes), get().nodes) }),
    onEdgesChange: (changes) =>
      set({ edges: applyEdgeChanges(kept(changes), get().edges) }),
    select: (selected) => set({ selected, selectedEdge: null, selectedComment: null }),
    selectComment: (selectedComment) =>
      set({ selectedComment, selected: null, selectedEdge: null }),

    highlight: (id, kind = 'node') => {
      if (id === null) {
        if (get().related !== null) set({ related: null, relatedTo: null });
        return;
      }
      const { edges, parentOf, childrenOf } = get();
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

      // And what a box holds stays lit with the box, for the same reason read
      // the other way round: a boundary drawn around cards that have all gone
      // grey is a box reported empty while you are looking straight at what is
      // in it. A card holds nothing, so this is a walk of no steps for one.
      const held = new Set<string>();
      const withContents = (slug: string): void => {
        for (const child of childrenOf[slug] ?? []) {
          if (held.has(child)) continue;
          held.add(child);
          related.add(child);
          withContents(child);
        }
      };

      if (kind === 'node') {
        withAncestors(id);
        // Only the box under the pointer walks down. Lighting the contents of
        // every box that happens to be lit would light a card's siblings the
        // moment its own box lit with it, which is the question nobody asked.
        withContents(id);
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
      // The flows drawn between two things the box holds are as much the
      // inside of it as the cards are, and a lit card either end of a dimmed
      // line is the same mistake one step along.
      for (const edge of edges) {
        if (held.has(edge.source) && held.has(edge.target)) related.add(edge.id);
      }

      set({ related, relatedTo: id });
    },
    selectEdge: (selectedEdge) => set({ selectedEdge, selected: null, selectedComment: null }),
    setEditable: (editable) => set({ editable }),
    arm: (armed) => {
      if (get().armed !== armed) set({ armed });
    },
    /**
     * The card's own width, held here for as long as the grip is down.
     *
     * A box is worked out from what it holds, and what it holds was read from
     * the document — which a resize does not reach until it is over. So the
     * card grew straight out through the edge of the box it was in and the box
     * only caught up on release, in one jump. Written here instead, the same
     * walk that draws the card draws the box around it, on every frame of the
     * drag.
     *
     * Nothing is committed from here. This is a drag in progress; the document
     * hears about it once.
     */
    sizeNode: (slug, size) => {
      const stored = sizeOfCard(get(), slug, size.width);
      if (stored === null) return;
      const current = get().sizing[slug];
      if (current?.width === stored.width && current?.height === stored.height) return;
      set({ sizing: { ...get().sizing, [slug]: stored } });
      refresh();
    },
    toggleTask: (slug, index) => toggleNodeTask(doc, slug, index, ORIGIN_LOCAL),
    resizeNode: (slug, size) => {
      // A card is dragged by one edge and only its width is a person's to
      // choose; the height that width comes to is written beside it so that
      // anything reading the document raw sees a coherent box. Nothing in this
      // repository reads that height back — it is measured again each time.
      const stored = sizeOfCard(get(), slug, size.width);
      // Dropped whatever happens next. Left behind on a resize that is refused
      // — a box's, or one made while the plan is read-only — it would hold the
      // canvas at a size the document never agreed to.
      const { [slug]: gone, ...rest } = get().sizing;
      void gone;
      set({ sizing: rest });
      if (stored === null) {
        refresh();
        return;
      }
      commitLayout(doc, new Map(), ORIGIN_LOCAL, new Map([[slug, stored]]));
    },
    routeEdge: (id, corners, labelPosition) => {
      // No snapping here. The drag is the only thing that writes a route and it
      // has already put the moved run on the grid, on the one axis it moved;
      // rounding both axes again would pull a corner off the handle height the
      // renderer pins it to.
      if (!get().editable) return;
      commitEdgeRoute(doc, id, corners, labelPosition, ORIGIN_LOCAL);
    },
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
    const sizing = store.getState().sizing;
    const graph = buildPlanGraph(plan);
    const previous = get_nodes();

    // A node holding others is drawn as the boundary around them, which already
    // says what a containment line would. Drawing it as well produced long
    // dashed paths wandering across the canvas and reading as phantom boxes.
    const drawnAsBoundary = new Set(
      plan.nodes
        .filter((node) => isGroup(node, graph.childrenOf.get(node.slug)?.length ?? 0))
        .map((node) => node.slug),
    );

    const byslug = new Map(plan.nodes.map((node) => [node.slug, node]));
    const absolute: Record<string, Position> = {};
    const parentOf: Record<string, string> = {};
    const childrenOf: Record<string, string[]> = {};
    for (const node of plan.nodes) {
      absolute[node.slug] = node.position ?? { x: 0, y: 0 };
      const parent = graph.parentOf.get(node.slug);
      if (parent === undefined || !drawnAsBoundary.has(parent)) continue;
      parentOf[node.slug] = parent;
      (childrenOf[parent] ??= []).push(node.slug);
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

    /*
     * Every node's box, worked out from the inside out.
     *
     * A card is as tall as what it has to say and a box is exactly what it
     * holds. Neither is stored, so neither can be out of date: a card grown by
     * being typed into takes its boundary with it, and a child dragged past an
     * edge pulls that edge along rather than hanging outside it.
     *
     * `ordered` is a walk down the containment tree, so reversing it visits
     * every child before whatever holds it.
     */
    const bounds: Record<string, Box> = {};
    for (const node of [...ordered].reverse()) {
      const children = graph.childrenOf.get(node.slug) ?? [];
      if (!isGroup(node, children.length)) {
        // A width being dragged right now outranks the one on record, which is
        // the whole of how a box keeps up with a card growing inside it.
        bounds[node.slug] = sizing[node.slug] ?? cardBounds(node);
        continue;
      }

      const held: Rect[] = [];
      for (const child of children) {
        const box = bounds[child];
        const childAt = absolute[child];
        if (box !== undefined && childAt !== undefined) held.push({ ...childAt, ...box });
      }

      const box = holdingBox(held);
      if (box === null) {
        bounds[node.slug] = { ...DEFAULT_GROUP_SIZE };
        continue;
      }
      // A box is drawn where its contents are, so this is where it is for
      // everything else too — the hit test, the lines that leave it, and the
      // coordinates its children are placed against.
      absolute[node.slug] = { x: box.x, y: box.y };
      bounds[node.slug] = { width: box.width, height: box.height };
    }

    const nextNodes = ordered.map((node) => {
      const existing = previous.get(node.slug);
      const childCount = graph.childrenOf.get(node.slug)?.length ?? 0;
      const parentSlug = parentOf[node.slug];
      const parent =
        parentSlug === undefined
          ? null
          : { slug: parentSlug, position: absolute[parentSlug] ?? { x: 0, y: 0 } };

      const box = bounds[node.slug] ?? { width: 260, height: 76 };
      const at = absolute[node.slug] ?? { x: 0, y: 0 };
      const where =
        parent === null ? at : { x: at.x - parent.position.x, y: at.y - parent.position.y };
      // Drawn where it is drawn now, at the size it is drawn at now. A box
      // moves because what it holds moved, and a card inside one moves because
      // the box's own corner did — neither shows up as a change to this node.
      const drawnAt = (candidate: PlanFlowNode | undefined): boolean =>
        candidate?.style?.width === box.width &&
        candidate?.style?.height === box.height &&
        candidate?.position?.x === where.x &&
        candidate?.position?.y === where.y;

      if (
        existing !== undefined &&
        existing.data.node === node &&
        existing.data.childCount === childCount &&
        existing.parentId === parentSlug &&
        drawnAt(existing)
      ) {
        return existing;
      }
      // A node nobody edited can still need redrawing: gaining or losing a
      // child turns a card into the box around it and back, and the change
      // that did it was to an edge, so this node is not in `touched` at all.
      if (
        existing !== undefined &&
        touched !== undefined &&
        !touched.has(node.slug) &&
        existing.data.childCount === childCount &&
        existing.parentId === parentSlug &&
        drawnAt(existing)
      ) {
        return existing;
      }
      return {
        ...toFlowNode(
          node,
          childCount,
          parent,
          containmentDepth(graph, node.slug),
          box,
          absolute[node.slug] ?? { x: 0, y: 0 },
        ),
        selected: existing?.selected ?? false,
      };
    });

    store.setState({
      arrivals: noteArrivals(plan),
      nodes: nextNodes,
      edges: plan.edges
        .filter((edge) => !(edge.kind === 'contains' && drawnAsBoundary.has(edge.from)))
        .map((edge) => toFlowEdge(edge, byslug.get(edge.from))),
      comments: plan.comments,
      title: plan.title,
      description: plan.description,
      absolute,
      parentOf,
      childrenOf,
      bounds,
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
