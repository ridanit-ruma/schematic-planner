import {
  Handle,
  NodeResizeControl,
  Position as HandlePosition,
  ResizeControlVariant,
  type NodeProps,
} from '@xyflow/react';
import { CARD, isGroup, kindOf } from '@schematic/schema';
import { memo, useEffect, useRef, useState } from 'react';

import { Markdown } from '@/components/ui/markdown';
import { LOOK_BORDER, statusColor, tagColor, tint } from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { usePlanStore } from './store-context';
import { useTitleEditing, type TitleEditor } from './title-editing';
import { useWheelScroll } from './use-wheel-scroll';
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
  'plan-grip !border-transparent touch-none ' +
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
  onSize,
  onResize,
}: {
  id: string;
  selected: boolean;
  onSize: (id: string, size: Size) => void;
  onResize: (id: string, size: Size) => void;
}) {
  return (
    <NodeResizeControl
      position="right"
      variant={ResizeControlVariant.Line}
      minWidth={CARD.minWidth}
      maxWidth={CARD.maxWidth}
      /*
       * Throughout the drag, not only at the end of it. React Flow widens the
       * card on every frame; a box around it is worked out from what it holds,
       * which is read from the document, which a resize does not reach until
       * the grip is let go — so the card grew out through the edge of its box
       * and the box caught up in one jump on release. This is heard by the
       * store and kept out of the document until then.
       */
      onResize={(_, size) => onSize(id, size)}
      onResizeEnd={(_, size) => onResize(id, size)}
      /*
       * Faint on the node being worked on, solid under the pointer, absent
       * otherwise: a drawing should not be fringed with controls.
       *
       * Except where there is no pointer. A touch screen never fires hover, so
       * the grip was invisible on the one device where the target also has to
       * be bigger — and `touch-action: none` above is what stops the browser
       * claiming the gesture for a pan once the finger has travelled, which is
       * why widening a card on a phone moved one grid step and then stopped.
       */
      data-selected={selected ? 'true' : 'false'}
      className={cn(RESIZE_EDGE, RESIZE_MARK, selected ? 'after:opacity-40' : 'after:opacity-0')}
    />
  );
}

/*
 * The outline comes from the kind's look in the project's vocabulary. A kind
 * the project does not define is drawn plain, the way a task is: present,
 * readable, and claiming nothing.
 */
