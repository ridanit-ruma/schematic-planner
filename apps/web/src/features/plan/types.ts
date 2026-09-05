import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import type { PlanEdge, PlanNode } from '@schematic/schema';

export interface PlanNodeData extends Record<string, unknown> {
  node: PlanNode;
  childCount: number;
}

export type PlanFlowNode = FlowNode<PlanNodeData, 'plan'>;
export type PlanFlowEdge = FlowEdge<Record<string, unknown>> & { data?: { edge: PlanEdge } };
