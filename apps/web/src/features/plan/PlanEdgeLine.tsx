import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import type { PlanFlowEdge } from './types';

/**
 * Line style is the relation. A reader can tell dependency from containment
 * without a legend lookup, the same way a schematic distinguishes a signal line
 * from a boundary.
 */
const STYLE: Record<string, { dash?: string; marker: boolean }> = {
  // The system's own movement, so it is the plainest, most legible line there
  // is. A dependency is drawn faintly dashed beside it: it says what must exist
  // first, which is a different claim from what calls what.
  flows_to: { marker: true },
  depends_on: { dash: '5 3', marker: true },
  contains: { dash: '6 4', marker: false },
  // Denser than a true dot: at 1.5px on a dark ground a sparse pattern reads as
  // a line that stops rather than one that continues.
  relates_to: { dash: '2 4', marker: false },
};

function Line({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<PlanFlowEdge>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 2,
  });

  const kind = data?.edge.kind ?? 'depends_on';
  const style = STYLE[kind] ?? STYLE['depends_on']!;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: selected === true ? 'var(--accent)' : 'var(--edge)',
        strokeWidth: selected === true ? 2 : 1.5,
        ...(style.dash !== undefined && { strokeDasharray: style.dash }),
      }}
      markerEnd={style.marker ? 'url(#schematic-arrow)' : undefined}
    />
  );
}

export const PlanEdgeLine = memo(Line);

/** One marker definition shared by every dependency edge. */
export function EdgeMarkers() {
  return (
    <svg className="pointer-events-none absolute size-0">
      <defs>
        <marker
          id="schematic-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--edge)" />
        </marker>
      </defs>
    </svg>
  );
}
