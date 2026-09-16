import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import {
  CARD,
  buildPlanGraph,
  cardBounds,
  edgeNote,
  type PlanDoc,
  type Position,
} from '@schematic/schema';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type LayoutDirection = 'RIGHT' | 'DOWN';

export interface LayoutOptions {
  /** `RIGHT` reads as build order: a dependency sits left of what needs it. */
  readonly direction?: LayoutDirection;
  readonly nodeWidth?: number;
  readonly nodeHeight?: number;
  readonly spacing?: number;
  /**
   * `unpinned` leaves nodes a human has placed exactly where they are and moves
   * everything else around them. `all` re-places the whole plan.
   */
  readonly scope?: 'all' | 'unpinned';
}

export interface LayoutResult {
  /** Only the nodes this run is allowed to move. */
  readonly positions: ReadonlyMap<string, Position>;
  /**
   * Bounds ELK computed for nodes that contain others. A container has to be
   * drawn at the size that actually holds its children; drawn at the size of an
   * ordinary card it lands on top of the first one.
   */
  readonly sizes: ReadonlyMap<string, Size>;
  /**
   * Where the writing on each line goes, keyed by edge id. Placed by the same
   * run that placed the nodes, because avoiding the other lines' notes needs to
   * know where the other lines are.
   */
  readonly labels: ReadonlyMap<string, Position>;
}

/**
 * The lattice a laid-out drawing sits on.
 *
 * The canvas offers 10, 20, 40 and 80 to snap a drag to, and the layout has to
 * pick one: it runs on the server, where nobody's preference is in scope. 20 is
 * the default step and the fine division the canvas has always drawn, so a plan
 * the server tidied and a plan a person tidied land on the same lines. Choosing
 * a coarser step for yourself still works — every node the layout placed is then
 * on every other line rather than every one.
 *
 * Not offered over MCP. The surface deliberately takes structure and never
 * coordinates, and a grid step is a coordinate; an agent has nothing to decide
 * it with.
 */
const GRID = 20;

/**
 * Room along the top edge for a container's own label. Applied to every
 * container, not just the root: ELK reads padding per node, and a container
 * without it puts its first child straight over its own title.
 *
 * Every side is a multiple of GRID so that the room inside a container starts on
 * the grid too. With 16 down the sides it did not, and a container drawn snugly
 * around one card had no intersection inside it at all — the card could sit on
 * the grid or inside its group, never both.
 */
const CONTAINER_PADDING = `[top=40,left=${GRID},bottom=${GRID},right=${GRID}]`;

/**
 * What a node actually measures on the canvas.
 *
 * These have to match the card the editor draws. When they did not — 280 by 140
 * against a card 260 wide and 72 tall — layout reserved space nothing filled,
 * containers grew a large empty floor, and the graph became tall enough that
 * reading it meant zooming out until the text was gone.
 */
const CARD_WIDTH = CARD.width;
const CARD_HEIGHT = CARD.minHeight;

const DEFAULTS = {
  direction: 'RIGHT' as LayoutDirection,
  nodeWidth: CARD_WIDTH,
  nodeHeight: CARD_HEIGHT,
  spacing: 40,
  scope: 'unpinned' as const,
};

const elk = new ELK();

/**
 * ELK reads options per node, not down a tree: a nested container laid out with
 * only the root's settings falls back to defaults for everything else. Applying
 * the same set to every container is what stops the cards inside one from
 * touching, with no room for the arrow between them.
 */
function elkOptions(options: Required<Pick<LayoutOptions, 'direction' | 'spacing'>>) {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': options.direction,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.spacing.nodeNode': String(options.spacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(options.spacing * 1.8)),
    'elk.padding': CONTAINER_PADDING,
    // Without a fixed strategy ELK may order equal-rank nodes differently
    // between runs, which would make "arrange" produce a different diagram
    // each time it is pressed.
    'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    // Beside the line rather than on it, and given room of its own in the gap
    // between layers instead of being dropped at the midpoint of the path.
    'elk.edgeLabels.inline': 'false',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.spacing.edgeLabel': '6',
  };
}

