import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { buildPlanGraph, type PlanDoc, type Position } from '@schematic/schema';

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
}

/**
 * Room along the top edge for a container's own label. Applied to every
 * container, not just the root: ELK reads padding per node, and a container
 * without it puts its first child straight over its own title.
 */
const CONTAINER_PADDING = '[top=40,left=16,bottom=16,right=16]';

/**
 * What a node actually measures on the canvas.
 *
 * These have to match the card the editor draws. When they did not — 280 by 140
 * against a card 260 wide and 72 tall — layout reserved space nothing filled,
 * containers grew a large empty floor, and the graph became tall enough that
 * reading it meant zooming out until the text was gone.
 */
const CARD_WIDTH = 260;
const CARD_HEIGHT = 76;
/** A card carrying body text is two lines taller. */
const CARD_HEIGHT_WITH_BODY = 104;

const DEFAULTS = {
  direction: 'RIGHT' as LayoutDirection,
  nodeWidth: CARD_WIDTH,
  nodeHeight: CARD_HEIGHT,
  spacing: 36,
  scope: 'unpinned' as const,
};

const elk = new ELK();

function elkOptions(options: Required<Pick<LayoutOptions, 'direction' | 'spacing'>>) {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': options.direction,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.spacing.nodeNode': String(options.spacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(options.spacing * 1.6)),
    'elk.padding': CONTAINER_PADDING,
    // Without a fixed strategy ELK may order equal-rank nodes differently
    // between runs, which would make "arrange" produce a different diagram
    // each time it is pressed.
    'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
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

  const buildChildren = (slugs: readonly string[]): ElkNode[] =>
    slugs.map((slug) => {
      const node = graph.nodes.get(slug);
      const children = graph.childrenOf.get(slug) ?? [];
      const elkNode: ElkNode = { id: slug };
      if (children.length > 0) {
        elkNode.children = buildChildren(children);
        elkNode.layoutOptions = { 'elk.padding': CONTAINER_PADDING };
      } else {
        elkNode.width = node?.size?.width ?? settings.nodeWidth;
        elkNode.height =
          node?.size?.height ??
          (node !== undefined && node.body.trim() !== ''
            ? CARD_HEIGHT_WITH_BODY
            : settings.nodeHeight);
      }
      return elkNode;
    });

  const edges = doc.edges
    .filter((edge) => edge.kind === 'depends_on')
    .filter((edge) => graph.nodes.has(edge.from) && graph.nodes.has(edge.to))
    // Source is the dependency so the layered direction reads as build order.
    .map((edge) => ({ id: edge.id, sources: [edge.to], targets: [edge.from] }));

  const laid = await elk.layout({
    id: 'root',
    layoutOptions: elkOptions(settings),
    children: buildChildren(graph.roots),
    edges,
  });

  const computed = new Map<string, Position>();
  const sizes = new Map<string, Size>();
  const collect = (nodes: readonly ElkNode[] | undefined, offset: Position): void => {
    for (const node of nodes ?? []) {
      const x = offset.x + (node.x ?? 0);
      const y = offset.y + (node.y ?? 0);
      computed.set(node.id, { x, y });
      if ((node.children?.length ?? 0) > 0 && node.width !== undefined && node.height !== undefined) {
        sizes.set(node.id, { width: Math.round(node.width), height: Math.round(node.height) });
      }
      collect(node.children, { x, y });
    }
  };
  collect(laid.children, { x: 0, y: 0 });

  if (settings.scope === 'all') return { positions: round(computed), sizes };

  const pinned = doc.nodes.filter((node) => node.pinned && node.position !== null);
  const shift = translationKeepingPinned(pinned, computed);

  const positions = new Map<string, Position>();
  for (const node of doc.nodes) {
    if (node.pinned && node.position !== null) continue;
    const point = computed.get(node.slug);
    if (point === undefined) continue;
    positions.set(node.slug, { x: point.x + shift.x, y: point.y + shift.y });
  }
  return { positions: round(positions), sizes };
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
  return { x: sum.x / pairs.length, y: sum.y / pairs.length };
}

function round(positions: ReadonlyMap<string, Position>): Map<string, Position> {
  const rounded = new Map<string, Position>();
  for (const [slug, point] of positions) {
    rounded.set(slug, { x: Math.round(point.x), y: Math.round(point.y) });
  }
  return rounded;
}
