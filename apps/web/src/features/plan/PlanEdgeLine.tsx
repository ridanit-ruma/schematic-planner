import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import { edgeNote } from '@schematic/schema';
import { memo } from 'react';

import { cn } from '@/lib/utils';

import { usePlanStore } from './store-context';
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
 * Once layout has given a note a place of its own it is always drawn: a card
 * looks the same at every zoom and so does the writing on a line, and hiding it
 * when the view pulled back meant a plan large enough to need pulling back was
 * a plan that opened as unlabelled boxes.
 *
 * A note with nowhere of its own is the exception. It falls back to the
 * midpoint, which is exactly where parallel lines pile theirs up, so a line too
 * short to hold one keeps quiet and says what it carries in the inspector.
 */
const NOTE_ZOOM = 0.55;
const NOTE_ROOM = 130;

/**
 * The note sits above the line rather than on it.
 *
 * Centred on the path, an opaque chip cuts the wire in two and the reader has
 * to reassemble it; a drawing annotates a wire beside it, not across it. Half
 * the chip's height plus a hair is enough to clear it.
 */
const NOTE_LIFT = 13;

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
  const arrivedAt = usePlanStore((state) => state.arrivals.get(id));
  const dimmed = usePlanStore((state) => state.related !== null && !state.related.has(id));
  const lit = usePlanStore((state) => state.related !== null && state.related.has(id));
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
  const show = note !== '' && (placed !== null || legible);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={cn(dimmed && 'plan-dim')}
        style={{
          stroke: selected === true || lit ? 'var(--accent)' : 'var(--edge)',
          strokeWidth: selected === true ? 2 : lit ? 2 : 1.5,
          ...(style.dash !== undefined && { strokeDasharray: style.dash }),
        }}
        markerEnd={style.marker ? 'url(#schematic-arrow)' : undefined}
      />
      {/* Drawn over the line for as long as it takes to appear, then gone. The
          line itself keeps its own colour and dash pattern underneath. */}
      {arrivedAt === undefined ? null : (
        <path
          d={path}
          pathLength={1}
          className="plan-line-arrive"
          style={{ animationDelay: `${arrivedAt}ms` }}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
        />
      )}
      {!show ? null : (
        <EdgeLabelRenderer>
          <div
            className={
              cn(
                'pointer-events-none absolute truncate rounded-sm border border-rule-strong',
                dimmed && 'plan-dim',
                // Pointing at a line is asking what it carries, so it stops
                // being an excerpt.
                lit ? 'max-w-none border-accent text-ink' : 'max-w-52',
              ) +
              ' ' +
              // Level 4 rather than 3, and with a ground-coloured shadow: the
              // chip has to read as a plate laid over the drawing even where a
              // line runs directly behind it.
              'bg-surface-4 px-1.5 py-px text-2xs text-ink shadow-[0_0_0_2px_var(--ground)]'
            }
            style={{
              transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y - NOTE_LIFT}px)`,
            }}
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