/**
 * What the note on a line will measure once it is drawn.
 *
 * Estimated rather than measured: layout runs on the server too, where there is
 * no browser to ask. The width is deliberately generous — a reserved gap that
 * turns out too wide only spreads the drawing, while one too narrow puts the
 * writing back on top of its neighbours, which is the fault being fixed.
 */
const NOTE_CHAR_WIDTH = 5.6;
const NOTE_MAX_WIDTH = 208;
const NOTE_HEIGHT = 18;

function noteSize(text: string): { width: number; height: number } {
  return {
    width: Math.min(NOTE_MAX_WIDTH, Math.round(text.length * NOTE_CHAR_WIDTH) + 10),
    height: NOTE_HEIGHT,
  };
}

/**
 * Containment becomes ELK's node hierarchy, dependency becomes its edges. ELK
 * reports child coordinates relative to their parent, so they are accumulated
 * back into the absolute space the plan stores.
 */
export async function layoutPlan(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const settings = { ...DEFAULTS, ...options };
  const graph = buildPlanGraph(doc);

  const rootOptions = elkOptions(settings);

  const buildChildren = (slugs: readonly string[]): ElkNode[] =>
    slugs.map((slug) => {
      const node = graph.nodes.get(slug);
      const children = graph.childrenOf.get(slug) ?? [];
      const elkNode: ElkNode = { id: slug };
      if (children.length > 0) {
        elkNode.children = buildChildren(children);
        elkNode.layoutOptions = elkOptions(settings);
      } else {
        // The box the browser will actually draw, asked of the same function
        // the browser asks. A card's height is not stored and a stored height is
        // not read: what the card has to say decides it, at whatever width it
        // has been given.
        const box = node === undefined ? null : cardBounds(node);
        elkNode.width = box?.width ?? settings.nodeWidth;
        elkNode.height = box?.height ?? settings.nodeHeight;
      }
      return elkNode;
    });

  const edges = doc.edges
    .filter((edge) => edge.kind === 'flows_to' || edge.kind === 'depends_on')
    .filter((edge) => graph.nodes.has(edge.from) && graph.nodes.has(edge.to))
    // A flow is laid out the way it moves. A dependency is laid out from what is
    // needed towards what needs it, which reads the same way across the page.
    .map((edge) => {
      const ends =
        edge.kind === 'flows_to'
          ? { sources: [edge.from], targets: [edge.to] }
          : { sources: [edge.to], targets: [edge.from] };
      const note = edgeNote(edge);
      return {
        id: edge.id,
        ...ends,
        ...(note !== '' && { labels: [{ text: note, ...noteSize(note) }] }),
      };
    });

  const laid = await elk.layout({
    id: 'root',
    layoutOptions: rootOptions,
    children: buildChildren(graph.roots),
    edges,
  });

  const computed = new Map<string, Position>();
  const sizes = new Map<string, Size>();
  // ELK reports an edge's label against whatever node contains that edge, so
  // the same accumulation the nodes need is kept for the containers too.
  const origins = new Map<string, Position>([['root', { x: 0, y: 0 }]]);
  // Snapped against the container a node sits in, not against the world, and the
  // offset handed down is already snapped. Both matter: ELK reports a child's
  // position relative to its parent, and rounding the two independently could
  // move a child across the border of the container that holds it. Snapping the
  // offset and the step into it separately keeps every node on the world grid —
  // a sum of multiples is a multiple — while no child ever leaves its padding.
  const collect = (nodes: readonly ElkNode[] | undefined, offset: Position): void => {
    for (const node of nodes ?? []) {
      const x = offset.x + snap(node.x ?? 0);
      const y = offset.y + snap(node.y ?? 0);
      computed.set(node.id, { x, y });
      origins.set(node.id, { x, y });
      if ((node.children?.length ?? 0) > 0 && node.width !== undefined && node.height !== undefined) {
        // Up, never down: a container may end wider than its contents need, but
        // never narrower than what ELK measured to fit inside it.
        sizes.set(node.id, {
          width: Math.ceil(node.width / GRID) * GRID,
          height: Math.ceil(node.height / GRID) * GRID,
        });
      }
      collect(node.children, { x, y });
    }
  };
  collect(laid.children, { x: 0, y: 0 });

  /*
   * ELK's label positions are deliberately thrown away.
   *
   * It places them on the edges it routed, through its own channels and ports —
   * and the canvas does not draw those edges. It has its own orthogonal router,
   * so a point ELK recorded was a point on a line in a picture nobody sees, and
   * every note on a freshly arranged plan floated clear of the flow it belonged
   * to. The canvas now works the position out from the route it actually draws,
   * every render, which is a thing that cannot go stale because it is not kept.
   *
   * The labels are still declared on the way in: they are what makes ELK leave
   * room in a corridor for the writing that will go there, which is the part of
   * its answer worth having.
   */
  const labels = new Map<string, Position>();

  /*
   * A box's size is never a person's to keep.
   *
   * This used to arbitrate between a size somebody had dragged a box to and the
   * size its contents needed, taking the larger on each axis. There is nothing
   * left to arbitrate: a box is drawn around what it holds, everywhere that
   * draws one, so what ELK measured is simply the answer and a stored size is
   * only the record of it.
   */
  if (settings.scope === 'all') return { positions: round(computed), sizes, labels: round(labels) };

  const pinned = doc.nodes.filter((node) => node.pinned && node.position !== null);
  const shift = translationKeepingPinned(pinned, computed);

  const positions = new Map<string, Position>();
  for (const node of doc.nodes) {
    if (node.pinned && node.position !== null) continue;
    const point = computed.get(node.slug);
    if (point === undefined) continue;
    positions.set(node.slug, { x: point.x + shift.x, y: point.y + shift.y });
  }

  // The notes travel with the drawing they belong to.
  const shifted = new Map<string, Position>();
  for (const [id, point] of labels) shifted.set(id, { x: point.x + shift.x, y: point.y + shift.y });

  return { positions: round(positions), sizes, labels: round(shifted) };
}

