import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { edgeNote, type Position } from '@schematic/schema';
import { memo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  dragSegment,
  labelAt,
  movableSegments,
  pathOf,
  routeOf,
  segmentOfLabel,
  type Side,
} from './edge-path';
import { snapValue } from './snap';
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
 * A card looks the same at every zoom and so does the writing on a line, so
 * what decides whether a note is drawn is room rather than taste: below this
 * much of it the letters are a smudge and the run is too short to hold them.
 *
 * A line too short to hold one keeps quiet and says what it carries in the
 * inspector instead, because the writing would be wider than the run it sits on.
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
/** Pointer travel, in canvas units, before a grab on a line counts as a drag. */
const GRAB_SLOP = 3;

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
  const [heldLabel, setHeldLabel] = useState<Position | null>(null);
  // One drag, one place to keep it. The old arrangement had three hit areas
  // overlapping and two refs kept apart so that a bend being moved was not also
  // read as the line being grabbed underneath it.
  const drag = useRef<{
    index: number;
    axis: 'x' | 'y';
    origin: number;
    pointer: Position;
    route: Position[];
    label: Position | null;
    carries: boolean;
    moved: boolean;
  } | null>(null);

  const edgeData = data?.edge;
  const ends = {
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    sourceSide: sourcePosition as Side,
    targetSide: targetPosition as Side,
  };

  // One router, always. Drawing an untouched line with React Flow's smooth-step
  // and a touched one with this meant the shape changed the instant a line was
  // grabbed, for no reason the person dragging it could see.
  const chain: readonly Position[] = held ?? edgeData?.waypoints ?? [];
  const route = routeOf(ends.source, ends.sourceSide, ends.target, ends.targetSide, chain);
  const path = pathOf(route);

  /*
   * How many flows leave this node, and which of them this is.
   *
   * By the terminal they leave and not by the pair they join: three flows out
   * of one node into three different ones still share the corridor beside it,
   * and counting pairs left all three notes at the same fraction of their own
   * runs — which the gate caught as three notes, three overlapping. Ordered by
   * edge id so that two people looking at the same plan put them in the same
   * places.
   *
   * Two selectors, each returning a number. One returning `{ of, index }` is a
   * fresh object every call, and zustand compares with `Object.is` — so the
   * component re-rendered for ever and the canvas drew nothing at all. The
   * gate's first section said so: `nodes render  0 nodes`.
   */
  const alongside = usePlanStore(
    (state) => state.edges.filter((other) => other.source === edgeData?.from).length,
  );
  const amongThem = usePlanStore((state) =>
    state.edges
      .filter((other) => other.source === edgeData?.from)
      .map((other) => other.id)
      .sort()
      .indexOf(id),
  );
  const corridor = { of: Math.max(1, alongside), index: Math.max(0, amongThem) };

  const selectEdge = usePlanStore((state) => state.selectEdge);
  const editable = usePlanStore((state) => state.editable);
  const routeEdge = usePlanStore((state) => state.routeEdge);
  const highlight = usePlanStore((state) => state.highlight);

  const kind = data?.edge.kind ?? 'depends_on';
  const style = STYLE[kind] ?? STYLE['depends_on']!;
  const edge = data?.edge;

  // What sets a flow off and what it carries are the flow. Drawn on the line
  // rather than hidden in the inspector: reading the picture is the point, and
  // an arrow with nothing written on it says only that two things touch.
  const note = edge === undefined ? '' : edgeNote(edge);

  /*
   * On the line, worked out from the route that is drawn, every render.
   *
   * It used to be drawn at `edge.labelPosition` — a point ELK recorded when it
   * laid the plan out, through ELK's own channels and ports, and not the line
   * this file draws. Nothing reconciled the two, so on a freshly arranged
   * canvas every note floated clear of the flow it belonged to: it was sitting
   * on a line in a picture nobody sees. The guard against staleness could not
   * catch it either, because nothing had moved — the point was wrong the moment
   * it was written.
   *
   * `heldLabel` is the exception, and only within a gesture: while a note is
   * being dragged it is drawn under the finger, and the moment that ends it
   * returns to the line.
   */
  const placed = heldLabel;
  const at = placed ?? labelAt(route, corridor);
  const show = note !== '' && legible;

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
      {/*
        One invisible hit area per run of the line that can actually be moved.

        Not the whole path: the runs that touch a card are pinned to their
        handles, and a hit area over them would be a control that does nothing.
        Leaving them bare is also how the cursor tells a reader which parts of a
        line move, before anything is clicked.

        `stroke` rather than `all` so only the run itself takes the pointer and
        not the box around it.
      */}
      {!editable
        ? null
        : movableSegments(route).map((run) => (
            <path
              key={`run-${run.index}`}
              d={`M ${run.a.x},${run.a.y} L ${run.b.x},${run.b.y}`}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{
                pointerEvents: 'stroke',
                cursor: run.axis === 'x' ? 'col-resize' : 'row-resize',
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                // Panning the canvas and moving the run are the same gesture
                // otherwise, and the pane wins.
                event.stopPropagation();
                const committed = routeOf(
                  ends.source,
                  ends.sourceSide,
                  ends.target,
                  ends.targetSide,
                  edgeData?.waypoints ?? [],
                );
                // Where the writing is on the committed route, rather than a
                // point that used to be stored. Same question, asked of the
                // thing that now answers it.
                const label = labelAt(committed, corridor);
                drag.current = {
                  index: run.index,
                  axis: run.axis,
                  origin: run.axis === 'x' ? run.a.x : run.a.y,
                  pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                  route: committed,
                  label,
                  // Only the writing sitting on this run travels with it.
                  carries: segmentOfLabel(committed, label) === run.index,
                  moved: false,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                if (start === null) return;
                const now = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const travelled =
                  start.axis === 'x' ? now.x - start.pointer.x : now.y - start.pointer.y;
                // A click is a drag of no distance. Without this, taking hold of
                // a line to select it would also move it.
                if (!start.moved && Math.abs(travelled) < GRAB_SLOP) return;
                start.moved = true;

                const grid = readGrid();
                const loose = start.origin + travelled;
                const to = grid.on ? snapValue(loose, grid.step) : loose;
                setHeld(dragSegment(start.route, start.index, to));

                if (start.carries && start.label !== null) {
                  const shift = to - start.origin;
                  setHeldLabel(
                    start.axis === 'x'
                      ? { x: start.label.x + shift, y: start.label.y }
                      : { x: start.label.x, y: start.label.y + shift },
                  );
                }
              }}
              onPointerUp={() => {
                const start = drag.current;
                const shape = held;
                const label = heldLabel;
                drag.current = null;
                setHeld(null);
                setHeldLabel(null);
                if (start === null) return;
                if (start.moved && shape !== null) {
                  // `undefined` and not `null`: null means "put the writing back
                  // at the midpoint", and a run moved out from under a label that
                  // was sitting somewhere else must not take its place away.
                  routeEdge(id, shape, label ?? undefined);
                  return;
                }
                // A grab that never moved was a click. This surface swallows the
                // one React Flow would have turned into onEdgeClick, so the
                // selection it was going to make is made here instead.
                selectEdge(id);
              }}
            />
          ))}
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
