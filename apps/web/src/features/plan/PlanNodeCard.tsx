import {
  Handle,
  NodeResizeControl,
  Position as HandlePosition,
  ResizeControlVariant,
  type NodeProps,
} from '@xyflow/react';
import { isGroup } from '@schematic/schema';
import { memo } from 'react';

import { STATUS_COLOR } from '@/components/ui/status';
import { plainExcerpt } from '@/components/ui/markdown';
import { cn } from '@/lib/utils';
import { usePlanStore } from './store-context';
import type { PlanFlowNode } from './types';

/**
 * Kind is carried by the border treatment rather than a badge, the way a
 * schematic distinguishes component classes by their outline. Nothing here is
 * decorative: the rail is status, the border is kind, the dashes are certainty.
 */
/**
 * A terminal, and the area around it you can actually catch.
 *
 * The square is eight pixels because that is what reads as a terminal on a
 * drawing rather than as a button. Eight pixels is also almost impossible to
 * start a drag on, so the square keeps its size and a transparent ring around
 * it takes the pointer: twenty-four across, which is a target a hand can hit,
 * while the picture is unchanged.
 */
const HANDLE =
  '!size-2 !rounded-none !border !border-rule-strong !bg-surface-2 ' +
  "before:absolute before:-inset-2 before:content-['']";

/**
 * A group is only ever resized from its right and bottom edges.
 *
 * The other four handles move the box's own corner, and everything inside a
 * group is placed against that corner — so dragging the top-left would have to
 * move every descendant in the same gesture to keep the plan and the picture
 * agreeing. Growing down and to the right leaves the contents exactly where
 * they are, which is what somebody enlarging a box to fit another node wants
 * anyway.
 */
const RESIZE_MIN = { width: 200, height: 140 };

/**
 * The edge itself is one pixel, which is what it should look like; the strip
 * that takes the pointer is sixteen. Same bargain as a terminal above.
 */
const RESIZE_EDGE = "!border-accent before:absolute before:-inset-2 before:content-['']";
const RESIZE_CORNER =
  "!size-2 !rounded-none !border !border-accent !bg-surface-1 " +
  "before:absolute before:-inset-2 before:content-['']";

const KIND_BORDER: Record<string, string> = {
  feature: 'border border-rule-strong',
  task: 'border border-rule',
  decision: 'border border-rule-strong [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]',
  note: 'border border-dashed border-rule',
  group: 'border border-rule-strong bg-surface-3/70',
};

/*
 * A card does not read the zoom and does not change with it. It is drawn once,
 * at one size, and the canvas scales the whole drawing — so a node looks the
 * same at every distance, only nearer or further away. Two earlier attempts
 * made the card react to the zoom, first dropping text below a threshold and
 * then regrowing it; both traded a drawing you can predict for a moving one.
 */