/**
 * Pinned nodes are not moved, so the fresh layout is translated to sit where the
 * pinned ones already are. Aligning the two centroids keeps the new nodes near
 * the work a human has already arranged instead of landing at the origin.
 */
function translationKeepingPinned(
  pinned: readonly { slug: string; position: Position | null }[],
  computed: ReadonlyMap<string, Position>,
): Position {
  const pairs = pinned
    .map((node) => ({ actual: node.position, fresh: computed.get(node.slug) }))
    .filter((pair): pair is { actual: Position; fresh: Position } =>
      pair.actual !== null && pair.fresh !== undefined,
    );
  if (pairs.length === 0) return { x: 0, y: 0 };

  const sum = pairs.reduce(
    (acc, pair) => ({
      x: acc.x + (pair.actual.x - pair.fresh.x),
      y: acc.y + (pair.actual.y - pair.fresh.y),
    }),
    { x: 0, y: 0 },
  );
  // Snapped, because everything this is added to is on the grid and a fractional
  // translation would take all of it off again. Half a step is nothing against
  // the purpose, which is to land the new work near the old.
  return { x: snap(sum.x / pairs.length), y: snap(sum.y / pairs.length) };
}

/** The nearest line of the lattice the layout draws on. */
function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function round(positions: ReadonlyMap<string, Position>): Map<string, Position> {
  const rounded = new Map<string, Position>();
  for (const [slug, point] of positions) {
    rounded.set(slug, { x: Math.round(point.x), y: Math.round(point.y) });
  }
  return rounded;
}
