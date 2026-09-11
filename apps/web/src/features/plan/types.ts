import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import type { PlanEdge, PlanNode } from '@schematic/schema';

export interface PlanNodeData extends Record<string, unknown> {
  node: PlanNode;
  childCount: number;
}

export type PlanFlowNode = FlowNode<PlanNodeData, 'plan'>;
export type PlanFlowEdge = FlowEdge<Record<string, unknown>> & {
  data?: {
    edge: PlanEdge;
    /**
     * True when the flow leaves a node that is blocked. Carried on the edge so
     * the line does not have to search the node list to draw itself.
     */
    stopped?: boolean;
  };
};
