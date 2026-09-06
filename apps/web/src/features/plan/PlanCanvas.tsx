import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { normalizeEdge, planEdgeInputSchema, type PlanOp } from '@schematic/schema';
import { ORIGIN_LOCAL, commitNodePosition } from '@schematic/ydoc';
import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';

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

  const handleDragStop = useCallback(
    (_: unknown, node: PlanFlowNode) => {
      connection.publishDrag(null);
      // The document is written once, at the end. Everything before this went
      // over awareness and left no history.
      commitNodePosition(doc, node.id, node.position, ORIGIN_LOCAL);
    },
    [connection, doc],
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
