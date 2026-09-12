import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { WAYPOINT_MAX, edgeNote, type Position } from '@schematic/schema';
import { memo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { bentPath, insertionPoints, type Side } from './edge-path';
import { snapTo } from './snap';
import { usePlanStore } from './store-context';
import type { PlanFlowEdge } from './types';
import { readGrid } from './use-grid';

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
  const { screenToFlowPosition } = useReactFlow();
  // The shape while it is being dragged. The document hears once, at the end —
  // the same bargain as a node's position and a note's.
  const [held, setHeld] = useState<Position[] | null>(null);
  const grab = useRef<{ pointer: Position; from: Position; index: number } | null>(null);

  const edgeData = data?.edge;
  const bends: readonly Position[] = held ?? edgeData?.waypoints ?? [];

  // React Flow's router until somebody bends the line: it knows about the other
  // lines and the cards in the way, and a plan nobody has touched should keep
  // every bit of that. Once there is a bend, the line has to go through it, and
  // that is a different question with a different answer.
  const straight = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 2,
  });
  const ends = {
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    sourceSide: sourcePosition as Side,
    targetSide: targetPosition as Side,
  };
  const bent =
    bends.length === 0
      ? null
      : bentPath(ends.source, ends.sourceSide, ends.target, ends.targetSide, bends);
  const path = bent?.path ?? straight[0];
  const labelX = bent?.label.x ?? straight[1];
  const labelY = bent?.label.y ?? straight[2];

  const selectEdge = usePlanStore((state) => state.selectEdge);
  const editable = usePlanStore((state) => state.editable);
  const bendEdge = usePlanStore((state) => state.bendEdge);
  // This plan's own selection, not React Flow's. Clicking the writing on a line
  // opens the inspector for it through the store, and React Flow never hears
  // about that, so its own selected flag is false for the line being worked on.
  const chosen = usePlanStore((state) => state.selectedEdge === id);
  const highlight = usePlanStore((state) => state.highlight);

  const kind = data?.edge.kind ?? 'depends_on';
  const style = STYLE[kind] ?? STYLE['depends_on']!;
  const edge = data?.edge;

  // What sets a flow off and what it carries are the flow. Drawn on the line
  // rather than hidden in the inspector: reading the picture is the point, and
  // an arrow with nothing written on it says only that two things touch.
  const note = edge === undefined ? '' : edgeNote(edge);

  // Where layout put it, which is the only place that knows what else is near,
  // and the middle of the line when it has no such place.
  //
  // The stored point is absolute — true for where the line was when the plan
  // was laid out — so dragging a node withdraws it for every line that node
  // touches, and those notes fall back to this midpoint and follow from then
  // on. Guessing at staleness here instead was worse: moving a node away grows
  // the box its two ends make until it swallows the stale point, so the note
  // that had most obviously come adrift was the one that looked fine.
  //
  // The midpoint is exactly where parallel lines pile their notes up, so a line
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
          // Accent still wins: "you are here" outranks what the line reports.
          stroke:
            selected === true || lit
              ? 'var(--accent)'
              : data?.stopped === true
                ? 'var(--status-blocked)'
                : 'var(--edge)',
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
      {/*
        Handles only on the line that is selected. Every line having them would
        put a row of dots across a busy plan and make the drawing about its own
        controls; the line being worked on is the only one where they are worth
        the ink.
      */}
      {!(chosen || selected === true) || !editable ? null : (
        <EdgeLabelRenderer>
          {bends.map((bend, index) => (
            <div
              key={`bend-${index}`}
              role="button"
              tabIndex={0}
              aria-label={`Bend ${index + 1} of ${bends.length}. Drag to move, or press Delete to straighten.`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                // Otherwise this is also a canvas pan and a click on the pane.
                event.stopPropagation();
                grab.current = {
                  pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                  from: bend,
                  index,
                };
                setHeld([...bends]);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = grab.current;
                if (start === null) return;
                const now = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const moved = {
                  x: start.from.x + (now.x - start.pointer.x),
                  y: start.from.y + (now.y - start.pointer.y),
                };
                setHeld(
                  bends.map((point, at) => (at === start.index ? preview(moved) : point)),
                );
              }}
              onPointerUp={() => {
                const shape = held;
                grab.current = null;
                setHeld(null);
                if (shape !== null) bendEdge(id, shape);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Delete' && event.key !== 'Backspace') return;
                event.preventDefault();
                bendEdge(
                  id,
                  bends.filter((_, at) => at !== index),
                );
              }}
              className={
                'pointer-events-auto absolute size-2.5 cursor-grab rounded-full ' +
                'border border-accent bg-accent shadow-[0_0_0_2px_var(--ground)]'
              }
              style={{ transform: `translate(-50%, -50%) translate(${bend.x}px, ${bend.y}px)` }}
            />
          ))}

          {/*
            Where a new bend would go: the middle of each straight run. Hollow,
            because nothing is there yet until it is dragged.
          */}
          {bends.length >= WAYPOINT_MAX
            ? null
            : insertionPoints(
                ends.source,
                ends.sourceSide,
                ends.target,
                ends.targetSide,
                bends,
              ).map((spot) => (
                <div
                  key={`add-${spot.index}`}
                  role="button"
                  tabIndex={-1}
                  aria-label="Drag to bend this line here"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    const next = [...bends];
                    next.splice(spot.index, 0, spot.at);
                    grab.current = {
                      pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                      from: spot.at,
                      index: spot.index,
                    };
                    setHeld(next);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = grab.current;
                    if (start === null || held === null) return;
                    const now = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                    const moved = {
                      x: start.from.x + (now.x - start.pointer.x),
                      y: start.from.y + (now.y - start.pointer.y),
                    };
                    setHeld(
                      held.map((point, at) => (at === start.index ? preview(moved) : point)),
                    );
                  }}
                  onPointerUp={() => {
                    const shape = held;
                    grab.current = null;
                    setHeld(null);
                    if (shape !== null) bendEdge(id, shape);
                  }}
                  className={
                    'pointer-events-auto absolute size-2 cursor-grab rounded-full ' +
                    'border border-accent bg-ground opacity-60 hover:opacity-100'
                  }
                  style={{
                    transform: `translate(-50%, -50%) translate(${spot.at.x}px, ${spot.at.y}px)`,
                  }}
                />
              ))}
        </EdgeLabelRenderer>
      )}

      {!show ? null : (
        <EdgeLabelRenderer>
          <div
            role="button"
            tabIndex={0}
            onClick={(event) => {
              // Otherwise the click reaches the pane behind and puts down what
              // it has just picked up.
              event.stopPropagation();
              selectEdge(id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') selectEdge(id);
            }}
            onMouseEnter={() => highlight(id, 'edge')}
            onMouseLeave={() => highlight(null)}
            className={
              cn(
                'pointer-events-auto absolute cursor-pointer truncate rounded-sm border border-rule-strong',
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

/**
 * Where a bend being dragged is drawn.
 *
 * The store snaps again when the drag is let go, so this is the same answer
 * shown early rather than a second rule: a dot that floats free of the grid and
 * then jumps on release would be the handle disagreeing with the line.
 */
function preview(at: Position): Position {
  const grid = readGrid();
  return grid.on ? snapTo(at, grid.step) : at;
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
