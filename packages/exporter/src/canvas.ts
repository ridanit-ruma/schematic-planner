import {
  DEFAULT_VOCABULARY,
  cardBounds,
  containmentDepth,
  groupSize,
  holdingBox,
  isGroup,
  type PlanDoc,
  type PlanGraph,
  statusOf,
  type PaletteColor,
  type Rect,
  type Vocabulary,
} from '@schematic/schema';

/** https://jsoncanvas.org — the format Obsidian Canvas reads. */
export interface CanvasNode {
  id: string;
  type: 'file' | 'text' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  file?: string;
  text?: string;
  label?: string;
  color?: string;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toNode: string;
  toSide: 'top' | 'right' | 'bottom' | 'left';
  toEnd?: 'none' | 'arrow';
  label?: string;
  color?: string;
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const COLUMN_GAP = 400;
const ROW_GAP = 200;
const NOTE_WIDTH = 240;
const NOTE_HEIGHT = 120;

/**
 * A status's colour as Obsidian writes it: one of its presets (1 red, 2 orange,
 * 3 yellow, 4 green, 5 cyan, 6 purple) where one is close, so the file follows
 * the reader's theme, and a hex value where none is.
 *
 * Grey is no colour at all, and the two defaults that were mapped before the
 * palette existed — indigo to cyan, dim to purple — keep that mapping, so a
 * project that has not changed its statuses exports exactly as it did.
 */
export const CANVAS_COLOR: Record<PaletteColor, string | undefined> = {
  gray: undefined,
  dim: '6',
  red: '1',
  orange: '2',
  amber: '3',
  green: '4',
  teal: '5',
  blue: '#3b82f6',
  indigo: '5',
  purple: '6',
};

/**
 * Nodes keep the coordinates they have. Anything unplaced is laid out on a
 * deterministic grid — column by containment depth, row by export order — so a
 * plan that has never been opened in the editor still exports to a readable
 * canvas, and exports the same way every time.
 */
export function toCanvas(
  doc: Pick<PlanDoc, 'nodes' | 'edges'> & Partial<Pick<PlanDoc, 'comments'>>,
  graph: PlanGraph,
  fileOf: ReadonlyMap<string, string>,
  vocabulary: Vocabulary = DEFAULT_VOCABULARY,
): Canvas {
  const rowsUsed = new Map<number, number>();
  const nodes: CanvasNode[] = [];

  // Where each node sits, worked out in one pass so that the grid a plan with
  // no coordinates falls back to is the same every time it is exported.
  const placed = new Map<string, { x: number; y: number }>();
  for (const slug of fileOf.keys()) {
    const node = graph.nodes.get(slug);
    if (node === undefined) continue;
    if (node.position !== null) {
      placed.set(slug, { x: node.position.x, y: node.position.y });
      continue;
    }
    const depth = containmentDepth(graph, slug);
    const row = rowsUsed.get(depth) ?? 0;
    rowsUsed.set(depth, row + 1);
    placed.set(slug, { x: depth * COLUMN_GAP, y: row * ROW_GAP });
  }

  /*
   * The box a node occupies.
   *
   * A card's is its body measured at its width. A box's is whatever it holds —
   * the same rule the canvas draws by, so a plan exported to JSON Canvas and a
   * plan on screen are the same picture. A stored size is not consulted for
   * either; it goes stale the moment a body is edited or a child is moved.
   */
  const measured = new Map<string, Rect>();
  const walking = new Set<string>();
  const rectOf = (slug: string): Rect | null => {
    const known = measured.get(slug);
    if (known !== undefined) return known;
    const node = graph.nodes.get(slug);
    const at = placed.get(slug);
    if (node === undefined || at === undefined) return null;
    // A containment cycle would otherwise never come back. It is drawn at its
    // own place and size, which is what it was before anything nested.
    if (walking.has(slug)) return { ...at, ...groupSize(node) };
    walking.add(slug);

    const children = graph.childrenOf.get(slug) ?? [];
    const rect = !isGroup(node, children.length)
      ? { ...at, ...cardBounds(node) }
      : (holdingBox(children.map(rectOf).filter((held) => held !== null)) ?? {
          ...at,
          ...groupSize(node),
        });

    walking.delete(slug);
    measured.set(slug, rect);
    return rect;
  };

  for (const slug of fileOf.keys()) {
    const node = graph.nodes.get(slug);
    if (node === undefined) continue;

    const rect = rectOf(slug);
    if (rect === null) continue;

    // A node holding others is the box around them, which is what JSON Canvas
    // calls a group. Exported as an ordinary card instead -- which is what used
    // to happen -- the nesting the plan is built on is simply not in the
    // picture, and the drawing says something different from the document. The
    // container's own note is still in the tree, at the README of the folder
    // this frame corresponds to.
    const holds = isGroup(node, graph.childrenOf.get(slug)?.length ?? 0);

    const canvasNode: CanvasNode = holds
      ? {
          id: slug,
          type: 'group',
          label: node.title,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      : {
          id: slug,
          type: 'file',
          file: fileOf.get(slug) ?? `${slug}.md`,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
    // A status the project does not know is drawn uncoloured, as grey is.
    const status = statusOf(vocabulary, node.status);
    const color = status === undefined ? undefined : CANVAS_COLOR[status.color];
    if (color !== undefined) canvasNode.color = color;
    nodes.push(canvasNode);
  }

  const edges: CanvasEdge[] = [];
  for (const edge of doc.edges) {
    if (!graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) continue;

    if (edge.kind === 'contains') {
      edges.push({
        id: edge.id,
        fromNode: edge.from,
        fromSide: 'bottom',
        toNode: edge.to,
        toSide: 'top',
        ...(edge.label !== null && { label: edge.label }),
      });
    } else if (edge.kind === 'flows_to') {
      // The way it moves, labelled with what sets it off or what it carries.
      const note = edge.label ?? edge.via ?? edge.carries;
      edges.push({
        id: edge.id,
        fromNode: edge.from,
        fromSide: 'right',
        toNode: edge.to,
        toSide: 'left',
        ...(note !== null && { label: note }),
      });
    } else if (edge.kind === 'depends_on') {
      // Drawn dependency-first so the arrows read in build order.
      edges.push({
        id: edge.id,
        fromNode: edge.to,
        fromSide: 'right',
        toNode: edge.from,
        toSide: 'left',
        ...(edge.label !== null && { label: edge.label }),
      });
    } else {
      edges.push({
        id: edge.id,
        fromNode: edge.from,
        fromSide: 'right',
        toNode: edge.to,
        toSide: 'left',
        toEnd: 'none',
        ...(edge.label !== null && { label: edge.label }),
      });
    }
  }

  for (const comment of doc.comments ?? []) {
    if (comment.resolved || comment.position === null) continue;
    const who = comment.author === '' ? 'Someone' : comment.author;
    nodes.push({
      id: `note-${comment.id}`,
      type: 'text',
      text: `**${who}**\n\n${comment.body}`,
      x: Math.round(comment.position.x),
      y: Math.round(comment.position.y),
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      // 6 is purple in Obsidian's preset palette, which is the colour this
      // product gives to a person or an agent speaking.
      color: '6',
    });
    if (comment.anchor !== null && graph.nodes.has(comment.anchor)) {
      edges.push({
        id: `note-${comment.id}`,
        fromNode: `note-${comment.id}`,
        fromSide: 'left',
        toNode: comment.anchor,
        toSide: 'right',
        toEnd: 'none',
      });
    }
  }

  return { nodes, edges };
}