function Card({ id, data, selected }: NodeProps<PlanFlowNode>) {
  const { node, childCount } = data;

  // One value each. A node re-renders when its own answer changes and not
  // when somebody else's does.
  const arrivedAt = usePlanStore((state) => state.arrivals.get(id));
  const dimmed = usePlanStore((state) => state.related !== null && !state.related.has(id));
  const armed = usePlanStore((state) => state.armed === id);
  const editable = usePlanStore((state) => state.editable);
  const resizeNode = usePlanStore((state) => state.resizeNode);
  const attention = cn(arrivedAt !== undefined && 'plan-arrive', dimmed && 'plan-dim');
  // Its place in the sweep. The animation fills backwards, so a card waiting
  // its turn is already invisible rather than flashing on and starting over.
  const entrance = arrivedAt === undefined ? undefined : { animationDelay: `${arrivedAt}ms` };

  // A node that holds others is drawn as the boundary around them, labelled at
  // the top edge where nothing else sits. Drawn as a card it would land on top
  // of its own first child.
  if (isGroup(node, childCount)) {
    return (
      /* Takes events across its whole area, so a group can be picked up
         anywhere on it. What it holds is drawn above it and is hit first, so
         this does not swallow clicks meant for the nodes inside.

         A boundary has to be seen before it can be read as one. At sixty per
         cent of the surface colour this was six per cent away from the ground
         it sat on and disappeared; it is now its own fill with a ring around
         it, still darker than the cards inside so they keep reading as sitting
         on top of it rather than in a hole. */
      <div
        className={cn(
          'h-full w-full rounded-lg bg-group ring-1 ring-rule-strong ring-inset',
          selected === true && 'ring-accent',
          attention,
        )}
        style={entrance}
      >
        {/* Offered on the selected box only. An invisible grab strip along
            every group's edge would take drags meant for the canvas behind it,
            and a boundary is a thing you point at before you reshape it. */}
        {editable && selected === true ? (
          <>
            <NodeResizeControl
              position="right"
              variant={ResizeControlVariant.Line}
              minWidth={RESIZE_MIN.width}
              minHeight={RESIZE_MIN.height}
              onResizeEnd={(_, size) => resizeNode(id, size)}
              className={RESIZE_EDGE}
            />
            <NodeResizeControl
              position="bottom"
              variant={ResizeControlVariant.Line}
              minWidth={RESIZE_MIN.width}
              minHeight={RESIZE_MIN.height}
              onResizeEnd={(_, size) => resizeNode(id, size)}
              className={RESIZE_EDGE}
            />
            <NodeResizeControl
              position="bottom-right"
              minWidth={RESIZE_MIN.width}
              minHeight={RESIZE_MIN.height}
              onResizeEnd={(_, size) => resizeNode(id, size)}
              className={RESIZE_CORNER}
            />
          </>
        ) : null}
        {/* A header band, so the name belongs to the box rather than floating
            over whatever the first child happens to be. */}
        <div className="flex items-center gap-2 rounded-t-lg border-b border-rule bg-group-head px-3 py-2">
          <span
            aria-hidden
            className="h-3.5 w-1 shrink-0"
            style={{ background: STATUS_COLOR[node.status] }}
          />
          <span className="truncate text-xs font-medium text-ink">{node.title}</span>
          <span className="slug truncate text-ink-faint">{node.slug}</span>
          <span className="ml-auto shrink-0 text-2xs text-ink-faint">{childCount}</span>
        </div>
        <Handle
          type="target"
          position={HandlePosition.Left}
          className={HANDLE}
        />
        <Handle
          type="source"
          position={HandlePosition.Right}
          className={HANDLE}
        />
      </div>
    );
  }

  const excerpt = plainExcerpt(node.body);

  return (
    <div
      className={cn(
        'relative flex min-h-[72px] w-[260px] overflow-hidden rounded-md bg-surface-2',
        KIND_BORDER[node.kind] ?? KIND_BORDER['task'],
        selected === true && 'border-accent ring-1 ring-accent',
        // Held over long enough that letting go would put the dragged node
        // inside this one. Drawn as the box it is about to become.
        armed && 'ring-2 ring-accent',
        attention,
      )}
      style={entrance}
    >
      <span aria-hidden className="w-1 shrink-0" style={{ background: STATUS_COLOR[node.status] }} />

      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate text-sm leading-snug font-medium text-ink">{node.title}</p>
        <p className="slug mt-0.5 truncate text-ink-faint">{node.slug}</p>
        {excerpt !== '' ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink-muted">{excerpt}</p>
        ) : null}
        {node.tags.length > 0 ? (
          <p className="mt-1.5 truncate text-2xs text-ink-faint">{node.tags.join('  ')}</p>
        ) : null}
      </div>

      {/* Square terminals rather than dots: this is a drawing, not a flowchart. */}
      <Handle
        type="target"
        position={HandlePosition.Left}
        className={HANDLE}
      />
      <Handle
        type="source"
        position={HandlePosition.Right}
        className={HANDLE}
      />
    </div>
  );
}

export const PlanNodeCard = memo(Card);
