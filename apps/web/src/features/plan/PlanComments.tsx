import type { PlanComment, Position } from '@schematic/schema';
import {
  ORIGIN_LOCAL,
  commentBodyText,
  commentsMap,
  commitCommentPosition,
} from '@schematic/ydoc';
import { ViewportPortal, useReactFlow, useStore as useFlowStore } from '@xyflow/react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type * as Y from 'yjs';

import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatWhen } from '@/lib/utils';
import { snapTo } from './snap';
import type { PlanStore } from './plan-store';
import { useYText } from './use-y-text';

/** Wide enough for a sentence, narrow enough not to cover what it is about. */
const WIDTH = 216;
/** How far clear of the drawing an unplaced note sits. */
const ABOVE = 150;

/**
 * Notes left on the drawing: what somebody thinks about it, beside it.
 *
 * They are not nodes. Nothing connects to them, layout never moves them, and
 * none of them becomes a file of its own when the plan is exported — a comment
 * is about the system, not part of it. What they are is shared: they live in the same
 * document as the graph, so one appears on every open canvas at once and an
 * agent reading the plan over MCP reads the objections with it.
 *
 * Violet throughout, because in this interface that colour means a person or an
 * agent is speaking, and a note is somebody speaking.
 */
export function PlanComments({
  store,
  doc,
  readOnly,
  showResolved,
  snap,
  onSelect,
}: {
  store: PlanStore['store'];
  doc: Y.Doc;
  readOnly: boolean;
  showResolved: boolean;
  /** The grid step a dragged note lands on, or null when nothing is snapping. */
  snap: number | null;
  onSelect: (id: string | null) => void;
}) {
  const comments = useStore(store, (state) => state.comments);
  const selected = useStore(store, (state) => state.selectedComment);
  const absolute = useStore(store, (state) => state.absolute);
  const showing = comments.filter((comment) => showResolved || !comment.resolved);
  const placed = usePlacements(showing, absolute);
  if (showing.length === 0) return null;

  return (
    <ViewportPortal>
      {showing.map((comment) => (
        <Note
          key={comment.id}
          comment={comment}
          at={comment.position ?? placed[comment.id] ?? { x: 0, y: 0 }}
          doc={doc}
          readOnly={readOnly}
          snap={snap}
          open={comment.id === selected}
          anchoredAt={comment.anchor === null ? null : (absolute[comment.anchor] ?? null)}
          onSelect={onSelect}
        />
      ))}
    </ViewportPortal>
  );
}

/**
 * Where a note goes when nobody has said.
 *
 * `null` means unplaced, the same as it does on a node — but layout must never
 * move a note, so nothing on the server ever fills this in. An agent leaving one
 * over MCP has no coordinates to give and should not have any, which left every
 * such note stacked on the origin, underneath whatever card happened to be
 * there.
 *
 * So the drawing decides, from the same document every client has: a note about
 * a node sits above it, clear of the row the flow runs along, and one about the
 * plan as a whole goes under the drawing in the order it was left. Dragging it
 * writes a real position and this stops applying to it.
 */
function usePlacements(
  comments: readonly PlanComment[],
  absolute: Record<string, Position>,
): Record<string, Position> {
  return useMemo(() => {
    const placed: Record<string, Position> = {};
    let below = 0;

    const corners = Object.values(absolute);
    const left = corners.length === 0 ? 0 : Math.min(...corners.map((at) => at.x));
    const bottom = corners.length === 0 ? 0 : Math.max(...corners.map((at) => at.y));

    for (const comment of comments) {
      if (comment.position !== null) continue;
      const anchor = comment.anchor === null ? undefined : absolute[comment.anchor];
      if (anchor !== undefined) {
        placed[comment.id] = { x: anchor.x, y: anchor.y - ABOVE };
        continue;
      }
      placed[comment.id] = { x: left + below * (WIDTH + 24), y: bottom + ABOVE };
      below += 1;
    }
    return placed;
  }, [comments, absolute]);
}

