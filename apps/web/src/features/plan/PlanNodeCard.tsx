import {
  Handle,
  NodeResizeControl,
  Position as HandlePosition,
  ResizeControlVariant,
  type NodeProps,
} from '@xyflow/react';
import { CARD, isGroup } from '@schematic/schema';
import { memo } from 'react';

import { STATUS_COLOR } from '@/components/ui/status';
import { Markdown } from '@/components/ui/markdown';
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
 * The one gesture a node offers, and the strip that takes it.
 *
 * A card's width is a person's to choose; its height is not, and a box has
 * neither — it is drawn around what it holds. So this is the only handle on the
 * canvas, and it is a card's right edge.
 *
 * Twelve pixels, all of them *inside* the card. Measured on the old one, the
 * band that actually resized was eight pixels straddling the border: inward of
 * it the connection terminal took the pointer and started a line, outward of it
 * the canvas took it and panned. Both read as "I grabbed the edge and nothing
 * happened". Reaching inward instead leaves the pane alone, and drawing this
 * after the card puts it over the terminal rather than under it.
 */
const RESIZE_EDGE =
  '!border-transparent ' +
  "before:absolute before:inset-y-1 before:-left-3 before:right-0 before:cursor-ew-resize before:content-['']";

/**
 * What the strip looks like, so that it can be found without being told.
 *
 * Invisible until the node was selected is how a resize handle stays a secret:
 * you have to already know it is there to go looking for it. This one answers
 * the pointer — a rule down the edge on hover, brighter while it is held.
 */
const RESIZE_MARK =
  'after:pointer-events-none after:absolute after:inset-y-1 after:right-0 after:w-1 ' +
  'after:-translate-x-full after:rounded-full after:bg-accent after:transition-opacity ' +
  "after:content-[''] hover:after:!opacity-100";


interface Size {
  width: number;
  height: number;
}

/**
 * A card's one handle.
 *
 * The right edge and nothing else. A bottom edge would offer a height that the
 * next render overrules — what a card has to say decides how tall it is — and a
 * handle that does not hold is worse than no handle. The width is the axis a
 * person does have an opinion about, and the height is then measured at it.
 */
function WidthHandle({
  id,
  selected,
  onResize,
}: {
  id: string;
  selected: boolean;
  onResize: (id: string, size: Size) => void;
}) {
  return (
    <NodeResizeControl
      position="right"
      variant={ResizeControlVariant.Line}
      minWidth={CARD.minWidth}
      maxWidth={CARD.maxWidth}
      onResizeEnd={(_, size) => onResize(id, size)}
      // Faint on the node being worked on, solid under the pointer, absent
      // otherwise: a drawing should not be fringed with controls.
      className={cn(RESIZE_EDGE, RESIZE_MARK, selected ? 'after:opacity-40' : 'after:opacity-0')}
    />
  );
}

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

  /*
   * A card shows what is in it, always.
   *
   * It used to draw two lines of Markdown with the syntax stripped and truncate
   * the rest, readable only in the inspector — a canvas that draws the flow and
   * hides what flows. The server was already reserving room for the whole body
   * while the browser drew eighty pixels of it, so a node with ten lines had a
   * hole under it and its body still could not be read.
   *
   * The box comes from the store, which measured this body at this card's
   * width. Past the ceiling the card is full and scrolls rather than growing
   * into a wall the lines have to go round.
   */
  const hasBody = node.body.trim() !== '';

  return (
    /*
     * The corners are drawn beside the card rather than inside it. A resize
     * control sits centred on the edge it belongs to — half in, half out — and
     * the card clips its overflow to keep the status rail inside its rounded
     * corners, which cut the half that takes the pointer. The box next door has
     * no such clipping, which is why it worked there and not here.
     */
    <>
      {editable ? (
        <WidthHandle id={id} selected={selected === true} onResize={resizeNode} />
      ) : null}
    <div
      className={cn(
        'relative flex h-full w-full overflow-hidden rounded-md bg-surface-2',
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 py-2">
        <p className="truncate text-sm leading-snug font-medium text-ink">{node.title}</p>
        <p className="slug mt-0.5 truncate text-ink-faint">{node.slug}</p>
        {hasBody ? (
          /* A long body is scrolled, not dragged — the note next door already
             settled that, and a second answer to it would be a second answer. */
          <div
            onPointerDown={(event) => event.stopPropagation()}
            className="nodrag mt-1.5 min-h-0 flex-1 overflow-y-auto text-xs leading-snug text-ink-muted"
          >
            <Markdown body={node.body} />
          </div>
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
    </>
  );
}

export const PlanNodeCard = memo(Card);
