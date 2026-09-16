import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  useReactFlow,
} from '@xyflow/react';
import {
  CARD,
  isGroup,
  normalizeEdge,
  planEdgeInputSchema,
  type Box,
  type PlanOp,
  type Position,
} from '@schematic/schema';
import { ORIGIN_LOCAL, commitLayout, commitNodePosition, nudgeEdges } from '@schematic/ydoc';
import {
  Group,
  Grid2x2,
  MessageSquarePlus,
  Plus,
  Redo2,
  Shrink,
  Trash2,
  Undo2,
  Ungroup,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import type * as Y from 'yjs';

import {
  ContextAction,
  ContextChoice,
  ContextMenu,
  ContextSeparator,
  ContextSub,
} from '@/components/ui/context-menu';
import { plural } from '@/lib/utils';
import { resolveDrop, type DropTarget, type Rect } from './group-drop';
import { groupOps } from './make-group';
import type { PlanStore } from './plan-store';
import { PlanStoreProvider } from './store-context';
import { useReadingWalk } from './use-reading-walk';
import { EdgeMarkers, PlanEdgeLine } from './PlanEdgeLine';
import { PeerCursors } from './PeerCursors';
import { PlanComments } from './PlanComments';
import { PlanNodeCard } from './PlanNodeCard';
import type { PlanConnection } from './use-plan-document';
import type { PlanFlowEdge, PlanFlowNode } from './types';
import { COARSE_MULTIPLE, GRID_STEPS, type GridStep, snapTo } from './snap';
import { useGrid } from './use-grid';
import type { Undo } from './use-undo';

/*
 * Declared once at module scope. Rebuilding these objects inside the component
 * makes React Flow unmount and remount every node on every render, which is the
 * single most expensive mistake available here.
 */
const nodeTypes: NodeTypes = { plan: PlanNodeCard };

/**
 * How long a node must be held *still* over an ordinary card before letting go
 * would put it inside that card, and how far the hand may drift and still count
 * as still.
 *
 * Dropping into something already drawn as a box needs no wait: the box is
 * visible, aiming at it is the whole gesture. Turning a card into a box is a
 * change to the shape of the plan, and on a dense canvas a card is something
 * you pass over on the way somewhere else — so it asks to be meant.
 *
 * Stillness is measured on the pointer rather than on the clock alone. Timing
 * how long the card has been underneath counts a slow crossing as a rest, and a
 * hand crossing a crowded canvas slowly is exactly the case this exists to let
 * through untouched. So any real movement starts the wait over, and the gesture
 * is what it says it is: stop on the card, and it lights up.
 */
const ARM_MS = 500;
const STILL_PX = 3;

/** Where the hand is, whether it is a mouse or a finger. */
function pointerOf(event: MouseEvent | TouchEvent): Position | null {
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = event.touches[0] ?? event.changedTouches[0];
  return touch === undefined ? null : { x: touch.clientX, y: touch.clientY };
}

/**
 * The bounds a node occupies, as the store worked them out.
 *
 * Not `measured`, which is what the browser last laid out and is a frame behind
 * a card that has just been typed into, and not the stored size, which a card
 * does not have a height in. One answer, so a drop lands where the drawing says
 * it will.
 */
function boxOf(bounds: Record<string, Box>, node: PlanFlowNode): Box {
  return bounds[node.id] ?? { width: CARD.width, height: CARD.minHeight };
}
const edgeTypes: EdgeTypes = { plan: PlanEdgeLine };

/**
 * On a phone, fitting a thirty-node plan into 390px puts it at the zoom floor,
 * where a card is a smudge and the whole drawing reads as broken. Landing part
 * way in and panning is the lesser of the two: the floor here is what the
 * writing on a card stays legible at.
 */
const FIT_VIEW =
  typeof window !== 'undefined' && window.innerWidth < 768
    ? { padding: 0.15, maxZoom: 1, minZoom: 0.4 }
    : { padding: 0.25, maxZoom: 1 };

/**
 * Frames the whole plan while it is still arriving.
 *
 * React Flow's own `fitView` runs once, at init. The document comes over a
 * socket after that, so on anything large it framed whichever handful had
 * landed by then and left the rest off-screen — where, being culled, they were
 * never even drawn. So it is done again each time the plan gains or loses
 * nodes, and stopped the moment somebody moves the canvas themselves.
 *
 * Having moved one plan is not having moved the next. Opening another replaces
 * the document without the canvas ever unmounting — the old connection is
 * dropped and the new one set in the same render — so the memory of taking the
 * wheel has to be let go of explicitly, or the first plan you move in is the
 * last one that is ever framed for you.
 */
function useOpeningFit(doc: Y.Doc, count: number, taken: RefObject<boolean>): void {
  const { fitView } = useReactFlow();

  useEffect(() => {
    taken.current = false;
  }, [doc, taken]);

  useEffect(() => {
    if (taken.current || count === 0) return;
    // After the browser has laid the new nodes out, or their sizes are not
    // known yet and the frame is drawn around the wrong box.
    const at = requestAnimationFrame(() => {
      void fitView(FIT_VIEW);
    });
    return () => cancelAnimationFrame(at);
  }, [count, fitView, taken]);
}

export function PlanCanvas({
  connection,
  readOnly,
  onApplyOps,
  undo,
  onAddNode,
  onAddComment,
}: {
  connection: PlanConnection;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  /** Absent on a shared link, which has no document of its own to take back. */
  undo?: Undo;
  /** Asks for a name, and puts the node where it is told. */
  onAddNode?: (at: Position) => void;
  /** Leaves a note at a place, about a node when one was right-clicked. */
  onAddComment?: (at: Position, anchor: string | null) => void;
}) {
  const { store, doc } = connection.bound;
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const remoteDrag = useStore(store, (state) => state.remoteDrag);
  const onNodesChange = useStore(store, (state) => state.onNodesChange);
  const setEditable = useStore(store, (state) => state.setEditable);
  const onEdgesChange = useStore(store, (state) => state.onEdgesChange);
  const select = useStore(store, (state) => state.select);
  const absolute = useStore(store, (state) => state.absolute);
  const parentOf = useStore(store, (state) => state.parentOf);
  const bounds = useStore(store, (state) => state.bounds);
  const arm = useStore(store, (state) => state.arm);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const highlight = useStore(store, (state) => state.highlight);
  const selectComment = useStore(store, (state) => state.selectComment);
  const comments = useStore(store, (state) => state.comments);
  // Settled notes are out of the way by default and brought back on request:
  // a canvas that keeps every answered question on it stops being readable.
  const [resolvedShown, setResolvedShown] = useState(false);
  const settled = comments.filter((comment) => comment.resolved).length;
  useReadingWalk(store);
  // Set the first time the person moves the canvas or a node themselves.
  const taken = useRef(false);
  useOpeningFit(doc, nodes.length, taken);
  const grid = useGrid();
  // A line decides on its own whether to offer the handles that bend it, and
  // React Flow hands it nothing but its data, so the answer goes through the
  // store. It arrives here, with the socket.
  useEffect(() => {
    setEditable(!readOnly);
  }, [readOnly, setEditable]);

  const { fitView, screenToFlowPosition } = useReactFlow();
  // Where the menu was opened, so what it adds lands under the pointer rather
  // than wherever the viewport happens to be centred.
  const [pointer, setPointer] = useState<Position>({ x: 0, y: 0 });
  const [under, setUnder] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);

  /** Someone else's in-flight drag overrides the stored position for that node. */
  const rendered = useMemo(
    () =>
      Object.keys(remoteDrag).length === 0
        ? nodes
        : nodes.map((node) => {
            const ghost = remoteDrag[node.id];
            return ghost === undefined ? node : { ...node, position: ghost };
          }),
    [nodes, remoteDrag],
  );

  /**
   * The card the drag is currently resting on, and the wait that turns resting
   * into meaning it. Kept in a ref as well as in the store because the drop
   * has to read the answer without the canvas re-rendering every time it
   * changes.
   */
  const dwell = useRef<{
    over: string | null;
    /** Where the hand was when this wait began, in screen pixels. */
    pointer: Position;
    timer: ReturnType<typeof setTimeout> | undefined;
  }>({ over: null, pointer: { x: 0, y: 0 }, timer: undefined });
  const armed = useRef<string | null>(null);

  const disarm = useCallback(() => {
    clearTimeout(dwell.current.timer);
    dwell.current = { over: null, pointer: { x: 0, y: 0 }, timer: undefined };
    if (armed.current !== null) {
      armed.current = null;
      arm(null);
    }
  }, [arm]);

  useEffect(() => () => clearTimeout(dwell.current.timer), []);

  const handleDrag = useCallback(
    (event: MouseEvent | TouchEvent, node: PlanFlowNode) => {
      connection.publishDrag({ [node.id]: node.position });

      const parent = node.parentId === undefined ? null : absolute[node.parentId];
      const box = boxOf(bounds, node);
      const centre = {
        x: (parent?.x ?? 0) + node.position.x + box.width / 2,
        y: (parent?.y ?? 0) + node.position.y + box.height / 2,
      };

      // Only ordinary cards are waited on. A box is a box already.
      const over =
        nodes.find((candidate) => {
          if (candidate.id === node.id) return false;
          if (isGroup(candidate.data.node, candidate.data.childCount)) return false;
          const at = absolute[candidate.id];
          if (at === undefined) return false;
          const size = boxOf(bounds, candidate);
          return (
            centre.x >= at.x &&
            centre.x <= at.x + size.width &&
            centre.y >= at.y &&
            centre.y <= at.y + size.height
          );
        })?.id ?? null;

      // Measured from where the wait began rather than from the last event, so
      // a crossing made of many small steps still adds up to a crossing.
      const pointer = pointerOf(event);
      if (pointer === null) return;
      const travelled =
        Math.abs(pointer.x - dwell.current.pointer.x) +
        Math.abs(pointer.y - dwell.current.pointer.y);
      if (over === dwell.current.over && travelled < STILL_PX) return;

      clearTimeout(dwell.current.timer);
      if (armed.current !== null) {
        armed.current = null;
        arm(null);
      }
      dwell.current = {
        over,
        pointer,
        timer:
          over === null
            ? undefined
            : setTimeout(() => {
                armed.current = over;
                arm(over);
              }, ARM_MS),
      };
    },
    [absolute, arm, bounds, connection, nodes],
  );

  /**
   * Where a drag ends decides two things at once: where the node sits, and
   * which group it belongs to. Both are written here, once, at the end —
   * everything before this went over awareness and left no history.
   */
  const handleDragStop = useCallback(
    (_: unknown, node: PlanFlowNode) => {
      connection.publishDrag(null);

      const previous = absolute[node.id] ?? { x: 0, y: 0 };
      const parent = node.parentId === undefined ? null : absolute[node.parentId];
      const dropped = {
        x: (parent?.x ?? 0) + node.position.x,
        y: (parent?.y ?? 0) + node.position.y,
        ...boxOf(bounds, node),
      };

      // Snapped in absolute coordinates rather than left to React Flow, which
      // quantises the position relative to whatever a node sits in: a child of a
      // group that layout left off the grid would otherwise land on a lattice of
      // its own. Snapped before the drop is resolved, so that a node moved clear
      // of something it landed on is moved from a position already on the grid.
      const snapped = grid.on ? { ...dropped, ...snapTo(dropped, grid.step) } : dropped;

      // A group cannot be dropped into itself or into anything it holds.
      const forbidden = new Set<string>([node.id]);
      for (const [slug, holder] of Object.entries(parentOf)) {
        let cursor: string | undefined = holder;
        const seen = new Set<string>();
        while (cursor !== undefined && !seen.has(cursor)) {
          if (cursor === node.id) {
            forbidden.add(slug);
            break;
          }
          seen.add(cursor);
          cursor = parentOf[cursor];
        }
      }

      // Anything already drawn as a box takes a drop on sight. An ordinary
      // card takes one only when it has been held over long enough to light up,
      // which is the same answer the person was looking at when they let go.
      const held = armed.current;
      const targets: DropTarget[] = nodes
        .filter(
          (candidate) =>
            isGroup(candidate.data.node, candidate.data.childCount) || candidate.id === held,
        )
        .map((candidate) => ({
          slug: candidate.id,
          rect: { ...(absolute[candidate.id] ?? { x: 0, y: 0 }), ...boxOf(bounds, candidate) } as Rect,
          depth: Math.round(((candidate.zIndex ?? 0) as number) / 10),
        }));

      // Where a drop must not land. Only siblings count: a node keeps the
      // column it was aimed at and slides past what is under it.
      const occupants = new Map<string, Rect[]>();
      for (const candidate of nodes) {
        const holder = parentOf[candidate.id];
        if (holder === undefined || candidate.id === node.id) continue;
        const at = absolute[candidate.id];
        if (at === undefined) continue;
        const list = occupants.get(holder) ?? [];
        list.push({ ...at, ...boxOf(bounds, candidate) });
        occupants.set(holder, list);
      }

      const drop = resolveDrop(snapped, targets, forbidden, occupants);
      disarm();
      const was = parentOf[node.id] ?? null;

      if (drop.parent !== was) {
        const ops: PlanOp[] = [];
        if (was !== null) ops.push({ op: 'delete_edge', kind: 'contains', from: was, to: node.id });
        if (drop.parent !== null) {
          ops.push({
            op: 'upsert_edge',
            edge: normalizeEdge(
              planEdgeInputSchema.parse({ kind: 'contains', from: drop.parent, to: node.id }),
            ),
          });
        }
        onApplyOps(ops);
      }

      commitNodePosition(doc, node.id, drop.position, ORIGIN_LOCAL);

      // Dragging a group moves everything inside it, so their stored absolute
      // coordinates move with it. Without this the picture and the plan would
      // disagree the moment anybody else opened it.
      const shift = { x: drop.position.x - previous.x, y: drop.position.y - previous.y };
      const moved = new Map<string, Position>();
      if (shift.x !== 0 || shift.y !== 0) {
        for (const slug of descendantsOf(node.id, parentOf)) {
          const at = absolute[slug];
          if (at !== undefined) moved.set(slug, { x: at.x + shift.x, y: at.y + shift.y });
        }
      }

      // Everything placed along the lines these ends carry — the writing on them
      // and any bend somebody dragged them through — goes with them, or it is
      // left standing where the line used to run.
      if (shift.x !== 0 || shift.y !== 0) {
        const carried = new Map<string, Position>([[node.id, shift]]);
        for (const slug of descendantsOf(node.id, parentOf)) carried.set(slug, shift);
        nudgeEdges(doc, carried, ORIGIN_LOCAL);
      }
      if (moved.size > 0) commitLayout(doc, moved, ORIGIN_LOCAL);
    },
    [absolute, bounds, connection, disarm, doc, grid, nodes, onApplyOps, parentOf],
  );

  /**
   * A box drawn around what is selected — the other way to make a group, and
   * the one that does not need anything to be dropped on anything.
   */
  const selection = useMemo(() => nodes.filter((node) => node.selected === true), [nodes]);

  const groupSelection = (): void => {
    const result = groupOps(
      selection.map((node) => ({
        slug: node.id,
        rect: { ...(absolute[node.id] ?? { x: 0, y: 0 }), ...boxOf(bounds, node) },
      })),
      parentOf,
      nodes.map((node) => node.id),
    );
    if (result === null) return;
    onApplyOps(result.ops);
    select(result.slug);
  };

  const handleConnect = useCallback(
    (params: Connection) => {
      if (params.source === null || params.target === null) return;

      // A new line is always a flow, drawn the way it was dragged. What it
      // means is named afterwards, on the line itself: choosing between four
      // kinds before drawing anything asks the question at the moment the
      // person knows least about the answer.
      onApplyOps([
        {
          op: 'upsert_edge',
          edge: normalizeEdge(
            planEdgeInputSchema.parse({
              kind: 'flows_to',
              from: params.source,
              to: params.target,
            }),
          ),
        },
      ]);
    },
    [onApplyOps],
  );

  /**
   * Deleting from the keyboard, which React Flow raises for its own delete key.
   *
   * It also raises a `remove` change, and the store deliberately ignores that:
   * taking the thing off the screen without telling the document left the canvas
   * saying one thing and the plan saying another, and it came back the moment
   * anything else changed. So the removal is asked for here, the same way the
   * menu asks for it, and the screen waits to be told.
   */
  const removeNodes = (going: readonly { id: string }[]): void => {
    if (going.length === 0) return;
    onApplyOps(going.map((node) => ({ op: 'delete_node', slug: node.id }) as PlanOp));
  };

  const removeEdges = (going: readonly PlanFlowEdge[]): void => {
    const ops = going
      .map((candidate) => candidate.data?.edge)
      .filter((edge) => edge !== undefined)
      .map(
        (edge) =>
          ({
            op: 'delete_edge',
            kind: edge.kind,
            from: edge.from,
            to: edge.to,
            via: edge.via,
          }) as PlanOp,
      );
    if (ops.length > 0) onApplyOps(ops);
  };

  /**
   * Hands a card back to the standard width.
   *
   * Without this a card widened once is a card that can never be an ordinary
   * card again, and a plan slowly becomes a collage. Only a card is offered it:
   * a box has no size of its own to restore, being whatever it holds.
   */
  const under_ = under?.kind === 'node' ? nodes.find((c) => c.id === under.id) : undefined;
  const widenedUnder =
    under_ !== undefined && !isGroup(under_.data.node, under_.data.childCount)
      ? under_.data.node.size
      : null;

  const fitUnder = (): void => {
    if (under === null || under.kind !== 'node') return;
    onApplyOps([{ op: 'upsert_node', node: { slug: under.id, size: null } }]);
  };

  /**
   * Takes a node out of the box it is in.
   *
   * Dragging it far enough out does the same thing, and on a crowded canvas
   * "far enough out" can be a long way — past the box, past whatever is beside
   * it, without passing over a third box on the journey. This is the move said
   * plainly. The node is set down below the box it has left, where there is
   * room by construction, because leaving it where it was would put it inside
   * the boundary it no longer belongs to.
   */
  const holderOfUnder = under?.kind === 'node' ? (parentOf[under.id] ?? null) : null;

  const takeOutOfBox = (): void => {
    if (under === null || under.kind !== 'node' || holderOfUnder === null) return;
    const box = absolute[holderOfUnder];
    const size = nodes.find((candidate) => candidate.id === holderOfUnder);
    const at = absolute[under.id];
    onApplyOps([{ op: 'delete_edge', kind: 'contains', from: holderOfUnder, to: under.id }]);
    if (box === undefined || size === undefined || at === undefined) return;
    const below = { x: at.x, y: box.y + boxOf(bounds, size).height + 40 };
    commitNodePosition(doc, under.id, grid.on ? snapTo(below, grid.step) : below, ORIGIN_LOCAL);
  };

  const removeUnder = (): void => {
    if (under === null) return;
    if (under.kind === 'node') {
      onApplyOps([{ op: 'delete_node', slug: under.id }]);
      return;
    }
    const edge = edges.find((candidate) => candidate.id === under.id)?.data?.edge;
    if (edge !== undefined) {
      onApplyOps([
        { op: 'delete_edge', kind: edge.kind, from: edge.from, to: edge.to, via: edge.via },
      ]);
    }
  };

  const menu = (
    <>
      {readOnly || onAddNode === undefined ? null : (
        <>
          <ContextAction onSelect={() => onAddNode(pointer)}>
            <Plus className="size-3.5 text-ink-faint" />
            Add node here
          </ContextAction>
          {onAddComment === undefined ? null : (
            <ContextAction
              onSelect={() =>
                onAddComment(pointer, under?.kind === 'node' ? under.id : null)
              }
            >
              <MessageSquarePlus className="size-3.5 text-ink-faint" />
              {under?.kind === 'node' ? 'Leave a note on this node' : 'Leave a note here'}
            </ContextAction>
          )}
          {selection.length < 2 ? null : (
            <ContextAction onSelect={groupSelection}>
              <Group className="size-3.5 text-ink-faint" />
              Group {plural(selection.length, 'node')}
            </ContextAction>
          )}
          {holderOfUnder === null ? null : (
            <ContextAction onSelect={takeOutOfBox}>
              <Ungroup className="size-3.5 text-ink-faint" />
              Take out of {nodes.find((c) => c.id === holderOfUnder)?.data.node.title ?? 'the box'}
            </ContextAction>
          )}
          {widenedUnder === null ? null : (
            <ContextAction onSelect={fitUnder}>
              <Shrink className="size-3.5 text-ink-faint" />
              Use the standard width
            </ContextAction>
          )}
          {under === null ? null : (
            <ContextAction tone="danger" onSelect={removeUnder}>
              <Trash2 className="size-3.5" />
              {under.kind === 'node' ? 'Delete node' : 'Delete connection'}
            </ContextAction>
          )}
          <ContextSeparator />
        </>
      )}
      {undo === undefined ? null : (
        <>
          <ContextAction onSelect={undo.undo} disabled={!undo.canUndo} hint="⌘Z">
            <Undo2 className="size-3.5 text-ink-faint" />
            Undo
          </ContextAction>
          <ContextAction onSelect={undo.redo} disabled={!undo.canRedo} hint="⌘Y">
            <Redo2 className="size-3.5 text-ink-faint" />
            Redo
          </ContextAction>
          <ContextSeparator />
        </>
      )}
      <ContextAction onSelect={() => void fitView(FIT_VIEW)}>Fit the whole plan</ContextAction>
      <ContextAction onSelect={grid.toggle}>
        {grid.on ? 'Stop snapping to the grid' : 'Snap to the grid'}
      </ContextAction>
      {!grid.on ? null : (
        <ContextSub label="Grid spacing">
          <ContextChoice
            value={String(grid.step)}
            onChoose={(value) => grid.choose(Number(value) as GridStep)}
            options={GRID_STEPS.map((step) => ({
              value: String(step),
              label: `${step} px`,
            }))}
          />
        </ContextSub>
      )}
      {settled === 0 ? null : (
        <ContextAction onSelect={() => setResolvedShown((shown) => !shown)}>
          {resolvedShown
            ? `Hide ${plural(settled, 'resolved note')}`
            : `Show ${plural(settled, 'resolved note')}`}
        </ContextAction>
      )}
    </>
  );

  return (
    <PlanStoreProvider store={store}>
    <ContextMenu menu={menu}>
    {/* The pointer can leave the canvas without leaving anything on it —
        straight off the edge of the window, or onto a panel — and then no node
        ever hears that it was let go of. */}
    <div
      className="relative h-full w-full"
      onPointerMove={(event) =>
        connection.publishCursor(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
      }
      onPointerLeave={() => {
        highlight(null);
        // Leaving the canvas has to take the pointer off everyone else's screen
        // too, or it is left standing wherever it crossed the edge.
        connection.publishCursor(null);
      }}
    >
      <EdgeMarkers />
      <ReadingBanner store={store} />
      <ReactFlow
        nodes={rendered}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={readOnly ? undefined : removeNodes}
        onEdgesDelete={readOnly ? undefined : removeEdges}
        // React Flow quantises the drag itself, which is what makes a node feel
        // magnetic rather than merely end up tidy. It works on the position
        // relative to whatever a node sits in, so for a node at the top level —
        // almost all of them — it agrees exactly with the absolute snap at the
        // drop, and for one inside an off-grid group the drop corrects it by
        // less than half a step.
        snapToGrid={grid.on}
        snapGrid={[grid.step, grid.step]}
        onNodeDrag={readOnly ? undefined : handleDrag}
        onNodeDragStop={readOnly ? undefined : handleDragStop}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={(_, node) => select(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => {
          select(null);
          selectComment(null);
        }}
        // React Flow's own hover events rather than a handler on every node:
        // one subscription instead of several hundred.
        onNodeMouseEnter={(_, node) => highlight(node.id, 'node')}
        onNodeMouseLeave={() => highlight(null)}
        onEdgeMouseEnter={(_, edge) => highlight(edge.id, 'edge')}
        onEdgeMouseLeave={() => highlight(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        // Culls off-screen nodes. A plan of a few hundred nodes is ordinary.
        onlyRenderVisibleElements
        elevateNodesOnSelect={false}
        // React Flow is MIT, so the badge is a request rather than a condition.
        // The canvas is the product's own surface and carries its own name.
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={FIT_VIEW}
        // A person moving the canvas is taking the wheel; nothing frames it for
        // them after that. React Flow passes no event for its own moves, which
        // is how a fit is told apart from a drag.
        onMoveStart={(event) => {
          if (event !== null) taken.current = true;
        }}
        onNodeDragStart={() => {
          taken.current = true;
        }}
        onPaneContextMenu={(event) => {
          setUnder(null);
          setPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
        onNodeContextMenu={(event, node) => {
          setUnder({ kind: 'node', id: node.id });
          setPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
        onEdgeContextMenu={(event, edge) => {
          setUnder({ kind: 'edge', id: edge.id });
          setPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
      >
        {/* A drafting grid: a fine division inside a coarse one. The fine one is
            the step a drag lands on, so the lines are where the nodes go. */}
        {!grid.on ? null : (
          <>
            <Background
              id="fine"
              variant={BackgroundVariant.Lines}
              gap={grid.step}
              lineWidth={1}
              color="var(--grid-fine)"
            />
            <Background
              id="coarse"
              variant={BackgroundVariant.Lines}
              gap={grid.step * COARSE_MULTIPLE}
              lineWidth={1}
              color="var(--grid-coarse)"
            />
          </>
        )}
        <PlanComments
          store={store}
          doc={doc}
          readOnly={readOnly}
          showResolved={resolvedShown}
          snap={grid.on ? grid.step : null}
          onSelect={selectComment}
        />
        <PeerCursors store={store} />
        <Controls
          showInteractive={false}
          className="!border !border-rule !bg-surface !shadow-none [&_button]:!border-rule [&_button]:!bg-surface [&_button]:!fill-ink-muted hover:[&_button]:!bg-surface-2"
        >
          {/* The grid is a drafting aid and belongs with the other two, which are
              also about looking rather than about the plan. Which step it uses
              stays in the menu: this is the switch, not the settings. */}
          <ControlButton
            onClick={grid.toggle}
            title={grid.on ? `Snapping to a ${grid.step}px grid` : 'Not snapping to the grid'}
            aria-label={grid.on ? 'Stop snapping to the grid' : 'Snap to the grid'}
            aria-pressed={grid.on}
          >
            <Grid2x2 className={grid.on ? '!fill-none stroke-accent' : '!fill-none stroke-ink-muted'} />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
    </ContextMenu>
    </PlanStoreProvider>
  );
}

/** Everything held by a node, at any depth. */
function descendantsOf(slug: string, parentOf: Record<string, string>): string[] {
  const held: string[] = [];
  const stack = [slug];
  const seen = new Set<string>([slug]);
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const [child, parent] of Object.entries(parentOf)) {
      if (parent !== current || seen.has(child)) continue;
      seen.add(child);
      held.push(child);
      stack.push(child);
    }
  }
  return held;
}

/**
 * Who is walking the plan, while they are.
 *
 * Without it the drawing lights up on its own and reads as a fault. It says
 * what is happening and gets out of the way — no control, nothing to dismiss,
 * gone when the walk is.
 */
function ReadingBanner({ store }: { store: PlanStore['store'] }) {
  const reading = useStore(store, (state) => state.reading);
  if (reading === null) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <span className="flex items-center gap-2 rounded-md border border-collab/40 bg-surface-3 px-2.5 py-1 text-xs text-ink elevated">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-collab" />
        {reading.by} is reading from {reading.from}
      </span>
    </div>
  );
}
