import { containmentDepth, type PlanDoc, type PlanGraph, type PlanNodeStatus } from '@schematic/schema';

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

const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;
const COLUMN_GAP = 400;
const ROW_GAP = 200;

/** Obsidian's preset palette: 1 red, 2 orange, 3 yellow, 4 green, 5 cyan, 6 purple. */
const STATUS_COLOR: Record<PlanNodeStatus, string | undefined> = {
  idea: undefined,
  planned: '5',
  in_progress: '3',
  blocked: '1',
  done: '4',
  dropped: '6',
};

/**
 * Nodes keep the coordinates they have. Anything unplaced is laid out on a
 * deterministic grid — column by containment depth, row by export order — so a
 * plan that has never been opened in the editor still exports to a readable
 * canvas, and exports the same way every time.
 */
export function toCanvas(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  graph: PlanGraph,
  fileOf: ReadonlyMap<string, string>,
): Canvas {
  const rowsUsed = new Map<number, number>();
  const nodes: CanvasNode[] = [];

  for (const slug of fileOf.keys()) {
    const node = graph.nodes.get(slug);
    if (node === undefined) continue;

    let { x, y } = node.position ?? { x: 0, y: 0 };
    if (node.position === null) {
      const depth = containmentDepth(graph, slug);
      const row = rowsUsed.get(depth) ?? 0;
      rowsUsed.set(depth, row + 1);
      x = depth * COLUMN_GAP;
      y = row * ROW_GAP;
    }

    const canvasNode: CanvasNode = {
      id: slug,
      type: 'file',
      file: fileOf.get(slug) ?? `${slug}.md`,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(node.size?.width ?? NODE_WIDTH),
      height: Math.round(node.size?.height ?? NODE_HEIGHT),
    };
    const color = STATUS_COLOR[node.status];
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

  return { nodes, edges };
}