const UNKNOWN_BORDER = LOOK_BORDER.solid;

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
  const vocabulary = usePlanStore((state) => state.vocabulary);
  const rail = statusColor(vocabulary, node.status);
  const kind = kindOf(vocabulary, node.kind);
  const border = kind === undefined ? UNKNOWN_BORDER : LOOK_BORDER[kind.look];
  const sizeNode = usePlanStore((state) => state.sizeNode);
  const toggleTask = usePlanStore((state) => state.toggleTask);
  const attention = cn(arrivedAt !== undefined && 'plan-arrive', dimmed && 'plan-dim');
  // Its place in the sweep. The animation fills backwards, so a card waiting
  // its turn is already invisible rather than flashing on and starting over.
  const entrance = arrivedAt === undefined ? undefined : { animationDelay: `${arrivedAt}ms` };

  /*
   * A wheel over the card is the body's while the body can scroll.
   *
   * On the card and not on the body, because a card is capped at 420 and the
   * part of it a pointer is most likely to be over — the title, the slug, the
   * tags — is not the part that scrolls. The hook says why it is a native
   * listener and what it does with the event.
   *
   * Called here, above the boundary branch, because every node is this one
   * component: `nodeTypes` names `plan` and nothing else. A node drawn as a
   * box that gains — or loses — a child becomes a card in the same instance,
   * and a hook called only down the card path would change this component's
   * hook count mid-life, which React refuses outright. The element arrives
   * through state rather than a ref so that the listener can attach on the
   * render that first draws a card, and not only at mount.
   */
  const scroller = useRef<HTMLDivElement | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  useWheelScroll(card, scroller);
  const naming = useTitleEditing(id);
  // Double-clicking a title types over it, where the canvas can be edited.
  const rename = naming.editor === null ? undefined : () => naming.editor?.start(id);

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
            style={{ background: rail }}
          />
          {naming.editing && naming.editor !== null ? (
            <TitleField
              slug={id}
              title={node.title}
              fresh={naming.fresh}
              editor={naming.editor}
              className="text-xs"
            />
          ) : (
            <span className="truncate text-xs font-medium text-ink" onDoubleClick={rename}>
              {node.title}
            </span>
          )}
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
     * Everything that takes a pointer is drawn beside the card, after it, in
     * the order it should win in.
     *
     * The card clips its own overflow, to keep the status rail inside its
     * rounded corners — so a control inside it is cut in half, and a control
     * before it is painted over. Measured on the running instance, a pointer
     * six pixels inside the right edge landed on the card's own text column and
     * dragged the node. The grip comes after the card, and the terminals after
     * the grip, so the terminal keeps the twenty-four pixels it needs and the
     * grip has the rest of the edge.
     */
    <>
    <div
      ref={setCard}
      className={cn(
        'relative flex h-full w-full overflow-hidden rounded-md bg-surface-2',
        border,
        selected === true && 'border-accent ring-1 ring-accent',
        // Held over long enough that letting go would put the dragged node
        // inside this one. Drawn as the box it is about to become.
        armed && 'ring-2 ring-accent',
        attention,
      )}
      style={entrance}
    >
      <span aria-hidden className="w-1 shrink-0" style={{ background: rail }} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 py-2">
        {naming.editing && naming.editor !== null ? (
          <TitleField
            slug={id}
            title={node.title}
            fresh={naming.fresh}
            editor={naming.editor}
            className="text-sm leading-snug"
          />
        ) : (
          <p
            className="truncate text-sm leading-snug font-medium text-ink"
            onDoubleClick={rename}
          >
            {node.title}
          </p>
        )}
        <p className="slug mt-0.5 truncate text-ink-faint">{node.slug}</p>
        {hasBody ? (
          /* A long body is scrolled, not dragged — the note next door already
             settled that, and a second answer to it would be a second answer. */
          <div
            ref={scroller}
            onPointerDown={(event) => event.stopPropagation()}
            className="nodrag mt-1.5 min-h-0 flex-1 overflow-y-auto text-xs leading-snug text-ink-muted"
          >
            <Markdown
              body={node.body}
              onToggleTask={editable ? (index) => toggleTask(id, index) : undefined}
            />
          </div>
        ) : null}
        {node.tags.length > 0 ? (
          /* One row, clipped rather than wrapped: the card's height is measured
             without the tags, the same way on the server and here. */
          <p className="mt-1.5 flex min-w-0 gap-1 overflow-hidden">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="shrink-0 rounded-sm border px-1 text-2xs leading-4"
                style={tint(tagColor(vocabulary, tag))}
              >
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>

    </div>
      {editable ? (
        <WidthHandle
          id={id}
          selected={selected === true}
          onSize={sizeNode}
          onResize={resizeNode}
        />
      ) : null}
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
    </>
  );
}

/**
 * A title being typed on the card.
 *
 * Enter or leaving the field keeps it; Escape leaves the title as it was — and
 * takes away a node that was made a moment ago to be named. One of them, once:
 * the field goes as soon as either happens, and a blur arriving after Escape
 * is not a second answer.
 */
function TitleField({
  slug,
  title,
  fresh,
  editor,
  className,
}: {
  slug: string;
  title: string;
  fresh: boolean;
  editor: TitleEditor;
  className: string;
}) {
  const t = useT();
  const [value, setValue] = useState(fresh ? '' : title);
  const settled = useRef(false);
  const field = useRef<HTMLInputElement | null>(null);

  /*
   * Focused by hand rather than with autoFocus. A node React Flow has not
   * measured yet is drawn hidden, and a hidden field refuses focus without a
   * word — so a card made a moment ago opened for typing and took none. It is
   * tried again each frame until the card is shown.
   */
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const attempt = (): void => {
      const input = field.current;
      if (input === null) return;
      input.focus({ preventScroll: true });
      if (document.activeElement === input) {
        input.select();
        return;
      }
      tries += 1;
      if (tries < 60) frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, []);
  const finish = (keep: boolean): void => {
    if (settled.current) return;
    settled.current = true;
    if (keep) editor.commit(slug, value);
    else editor.cancel(slug);
  };

  return (
    <input
      ref={field}
      value={value}
      placeholder={t.canvas.canvas.card.untitled}
      aria-label={t.canvas.canvas.card.title}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        // Nothing typed here is a shortcut for the canvas.
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
      className={cn(
        'nodrag nopan nowheel -mx-1 w-[calc(100%+0.5rem)] min-w-0 rounded-sm bg-surface-3 px-1 font-medium text-ink ring-1 ring-accent outline-none placeholder:text-ink-faint',
        className,
      )}
    />
  );
}

export const PlanNodeCard = memo(Card);
