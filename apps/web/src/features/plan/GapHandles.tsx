import { ViewportPortal, useStore as useFlowStore } from '@xyflow/react';
import type { Position, Rect } from '@schematic/schema';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { useT } from '@/i18n';
import { evenRow, respace, type GapMarker } from './spacing';

/** Above every node, the same layer the alignment guides are drawn on. */
const LAYER = 1001;

/**
 * The size of a gap, written where it is. A pill at a fixed screen size, so it
 * reads the same at every zoom.
 */
function GapLabel({ x, y, size, zoom }: { x: number; y: number; size: number; zoom: number }) {
  return (
    <div
      className="pointer-events-none absolute rounded-sm bg-measure px-1 font-mono text-2xs leading-4 text-white"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
        zIndex: LAYER,
      }}
    >
      {Math.round(size)}
    </div>
  );
}

/**
 * Equal gaps a dragged block has found, drawn the way a drawing tool draws
 * them: a measured span across each matching gap, with its size on it.
 */
export function GapMarkers({ gaps }: { gaps: readonly GapMarker[] }) {
  const zoom = useFlowStore((state) => state.transform[2]);
  if (gaps.length === 0) return null;
  const tick = 4 / zoom;
  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        style={{ width: 1, height: 1, zIndex: LAYER }}
        aria-hidden
      >
        {gaps.map((gap) => {
          const [x1, y1, x2, y2] =
            gap.axis === 'x'
              ? [gap.from, gap.at, gap.to, gap.at]
              : [gap.at, gap.from, gap.at, gap.to];
          const ticks =
            gap.axis === 'x'
              ? [
                  [x1, y1 - tick, x1, y1 + tick],
                  [x2, y2 - tick, x2, y2 + tick],
                ]
              : [
                  [x1 - tick, y1, x1 + tick, y1],
                  [x2 - tick, y2, x2 + tick, y2],
                ];
          return (
            <g
              key={`${gap.axis}:${gap.from}:${gap.to}:${gap.at}`}
              stroke="var(--measure)"
              strokeWidth={1 / zoom}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              {ticks.map(([a, b, c, d], index) => (
                <line key={index} x1={a} y1={b} x2={c} y2={d} />
              ))}
            </g>
          );
        })}
      </svg>
      {gaps.map((gap) => (
        <GapLabel
          key={`label:${gap.axis}:${gap.from}:${gap.to}:${gap.at}`}
          x={gap.axis === 'x' ? (gap.from + gap.to) / 2 : gap.at}
          y={gap.axis === 'x' ? gap.at : (gap.from + gap.to) / 2}
          size={gap.size}
          zoom={zoom}
        />
      ))}
    </ViewportPortal>
  );
}

export interface GapMember {
  slug: string;
  /** Absolute bounds, as drawn. */
  rect: Rect;
}

/**
 * Handles in the gaps of an evenly spaced selection.
 *
 * Dragging any of them changes every gap by the same amount, the first member
 * staying where it is — the one control that says "these are spaced alike"
 * and keeps them so. Only offered where it is true: an uneven selection has no
 * one gap to hold, and is offered Tidy up in the menu instead.
 *
 * What the drag shows goes through `onPreview`, never the document; the
 * document hears once, at the end, through `onCommit`.
 */
export function GapHandles({
  members,
  onPreview,
  onCommit,
}: {
  members: readonly GapMember[];
  onPreview: (positions: ReadonlyMap<string, Position> | null) => void;
  onCommit: (positions: ReadonlyMap<string, Position>) => void;
}) {
  const t = useT();
  const tx = useFlowStore((state) => state.transform[0]);
  const ty = useFlowStore((state) => state.transform[1]);
  const zoom = useFlowStore((state) => state.transform[2]);
  const rects = useMemo(() => members.map((member) => member.rect), [members]);
  const row = useMemo(() => evenRow(rects), [rects]);
  const [gap, setGap] = useState<number | null>(null);
  // The gap the pointer is at lives here too: a release can come before the
  // last move has been drawn, and the rendered `gap` would still be the one before.
  const drag = useRef<{ pointer: number; from: number; gap: number } | null>(null);

  if (row === null) return null;
  const current = gap ?? row.gap;
  const placed =
    gap === null
      ? rects
      : respace(rects, row, gap).map((at, index) => ({ ...(rects[index] as Rect), ...at }));

  const positionsAt = (next: number): Map<string, Position> => {
    const at = respace(rects, row, next);
    return new Map(members.map((member, index) => [member.slug, at[index] as Position]));
  };

  const along = (event: ReactPointerEvent): number =>
    row.axis === 'x' ? event.clientX : event.clientY;

  const handles = row.order.slice(1).map((index, step) => {
    const before = placed[row.order[step] as number] as Rect;
    const after = placed[index] as Rect;
    if (row.axis === 'x') {
      const low = Math.max(before.y, after.y);
      const high = Math.min(before.y + before.height, after.y + after.height);
      return {
        x: (before.x + before.width + after.x) / 2,
        y:
          low < high
            ? (low + high) / 2
            : (before.y + after.y + (before.height + after.height) / 2) / 2,
      };
    }
    const low = Math.max(before.x, after.x);
    const high = Math.min(before.x + before.width, after.x + after.width);
    return {
      x:
        low < high ? (low + high) / 2 : (before.x + after.x + (before.width + after.width) / 2) / 2,
      y: (before.y + before.height + after.y) / 2,
    };
  });

  // In screen space, over the canvas rather than inside it: React Flow draws a
  // selection's outline above everything in the drawing, and a handle under
  // it could be seen and not caught.
  const screen = (point: Position): Position => ({
    x: tx + point.x * zoom,
    y: ty + point.y * zoom,
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 6 }}>
      {handles.map((handle, index) => {
        const at = screen(handle);
        return (
          <div
            key={index}
            role="slider"
            aria-label={t.canvas.canvas.spacing.handle}
            aria-valuenow={Math.round(current)}
            aria-orientation={row.axis === 'x' ? 'horizontal' : 'vertical'}
            data-gap-handle={index}
            className="nodrag nopan absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={{
              left: at.x,
              top: at.y,
              cursor: row.axis === 'x' ? 'ew-resize' : 'ns-resize',
              pointerEvents: 'all',
              touchAction: 'none',
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { pointer: along(event), from: row.gap, gap: row.gap };
              setGap(row.gap);
            }}
            onPointerMove={(event) => {
              if (drag.current === null) return;
              const next = Math.max(
                0,
                Math.round(drag.current.from + (along(event) - drag.current.pointer) / zoom),
              );
              drag.current.gap = next;
              setGap(next);
              onPreview(positionsAt(next));
            }}
            onPointerUp={(event) => {
              if (drag.current === null) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              const next = drag.current.gap;
              const moved = Math.abs(next - drag.current.from) >= 1;
              drag.current = null;
              setGap(null);
              if (moved) onCommit(positionsAt(next));
              else onPreview(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setGap(null);
              onPreview(null);
            }}
          >
            <span
              className="rounded-full bg-measure"
              style={row.axis === 'x' ? { width: 3, height: 14 } : { width: 14, height: 3 }}
            />
          </div>
        );
      })}
      {gap === null
        ? null
        : handles.map((handle, index) => {
            const at = screen(handle);
            return (
              <div
                key={`size:${index}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-measure px-1 font-mono text-2xs leading-4 text-white"
                style={{
                  left: at.x + (row.axis === 'y' ? 24 : 0),
                  top: at.y + (row.axis === 'x' ? 18 : 0),
                }}
              >
                {Math.round(current)}
              </div>
            );
          })}
    </div>
  );
}