function Note({
  comment,
  at: fallback,
  doc,
  readOnly,
  snap,
  open,
  anchoredAt,
  onSelect,
}: {
  comment: PlanComment;
  /** Where to draw it, which is its own position unless it has none. */
  at: Position;
  doc: Y.Doc;
  readOnly: boolean;
  snap: number | null;
  open: boolean;
  /** Where the node this is about sits, so the tie can be drawn. */
  anchoredAt: Position | null;
  onSelect: (id: string | null) => void;
}) {
  const [body, write] = useYText(commentBodyText(doc, comment.id));
  const { screenToFlowPosition } = useReactFlow();
  const zoom = useFlowStore((state) => state.transform[2]);
  // Where it is while being dragged. The document hears about it once, at the end.
  const [held, setHeld] = useState<Position | null>(null);
  const grab = useRef<{ pointer: Position; from: Position } | null>(null);

  const at = held ?? comment.position ?? fallback;

  const onPointerDown = (event: React.PointerEvent): void => {
    if (readOnly || event.button !== 0) return;
    // Panning the canvas and moving the note are the same gesture otherwise.
    event.stopPropagation();
    grab.current = {
      pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      // From where it is drawn, not from the origin: picking up a note that has
      // never been placed must not teleport it first.
      from: at,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    const start = grab.current;
    if (start === null) return;
    const now = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const dragged = {
      x: start.from.x + (now.x - start.pointer.x),
      y: start.from.y + (now.y - start.pointer.y),
    };
    // Snapped while it moves rather than on release. Dragging a note is our own
    // gesture rather than React Flow's, so there is nothing to fight: the note
    // can simply be drawn where it is going to end up.
    setHeld(snap === null ? dragged : snapTo(dragged, snap));
  };

  const onPointerUp = (): void => {
    const moved = held;
    grab.current = null;
    setHeld(null);
    if (moved !== null) commitCommentPosition(doc, comment.id, moved, ORIGIN_LOCAL);
  };

  const apply = (patch: Partial<PlanComment>): void => {
    const target = commentsMap(doc).get(comment.id);
    if (target === undefined) return;
    doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) target.set(key, value);
    }, ORIGIN_LOCAL);
  };

  const remove = (): void => {
    doc.transact(() => commentsMap(doc).delete(comment.id), ORIGIN_LOCAL);
    onSelect(null);
  };

  return (
    <>
      {/* The tie to the node it is about. Hairline, behind everything: it says
          which box is meant without competing with the lines that carry data. */}
      {anchoredAt === null ? null : (
        <svg
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          style={{ width: 1, height: 1 }}
          aria-hidden
        >
          <line
            x1={at.x + 8}
            y1={at.y + 8}
            x2={anchoredAt.x + 8}
            y2={anchoredAt.y + 8}
            stroke="var(--collab)"
            strokeOpacity="0.4"
            strokeWidth={1 / zoom}
            strokeDasharray={`${3 / zoom} ${3 / zoom}`}
          />
        </svg>
      )}

      <div
        // `nopan` and `nodrag` keep React Flow's own gestures off the note.
        className={cn(
          'nopan nodrag absolute top-0 left-0 rounded-md border bg-surface-3 text-left elevated',
          comment.resolved
            ? 'border-rule opacity-60'
            : 'border-collab/45 shadow-[0_0_0_1px_rgb(139_92_246/0.12)]',
        )}
        // Above every node: React Flow stacks nodes by containment depth in
        // small numbers, and a note behind the card it is about is a note
        // nobody can read or reach.
        style={{ transform: `translate(${at.x}px, ${at.y}px)`, width: WIDTH, zIndex: 1000 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={() => onSelect(open ? null : comment.id)}
          className="flex w-full items-baseline gap-1.5 px-2 pt-1.5 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-2xs font-medium text-collab">
            {comment.author === '' ? 'Someone' : comment.author}
          </span>
          {comment.at === '' ? null : (
            <span className="shrink-0 text-2xs text-ink-faint">{formatWhen(comment.at)}</span>
          )}
        </button>

        {open && !readOnly ? (
          <textarea
            autoFocus
            value={body}
            onChange={(event) => write(event.target.value)}
            // A note is dragged by its head, not by the words being typed into it.
            onPointerDown={(event) => event.stopPropagation()}
            rows={4}
            placeholder="What about this?"
            className="w-full resize-none bg-transparent px-2 py-1 text-xs leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(comment.id)}
            className="block w-full px-2 py-1 text-left text-xs leading-relaxed whitespace-pre-wrap text-ink"
          >
            {body === '' ? <span className="text-ink-faint">Empty note</span> : clip(body)}
          </button>
        )}

        {readOnly ? null : (
          <div className="flex items-center justify-end gap-0.5 border-t border-rule px-1 py-0.5">
            <Tooltip content={comment.resolved ? 'Reopen' : 'Resolve'}>
              <button
                type="button"
                onClick={() => apply({ resolved: !comment.resolved })}
                className="grid size-5 place-items-center rounded text-ink-faint hover:bg-surface-2 hover:text-ink"
              >
                {comment.resolved ? (
                  <RotateCcw className="size-3" />
                ) : (
                  <Check className="size-3" />
                )}
                <span className="sr-only">{comment.resolved ? 'Reopen' : 'Resolve'}</span>
              </button>
            </Tooltip>
            <Tooltip content="Delete note">
              <button
                type="button"
                onClick={remove}
                className="grid size-5 place-items-center rounded text-ink-faint hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3" />
                <span className="sr-only">Delete note</span>
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </>
  );
}

/** Folded shut, a note shows its opening rather than growing down the canvas. */
function clip(body: string): string {
  const lines = body.split('\n');
  const head = lines.slice(0, 4).join('\n');
  return head.length > 180 ? `${head.slice(0, 180)}…` : lines.length > 4 ? `${head}…` : head;
}
