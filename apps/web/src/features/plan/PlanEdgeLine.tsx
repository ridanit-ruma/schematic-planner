import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import { edgeNote } from '@schematic/schema';
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

/**
 * When the note on a line is drawn, and when it is not.
 *
 * Below this zoom it is smaller than the line is thick. And a line too short to
 * hold it puts it over its own endpoints and over its neighbours' notes — in a
 * dense part of a graph that is where they all pile up, so a short line keeps
 * quiet and says what it carries in the inspector instead.
 */
const NOTE_ZOOM = 0.55;
const NOTE_ROOM = 130;

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
  const zoom = useStore((state) => state.transform[2]);
  const room = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const legible = zoom >= NOTE_ZOOM && room * zoom >= NOTE_ROOM;
  const [path, labelX, labelY] = getSmoothStepPath({
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
  const edge = data?.edge;

  // What sets a flow off and what it carries are the flow. Drawn on the line
  // rather than hidden in the inspector: reading the picture is the point, and
  // an arrow with nothing written on it says only that two things touch.
  const note = edge === undefined ? '' : edgeNote(edge);

  // Where layout put it, which is the only place that knows what else is near.
  // Falling back to the midpoint when nothing has laid this plan out yet — and
  // the midpoint is exactly where parallel lines pile their notes up, so a line
  // too short to hold one keeps quiet until it has somewhere of its own.
  const placed = edge?.labelPosition ?? null;
  const at = placed ?? { x: labelX, y: labelY };
  const show = note !== '' && (placed !== null ? zoom >= NOTE_ZOOM : legible);

  return (
    <>
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
      {!show ? null : (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute max-w-52 truncate rounded-sm border border-rule bg-surface-2 px-1.5 py-px text-2xs text-ink-muted"
            style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)` }}
          >
            {note}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
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
