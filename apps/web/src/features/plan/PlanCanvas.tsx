import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { normalizeEdge, planEdgeInputSchema, type PlanOp, type Position } from '@schematic/schema';
import { ORIGIN_LOCAL, commitLayout, commitNodePosition } from '@schematic/ydoc';
import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';

import { resolveDrop, type DropTarget } from './group-drop';
import { EdgeMarkers, PlanEdgeLine } from './PlanEdgeLine';
import { PlanNodeCard } from './PlanNodeCard';
import type { PlanConnection } from './use-plan-document';
import type { PlanFlowNode } from './types';

/*
 * Declared once at module scope. Rebuilding these objects inside the component
 * makes React Flow unmount and remount every node on every render, which is the
 * single most expensive mistake available here.
 */
const nodeTypes: NodeTypes = { plan: PlanNodeCard };
const edgeTypes: EdgeTypes = { plan: PlanEdgeLine };

export function PlanCanvas({
  connection,
  readOnly,
  onApplyOps,
}: {
  connection: PlanConnection;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
}) {
  const { store, doc } = connection.bound;
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const remoteDrag = useStore(store, (state) => state.remoteDrag);
  const onNodesChange = useStore(store, (state) => state.onNodesChange);
  const onEdgesChange = useStore(store, (state) => state.onEdgesChange);
  const select = useStore(store, (state) => state.select);
  const absolute = useStore(store, (state) => state.absolute);
  const parentOf = useStore(store, (state) => state.parentOf);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const connectKind = useStore(store, (state) => state.connectKind);

  /** Someone else's in-flight drag overrides the stored position for that node. */
  const rendered = useMemo(
    () =>
      Object.keys(remoteDrag).length === 0
        ? nodes
        : nodes.map((node) => {
            const ghost = remoteDrag[node.id];
            return ghost === undefined ? node : { ...node, position: ghost };
          }),
    [nodes, remoteDrag],
  );

  const handleDrag = useCallback(
    (_: unknown, node: PlanFlowNode) => {
      connection.publishDrag({ [node.id]: node.position });
    },
    [connection],
  );

  /**
   * Where a drag ends decides two things at once: where the node sits, and
   * which group it belongs to. Both are written here, once, at the end —
   * everything before this went over awareness and left no history.
   */
  const handleDragStop = useCallback(
    (_: unknown, node: PlanFlowNode) => {
      connection.publishDrag(null);

      const previous = absolute[node.id] ?? { x: 0, y: 0 };
      const parent = node.parentId === undefined ? null : absolute[node.parentId];
      const dropped = {
        x: (parent?.x ?? 0) + node.position.x,
        y: (parent?.y ?? 0) + node.position.y,
        width: node.measured?.width ?? node.data.node.size?.width ?? 260,
        height: node.measured?.height ?? node.data.node.size?.height ?? 76,
      };

      // A group cannot be dropped into itself or into anything it holds.
      const forbidden = new Set<string>([node.id]);
      for (const [slug, holder] of Object.entries(parentOf)) {
        let cursor: string | undefined = holder;
        const seen = new Set<string>();
        while (cursor !== undefined && !seen.has(cursor)) {
          if (cursor === node.id) {
            forbidden.add(slug);
            break;
          }
          seen.add(cursor);
          cursor = parentOf[cursor];
        }
      }

      const targets: DropTarget[] = nodes
        .filter((candidate) => candidate.data.childCount > 0 && candidate.data.node.size !== null)
        .map((candidate) => ({
          slug: candidate.id,
          rect: {
            ...(absolute[candidate.id] ?? { x: 0, y: 0 }),
            width: candidate.data.node.size?.width ?? 0,
            height: candidate.data.node.size?.height ?? 0,
          },
          depth: Math.round(((candidate.zIndex ?? 0) as number) / 10),
        }));

      const drop = resolveDrop(dropped, targets, forbidden);
      const was = parentOf[node.id] ?? null;

      if (drop.parent !== was) {
        const ops: PlanOp[] = [];
        if (was !== null) ops.push({ op: 'delete_edge', kind: 'contains', from: was, to: node.id });
        if (drop.parent !== null) {
          ops.push({
            op: 'upsert_edge',
            edge: normalizeEdge(
              planEdgeInputSchema.parse({ kind: 'contains', from: drop.parent, to: node.id }),
            ),
          });
        }
        onApplyOps(ops);
      }

      commitNodePosition(doc, node.id, drop.position, ORIGIN_LOCAL);

      // Dragging a group moves everything inside it, so their stored absolute
      // coordinates move with it. Without this the picture and the plan would
      // disagree the moment anybody else opened it.
      const shift = { x: drop.position.x - previous.x, y: drop.position.y - previous.y };
      const moved = new Map<string, Position>();
      if (shift.x !== 0 || shift.y !== 0) {
        for (const slug of descendantsOf(node.id, parentOf)) {
          const at = absolute[slug];
          if (at !== undefined) moved.set(slug, { x: at.x + shift.x, y: at.y + shift.y });
        }
      }
      const grown =
        drop.grow === null || drop.parent === null
          ? undefined
          : new Map([[drop.parent, drop.grow]]);
      if (moved.size > 0 || grown !== undefined) {
        commitLayout(doc, moved, ORIGIN_LOCAL, grown);
      }
    },
    [absolute, connection, doc, nodes, onApplyOps, parentOf],
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      if (params.source === null || params.target === null) return;

      // Direction depends on what the line means. Dragging left to right draws
      // "this needs that", which is stored pointing the other way — the
      // direction the export orders files in. Containment and association read
      // in the direction they were drawn.
      const [from, to] =
        connectKind === 'depends_on'
          ? [params.target, params.source]
          : [params.source, params.target];

      onApplyOps([
        { op: 'upsert_edge', edge: normalizeEdge(planEdgeInputSchema.parse({ kind: connectKind, from, to })) },
      ]);
    },
    [connectKind, onApplyOps],
  );

  return (
    <div className="relative h-full w-full">
      <EdgeMarkers />
      <ReactFlow
        nodes={rendered}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={readOnly ? undefined : handleDrag}
        onNodeDragStop={readOnly ? undefined : handleDragStop}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={(_, node) => select(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => select(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        // Culls off-screen nodes. A plan of a few hundred nodes is ordinary.
        onlyRenderVisibleElements
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: false }}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      >
        {/* A drafting grid: a fine division inside a coarse one. */}
        <Background
          id="fine"
          variant={BackgroundVariant.Lines}
          gap={20}
          lineWidth={1}
          color="var(--grid-fine)"
        />
        <Background
          id="coarse"
          variant={BackgroundVariant.Lines}
          gap={100}
          lineWidth={1}
          color="var(--grid-coarse)"
        />
        <Controls
          showInteractive={false}
          className="!border !border-rule !bg-surface !shadow-none [&_button]:!border-rule [&_button]:!bg-surface [&_button]:!fill-ink-muted hover:[&_button]:!bg-surface-2"
        />
      </ReactFlow>
    </div>
  );
}

/** Everything held by a node, at any depth. */
function descendantsOf(slug: string, parentOf: Record<string, string>): string[] {
  const held: string[] = [];
  const stack = [slug];
  const seen = new Set<string>([slug]);
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const [child, parent] of Object.entries(parentOf)) {
      if (parent !== current || seen.has(child)) continue;
      seen.add(child);
      held.push(child);
      stack.push(child);
    }
  }
  return held;
}
