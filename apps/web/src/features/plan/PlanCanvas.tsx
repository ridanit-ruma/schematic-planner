import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  type Connection,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  useReactFlow,
  useStore as useFlowStore,
} from '@xyflow/react';
import {
  CARD,
  isGroup,
  normalizeEdge,
  planEdgeInputSchema,
  type Box,
  type PlanOp,
  type Position,
  type Vocabulary,
} from '@schematic/schema';
import {
  ORIGIN_LOCAL,
  commitLayout,
  commitNodePosition,
  nudgeEdges,
  readPlanDoc,
} from '@schematic/ydoc';
import {
  AlignHorizontalSpaceAround,
  Copy,
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
import { useT } from '@/i18n';
import { placeBlock, type Guide } from './align';
import {
  adoptWords,
  clipboardForms,
  copyPayload,
  middleClickGuard,
  pasteOps,
  readClipboard,
  type ClipboardPayload,
} from './clipboard';
import { GapHandles, GapMarkers } from './GapHandles';
import { resolveDrop, type DropTarget, type Rect } from './group-drop';
import { groupOps } from './make-group';
import { carry, descendantsOf, dropSelection, type Moves } from './move-selection';
import { evenRow, tidyUp, type GapMarker } from './spacing';
import { TitleEditorProvider, useNodeDraft } from './title-editing';
import type { PlanStore } from './plan-store';
import { PlanStoreProvider } from './store-context';
import { useReadingWalk } from './use-reading-walk';
import { EdgeMarkers, PlanEdgeLine } from './PlanEdgeLine';
import { PeerCursors } from './PeerCursors';
import { PlanComments } from './PlanComments';
import { PlanNodeCard } from './PlanNodeCard';
import type { PlanConnection } from './use-plan-document';
import type { PlanFlowEdge, PlanFlowNode } from './types';
import { COARSE_MULTIPLE, GRID_ANCHORS, GRID_STEPS, type GridAnchor, type GridStep, snapTo } from './snap';
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

/** How close, in screen pixels, a dragged node's edge or middle has to come to a neighbour's to line up with it. */
const GUIDE_PX = 6;

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

/** What the page around the canvas can ask of it. */
export interface PlanCanvasHandle {
  /** Makes a node in the middle of the view and opens its title for typing. */
  addNode: () => void;
}

/** How far a paste or a duplicate lands from what it copied, when there is no pointer to put it at. */
const PASTE_OFFSET = 20;

export function PlanCanvas({
  connection,
  readOnly,
  onApplyOps,
  undo,
  onAddComment,
  handle,
  words,
  onError,
}: {
  connection: PlanConnection;
  readOnly: boolean;
  onApplyOps: (ops: PlanOp[]) => void;
  /** Absent on a shared link, which has no document of its own to take back. */
  undo?: Undo;
  /** Leaves a note at a place, about a node when one was right-clicked. */
  onAddComment?: (at: Position, anchor: string | null) => void;
  /** Filled in with what the page can ask of the canvas. */
  handle?: RefObject<PlanCanvasHandle | null>;
  /**
   * Whether this person may change the project's vocabulary, and how. A paste
   * from another project adds the kinds, statuses and tags this one lacks, and
   * waits for them to have loaded.
   */
  words?: {
    loaded: boolean;
    canEdit: boolean;
    /** Resolves to whether the edit was saved. */
    edit: (edit: (vocabulary: Vocabulary) => Vocabulary) => Promise<boolean>;
  };
  /** Something the person asked for that could not be done. */
  onError?: (error: unknown) => void;
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
  const t = useT();

  /**
   * The height the grid holds a node by, which only a card has.
   *
   * The `terminal` anchor lines up where the wires leave a node, and on a card
   * that is the vertical middle of a fixed box. A box drawn round other nodes
   * has neither: its size is read back off whatever is inside it and changes
   * every time a child moves, so holding it by a middle that moves is holding
   * it by nothing. Passing zero leaves a box on the outer edge under either
   * setting, which is also the only way its children stay put relative to it.
   */
  const anchorHeight = useCallback(
    (node: PlanFlowNode | undefined): number =>
      node === undefined || isGroup(node.data.node, node.data.childCount)
        ? 0
        : boxOf(bounds, node).height,
    [bounds],
  );
  // A line decides on its own whether to offer the handles that bend it, and
  // React Flow hands it nothing but its data, so the answer goes through the
  // store. It arrives here, with the socket.
  useEffect(() => {
    setEditable(!readOnly);
  }, [readOnly, setEditable]);

  const { fitView, getZoom, screenToFlowPosition } = useReactFlow();

  /** Where a node is drawn, absolute, at the size it is drawn at. */
  const rectOf = useCallback(
    (node: PlanFlowNode): Rect => ({
      ...(absolute[node.id] ?? { x: 0, y: 0 }),
      ...boxOf(bounds, node),
    }),
    [absolute, bounds],
  );

  /**
   * Where a dragged block goes, the same answer while it moves and when it
   * lands. Its neighbours are everything that is not moving with it.
   */
  const placeMoving = useCallback(
    (leader: PlanFlowNode, leaderRect: Rect, block: Rect, moving: ReadonlySet<string>) => {
      const others: Rect[] = [];
      for (const candidate of nodes) {
        if (moving.has(candidate.id) || absolute[candidate.id] === undefined) continue;
        others.push(rectOf(candidate));
      }
      return placeBlock(
        leaderRect,
        block,
        others,
        grid.on ? { step: grid.step, anchor: grid.anchor } : null,
        GUIDE_PX / getZoom(),
        anchorHeight(leader),
      );
    },
    [absolute, anchorHeight, getZoom, grid, nodes, rectOf],
  );

  /*
   * The nodes being dragged, and the lines and gaps they have found.
   *
   * React Flow reports a drag as position changes, and they are placed here on
   * their way into the store, so the nodes are drawn where they will land
   * rather than corrected after they are let go. Everything moving is placed as
   * one block and shifted by the same amount, so a dragged selection keeps its
   * shape.
   */
  const lead = useRef<string | null>(null);
  /** Whether this drag leaves the originals where they are and drops copies. Read as it starts. */
  const copying = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [gaps, setGaps] = useState<GapMarker[]>([]);
  /** What was already selected when a Shift+box began; the box adds to it. */
  const keptSelection = useRef<ReadonlySet<string> | null>(null);

  /**
   * Where a set of dragged nodes lands, as one block led by the node under the
   * hand. React Flow's positions are relative to the box a node is in, so they
   * are made absolute first.
   */
  const placeDragged = useCallback(
    (moved: readonly { id: string; position: Position }[], leaderId: string | null) => {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const rects = new Map<string, Rect>();
      const moving = new Set<string>();
      for (const { id, position } of moved) {
        const node = byId.get(id);
        if (node === undefined) continue;
        const parent = node.parentId === undefined ? undefined : absolute[node.parentId];
        rects.set(id, {
          x: (parent?.x ?? 0) + position.x,
          y: (parent?.y ?? 0) + position.y,
          ...boxOf(bounds, node),
        });
        moving.add(id);
        for (const slug of descendantsOf(id, parentOf)) moving.add(slug);
      }
      const leading = leaderId !== null && rects.has(leaderId) ? leaderId : [...rects.keys()][0];
      if (leading === undefined) return null;
      const placed = placeMoving(
        byId.get(leading) as PlanFlowNode,
        rects.get(leading) as Rect,
        union([...rects.values()]),
        moving,
      );
      return { rects, moving, ...placed };
    },
    [absolute, bounds, nodes, parentOf, placeMoving],
  );

  const handleNodesChange = useCallback(
    (incoming: NodeChange<PlanFlowNode>[]) => {
      // React Flow's box replaces the selection. Under Shift it adds to it, so
      // what was selected before is held on to here. Answered as a selection
      // rather than dropped: the box has already marked those nodes unselected
      // inside React Flow, and only a changed node is read back from here.
      const kept = keptSelection.current;
      const changes =
        kept === null
          ? incoming
          : incoming.map((change) =>
              change.type === 'select' && !change.selected && kept.has(change.id)
                ? { ...change, selected: true }
                : change,
            );
      const moved =
        lead.current === null
          ? []
          : changes.flatMap((change) =>
              change.type === 'position' && change.position !== undefined
                ? [{ id: change.id, position: change.position }]
                : [],
            );
      const placed = moved.length === 0 ? null : placeDragged(moved, lead.current);
      if (placed === null) {
        onNodesChange(changes);
        return;
      }
      setGuides(placed.guides);
      setGaps(placed.gaps);
      // Everyone else sees every dragged node move, where it is drawn here.
      // A copy being dragged out is not a move: for them the originals stay.
      if (!copying.current) {
        const ghosts: Record<string, Position> = {};
        for (const [slug, rect] of placed.rects) {
          ghosts[slug] = { x: rect.x + placed.dx, y: rect.y + placed.dy };
        }
        connection.publishDrag(ghosts);
      }
      onNodesChange(
        changes.map((change) =>
          change.type === 'position' && change.position !== undefined
            ? {
                ...change,
                position: { x: change.position.x + placed.dx, y: change.position.y + placed.dy },
              }
            : change,
        ),
      );
    },
    [connection, onNodesChange, placeDragged],
  );
  // Where the menu was opened, so what it adds lands under the pointer rather
  // than wherever the viewport happens to be centred.
  const [pointer, setPointer] = useState<Position>({ x: 0, y: 0 });
  const [under, setUnder] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);

  /**
   * Someone else's in-flight drag overrides the stored position for that node.
   * It arrives absolute and is drawn relative to whatever box holds the node.
   */
  const rendered = useMemo(
    () =>
      Object.keys(remoteDrag).length === 0
        ? nodes
        : nodes.map((node) => {
            const ghost = remoteDrag[node.id];
            if (ghost === undefined) return node;
            const parent = node.parentId === undefined ? undefined : absolute[node.parentId];
            return {
              ...node,
              position: { x: ghost.x - (parent?.x ?? 0), y: ghost.y - (parent?.y ?? 0) },
            };
          }),
    [absolute, nodes, remoteDrag],
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
    [absolute, arm, bounds, nodes],
  );

  /**
   * Writes a move: the boxes nodes left and joined, where every moved node and
   * everything it holds now is, and the writing on the lines they carry — in
   * one transaction, so it is one step to take back and arrives on everyone
   * else's screen at once.
   */
  const commitMoves = useCallback(
    (moves: Moves): void => {
      const ops: PlanOp[] = [];
      for (const change of moves.membership) {
        if (change.from !== null) {
          ops.push({ op: 'delete_edge', kind: 'contains', from: change.from, to: change.slug });
        }
        if (change.to !== null) ops.push(containsOp(change.to, change.slug));
      }
      doc.transact(() => {
        if (ops.length > 0) onApplyOps(ops);
        const placed = new Set(moves.placed);
        for (const slug of moves.placed) {
          const at = moves.positions.get(slug);
          if (at !== undefined) commitNodePosition(doc, slug, at, ORIGIN_LOCAL);
        }
        const carried = new Map([...moves.positions].filter(([slug]) => !placed.has(slug)));
        if (carried.size > 0) commitLayout(doc, carried, ORIGIN_LOCAL);
        // Everything placed along the lines these ends carry — the writing on
        // them — goes with them, or it is left standing where the line used to run.
        nudgeEdges(
          doc,
          new Map([...moves.shifts].filter(([, shift]) => shift.x !== 0 || shift.y !== 0)),
          ORIGIN_LOCAL,
        );
      }, ORIGIN_LOCAL);
    },
    [doc, onApplyOps],
  );

  /**
   * The boxes a drop can land in. Anything already drawn as a box takes a drop
   * on sight. An ordinary card takes one only when it has been held over long
   * enough to light up, which is the same answer the person was looking at
   * when they let go.
   */
  const dropTargets = useCallback((): DropTarget[] => {
    const held = armed.current;
    return nodes
      .filter(
        (candidate) =>
          isGroup(candidate.data.node, candidate.data.childCount) || candidate.id === held,
      )
      .map((candidate) => ({
        slug: candidate.id,
        rect: rectOf(candidate),
        depth: Math.round(((candidate.zIndex ?? 0) as number) / 10),
      }));
  }, [nodes, rectOf]);

  /** Puts pasted nodes in the plan as one step, and makes them the selection. */
  const addCopies = useCallback(
    (ops: PlanOp[], slugs: readonly string[]): void => {
      const manager = undo?.manager ?? null;
      manager?.stopCapturing();
      onApplyOps(ops);
      manager?.stopCapturing();
      const chosen = new Set(slugs);
      onNodesChange(
        store
          .getState()
          .nodes.map((node) => ({ type: 'select', id: node.id, selected: chosen.has(node.id) })),
      );
      select(null);
    },
    [onApplyOps, onNodesChange, select, store, undo],
  );

  /**
   * Where a drag ends decides two things at once: where the nodes sit, and
   * which box each belongs to. Both are written here, once, at the end —
   * everything before this went over awareness and left no history.
   *
   * Every dragged node, not only the one under the hand: a selection moved
   * together is written together, or the rest of it springs back to where the
   * document last had it. With Alt held from the start, the originals stay and
   * copies land where the drag ended.
   */
  const handleDragStop = useCallback(
    (_: unknown, node: PlanFlowNode, dragged: PlanFlowNode[]) => {
      connection.publishDrag(null);
      const copy = copying.current;
      copying.current = false;
      setDragging(false);

      // Placed in absolute coordinates, by the same rule the drag was drawn
      // with, so it lands where it was shown. Placed before the drop is
      // resolved, so that a node moved clear of something it landed on is moved
      // from a position already on the grid.
      const placed = placeDragged(
        (dragged.length > 0 ? dragged : [node]).map((each) => ({
          id: each.id,
          position: each.position,
        })),
        node.id,
      );
      lead.current = null;
      setGuides([]);
      setGaps([]);
      const targets = dropTargets();
      disarm();
      if (placed === null) return;

      const dropped = [...placed.rects].map(([slug, rect]) => ({
        slug,
        rect: { ...rect, x: rect.x + placed.dx, y: rect.y + placed.dy },
      }));

      if (!copy) {
        const rects: Record<string, Rect> = {};
        for (const candidate of nodes) rects[candidate.id] = rectOf(candidate);
        commitMoves(dropSelection(dropped, { absolute, parentOf, rects, targets }));
        return;
      }

      // The copies are made from the document, where the originals still are,
      // and moved by as much as the drag moved the block.
      const first = dropped[0];
      const was = first === undefined ? undefined : absolute[first.slug];
      const payload = copyPayload(
        readPlanDoc(doc).doc,
        dropped.map((each) => each.slug),
        absolute,
      );
      if (first !== undefined && was !== undefined && payload !== null) {
        const pasted = pasteOps(
          payload,
          nodes.map((each) => each.id),
          { offset: { x: first.rect.x - was.x, y: first.rect.y - was.y } },
        );
        const ops = [...pasted.ops];
        // A copy nothing else copied holds joins the box it was let go over,
        // as a new node would. Not the original it came from, which it is
        // usually lying on top of.
        for (const { slug, rect } of dropped) {
          const made = pasted.renamed.get(slug);
          if (made === undefined || !pasted.roots.includes(made)) continue;
          const drop = resolveDrop(rect, targets, placed.moving);
          if (drop.parent !== null) ops.push(containsOp(drop.parent, made));
        }
        addCopies(ops, pasted.slugs);
      }
      // The originals were dragged on this screen only; the document still has
      // them where they were.
      connection.bound.refresh();
    },
    [
      absolute,
      addCopies,
      commitMoves,
      connection,
      disarm,
      doc,
      dropTargets,
      nodes,
      parentOf,
      placeDragged,
      rectOf,
    ],
  );

  /** The deepest box under a point, which a node made there is made inside. */
  const holderAt = useCallback(
    (point: Position): string | null => {
      let best: { slug: string; depth: number; area: number } | null = null;
      for (const candidate of nodes) {
        if (!isGroup(candidate.data.node, candidate.data.childCount)) continue;
        const rect = rectOf(candidate);
        if (
          point.x < rect.x ||
          point.y < rect.y ||
          point.x > rect.x + rect.width ||
          point.y > rect.y + rect.height
        ) {
          continue;
        }
        const depth = Math.round(((candidate.zIndex ?? 0) as number) / 10);
        const area = rect.width * rect.height;
        if (best === null || depth > best.depth || (depth === best.depth && area < best.area)) {
          best = { slug: candidate.id, depth, area };
        }
      }
      return best?.slug ?? null;
    },
    [nodes, rectOf],
  );

  const draft = useNodeDraft({
    doc,
    apply: onApplyOps,
    undo,
    slugs: () => store.getState().nodes.map((each) => each.id),
  });

  /**
   * A new, empty node at a point, opened for its title.
   *
   * Out of a terminal, the new node's own left terminal lands on the point,
   * so the line drawn to get there arrives straight. Asked for from a menu or
   * the title block, the card is centred on it. On the grid either way.
   */
  const createAt = useCallback(
    (at: Position, options: { from?: string; anchor: 'terminal' | 'centre'; pinned: boolean }) => {
      const box = { width: CARD.width, height: CARD.minHeight };
      const corner =
        options.anchor === 'terminal'
          ? { x: at.x, y: at.y - box.height / 2 }
          : { x: at.x - box.width / 2, y: at.y - box.height / 2 };
      draft.create({
        position: grid.on ? snapTo(corner, grid.step, grid.anchor, box.height) : corner,
        holder: holderAt(at),
        pinned: options.pinned,
        ...(options.from === undefined ? {} : { from: options.from }),
      });
    },
    [draft, grid, holderAt],
  );

  /**
   * A line let go of over empty canvas makes the node it was reaching for.
   *
   * Only out of an outgoing terminal and only onto the canvas itself: a line
   * dropped on a node or a terminal is a connection, which `onConnect` makes,
   * and one dropped on a note or a panel was not aimed at the drawing.
   */
  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      if (state.isValid === true || state.toNode !== null || state.fromNode === null) return;
      if (state.fromHandle?.type !== 'source') return;
      const point = pointerOf(event);
      if (point === null) return;
      // Where the hand is, not where the gesture began: a touch reports the
      // element it started on.
      const landed = document.elementFromPoint(point.x, point.y);
      if (landed === null) return;
      // The open canvas, or the open floor of a box: a box takes the pointer
      // across its whole area, and letting go inside one makes the node in it.
      const box = landed.closest('.react-flow__node')?.getAttribute('data-id');
      const floor =
        box != null &&
        landed.closest('.react-flow__handle') === null &&
        nodes.some(
          (candidate) =>
            candidate.id === box && isGroup(candidate.data.node, candidate.data.childCount),
        );
      if (!landed.classList.contains('react-flow__pane') && !floor) return;
      createAt(screenToFlowPosition(point), {
        from: state.fromNode.id,
        anchor: 'terminal',
        pinned: true,
      });
    },
    [createAt, nodes, screenToFlowPosition],
  );

  const wrapper = useRef<HTMLDivElement | null>(null);
  /** Where the pointer is over the canvas, in plan coordinates; null when it is elsewhere. */
  const hover = useRef<Position | null>(null);

  useEffect(() => {
    if (handle === undefined) return;
    handle.current = {
      addNode: () => {
        const box = wrapper.current?.getBoundingClientRect();
        const centre = screenToFlowPosition(
          box === undefined
            ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
            : { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        );
        // Left unpinned, as Add node always has, so Arrange is still free to
        // tidy it into the graph.
        createAt(centre, { anchor: 'centre', pinned: false });
      },
    };
    return () => {
      handle.current = null;
    };
  }, [createAt, handle, screenToFlowPosition]);

  /*
   * Copy, cut, paste and duplicate.
   *
   * The clipboard events rather than the keys: they carry the system clipboard
   * with them, so a copy made in one plan pastes into another, in another tab
   * or another browser, without asking for permission to read it. They are
   * the canvas's only while nothing else has the keyboard — a field, or text
   * somebody has selected to copy.
   */
  const clipboardActions = useRef({
    copy: (): ClipboardPayload | null => null,
    remove: (_slugs: readonly string[]): void => undefined,
    paste: (_payload: ClipboardPayload, _where: 'pointer' | 'offset'): void => undefined,
  });
  clipboardActions.current = {
    copy: () => {
      const state = store.getState();
      const chosen = state.nodes.filter((each) => each.selected === true).map((each) => each.id);
      if (chosen.length === 0) return null;
      return copyPayload(readPlanDoc(doc).doc, chosen, state.absolute, state.vocabulary);
    },
    remove: (slugs) => {
      if (slugs.length === 0) return;
      undo?.manager?.stopCapturing();
      onApplyOps(slugs.map((slug) => ({ op: 'delete_node', slug }) as PlanOp));
      undo?.manager?.stopCapturing();
    },
    paste: (payload, where) => {
      // The defaults stand in until the project's words arrive; adapting to
      // them would quietly turn its own statuses and kinds into the defaults.
      if (words !== undefined && !words.loaded) {
        onError?.(new Error(t.canvas.canvas.paste.notLoaded));
        return;
      }
      const at = where === 'pointer' ? hover.current : null;
      const pointerHolder = at === null ? null : holderAt(at);
      const adoption = adoptWords(payload, store.getState().vocabulary, words?.canEdit === true);
      const place = (): void => {
        const pasted = pasteOps(
          payload,
          store.getState().nodes.map((each) => each.id),
          at === null
            ? { offset: { x: PASTE_OFFSET, y: PASTE_OFFSET } }
            : { at: grid.on ? snapTo(at, grid.step) : at },
          adoption,
        );
        const ops = [...pasted.ops];
        if (at === null) {
          // Beside the originals, in the plan they came from: in the same box.
          const present = new Set(store.getState().nodes.map((each) => each.id));
          if (payload.plan === readPlanDoc(doc).doc.id) {
            for (const [slug, holder] of Object.entries(payload.holders)) {
              const made = pasted.renamed.get(slug);
              if (made !== undefined && present.has(holder)) ops.push(containsOp(holder, made));
            }
          }
        } else if (pointerHolder !== null) {
          // At the pointer: in whatever box the pointer is in.
          for (const made of pasted.roots) ops.push(containsOp(pointerHolder, made));
        }
        addCopies(ops, pasted.slugs);
      };
      if (adoption.add === null || words === undefined) {
        place();
        return;
      }
      // The copies use the statuses and kinds being added, so they wait until
      // those are saved; a refused save leaves nothing pointing at them.
      void words.edit(adoption.add).then((saved) => {
        if (saved) place();
        else onError?.(new Error(t.canvas.canvas.paste.wordsRefused));
      });
    },
  };

  useEffect(() => {
    const ours = (event: Event): boolean => {
      if (isEditingText(event.target)) return false;
      const active = document.activeElement;
      return (
        active === null ||
        active === document.body ||
        (wrapper.current?.contains(active) ?? false)
      );
    };
    const selectingText = (): boolean => {
      const selected = window.getSelection();
      return selected !== null && !selected.isCollapsed && selected.toString() !== '';
    };
    const put = (event: ClipboardEvent): ClipboardPayload | null => {
      if (event.clipboardData === null || !ours(event) || selectingText()) return null;
      const payload = clipboardActions.current.copy();
      if (payload === null) return null;
      for (const [type, value] of Object.entries(clipboardForms(payload))) {
        event.clipboardData.setData(type, value);
      }
      event.preventDefault();
      return payload;
    };
    const onCopy = (event: ClipboardEvent): void => {
      put(event);
    };
    const onCut = (event: ClipboardEvent): void => {
      if (readOnly) return;
      const payload = put(event);
      if (payload !== null) clipboardActions.current.remove(payload.nodes.map((each) => each.slug));
    };
    const middle = middleClickGuard();
    const onButton = (event: MouseEvent): void => middle.note(event);
    const onPaste = (event: ClipboardEvent): void => {
      if (readOnly || event.clipboardData === null || !ours(event)) return;
      if (middle.pasting(event.timeStamp)) return;
      const data = event.clipboardData;
      const payload = readClipboard((type) => data.getData(type));
      if (payload === null) return;
      event.preventDefault();
      clipboardActions.current.paste(payload, 'pointer');
    };
    // Duplicate has no clipboard event of its own, and the browser would
    // bookmark the page.
    const onKey = (event: KeyboardEvent): void => {
      if (readOnly || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'd' || !ours(event)) return;
      const payload = clipboardActions.current.copy();
      if (payload === null) return;
      event.preventDefault();
      clipboardActions.current.paste(payload, 'offset');
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    // Captured, so a node or the pane stopping the press cannot hide it.
    window.addEventListener('mousedown', onButton, true);
    window.addEventListener('mouseup', onButton, true);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onButton, true);
      window.removeEventListener('mouseup', onButton, true);
    };
  }, [readOnly]);

  /**
   * A box drawn around what is selected — the other way to make a group, and
   * the one that does not need anything to be dropped on anything.
   */
  const selection = useMemo(() => nodes.filter((node) => node.selected === true), [nodes]);

  /**
   * The selected nodes that move on their own. One inside a selected box moves
   * with the box, so spacing it separately would pull it out of its place in it.
   */
  const members = useMemo(() => {
    const chosen = new Set(selection.map((node) => node.id));
    return selection
      .filter((node) => {
        let parent = parentOf[node.id];
        for (let depth = 0; parent !== undefined && depth < 20; depth += 1) {
          if (chosen.has(parent)) return false;
          parent = parentOf[parent];
        }
        return true;
      })
      .map((node) => ({ slug: node.id, rect: rectOf(node) }));
  }, [parentOf, rectOf, selection]);
  const evenlySpaced = useMemo(
    () => evenRow(members.map((member) => member.rect)) !== null,
    [members],
  );

  /** Spaces an uneven selection evenly along its longer axis, at its mean gap. */
  const tidySelection = (): void => {
    const tidied = tidyUp(members.map((member) => member.rect));
    if (tidied === null) return;
    commitMoves(
      carry(
        new Map(members.map((member, index) => [member.slug, tidied.positions[index] as Position])),
        absolute,
        parentOf,
      ),
    );
  };

  /** A gap being dragged: drawn on this screen only, until it is let go. */
  const previewSpacing = (positions: ReadonlyMap<string, Position> | null): void => {
    if (positions === null) {
      connection.bound.refresh();
      return;
    }
    const byId = new Map(nodes.map((node) => [node.id, node]));
    onNodesChange(
      [...positions].map(([slug, at]) => {
        const holder = byId.get(slug)?.parentId;
        const parent = holder === undefined ? undefined : absolute[holder];
        return {
          type: 'position' as const,
          id: slug,
          position: { x: at.x - (parent?.x ?? 0), y: at.y - (parent?.y ?? 0) },
        };
      }),
    );
  };

  const duplicateSelection = (): void => {
    const payload = clipboardActions.current.copy();
    if (payload !== null) clipboardActions.current.paste(payload, 'offset');
  };

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
  const holderTitle = nodes.find((c) => c.id === holderOfUnder)?.data.node.title;

  const takeOutOfBox = (): void => {
    if (under === null || under.kind !== 'node' || holderOfUnder === null) return;
    const box = absolute[holderOfUnder];
    const size = nodes.find((candidate) => candidate.id === holderOfUnder);
    const at = absolute[under.id];
    onApplyOps([{ op: 'delete_edge', kind: 'contains', from: holderOfUnder, to: under.id }]);
    if (box === undefined || size === undefined || at === undefined) return;
    const below = { x: at.x, y: box.y + boxOf(bounds, size).height + 40 };
    const moving = nodes.find((candidate) => candidate.id === under.id);
    commitNodePosition(
      doc,
      under.id,
      grid.on ? snapTo(below, grid.step, grid.anchor, anchorHeight(moving)) : below,
      ORIGIN_LOCAL,
    );
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
      {readOnly ? null : (
        <>
          <ContextAction
            onSelect={() => createAt(pointer, { anchor: 'centre', pinned: false })}
          >
            <Plus className="size-3.5 text-ink-faint" />
            {t.canvas.canvas.menu.addNode}
          </ContextAction>
          {onAddComment === undefined ? null : (
            <ContextAction
              onSelect={() =>
                onAddComment(pointer, under?.kind === 'node' ? under.id : null)
              }
            >
              <MessageSquarePlus className="size-3.5 text-ink-faint" />
              {under?.kind === 'node'
                ? t.canvas.canvas.menu.noteOnNode
                : t.canvas.canvas.menu.noteHere}
            </ContextAction>
          )}
          {selection.length < 2 ? null : (
            <ContextAction onSelect={groupSelection}>
              <Group className="size-3.5 text-ink-faint" />
              {t.canvas.canvas.menu.groupNodes(selection.length)}
            </ContextAction>
          )}
          {members.length < 2 || evenlySpaced ? null : (
            <ContextAction onSelect={tidySelection}>
              <AlignHorizontalSpaceAround className="size-3.5 text-ink-faint" />
              {t.canvas.canvas.menu.tidyUp}
            </ContextAction>
          )}
          {selection.length === 0 ? null : (
            <ContextAction onSelect={duplicateSelection} hint="⌘D">
              <Copy className="size-3.5 text-ink-faint" />
              {t.canvas.canvas.menu.duplicate}
            </ContextAction>
          )}
          {holderOfUnder === null ? null : (
            <ContextAction onSelect={takeOutOfBox}>
              <Ungroup className="size-3.5 text-ink-faint" />
              {holderTitle === undefined
                ? t.canvas.canvas.menu.takeOutOfBox
                : t.canvas.canvas.menu.takeOutOf(holderTitle)}
            </ContextAction>
          )}
          {widenedUnder === null ? null : (
            <ContextAction onSelect={fitUnder}>
              <Shrink className="size-3.5 text-ink-faint" />
              {t.canvas.canvas.menu.standardWidth}
            </ContextAction>
          )}
          {under === null ? null : (
            <ContextAction tone="danger" onSelect={removeUnder}>
              <Trash2 className="size-3.5" />
              {under.kind === 'node'
                ? t.canvas.canvas.menu.deleteNode
                : t.canvas.canvas.menu.deleteConnection}
            </ContextAction>
          )}
          <ContextSeparator />
        </>
      )}
      {undo === undefined ? null : (
        <>
          <ContextAction onSelect={undo.undo} disabled={!undo.canUndo} hint="⌘Z">
            <Undo2 className="size-3.5 text-ink-faint" />
            {t.canvas.canvas.menu.undo}
          </ContextAction>
          <ContextAction onSelect={undo.redo} disabled={!undo.canRedo} hint="⌘Y">
            <Redo2 className="size-3.5 text-ink-faint" />
            {t.canvas.canvas.menu.redo}
          </ContextAction>
          <ContextSeparator />
        </>
      )}
      <ContextAction onSelect={() => void fitView(FIT_VIEW)}>
        {t.canvas.canvas.menu.fitPlan}
      </ContextAction>
      <ContextAction onSelect={grid.toggle}>
        {grid.on ? t.canvas.canvas.grid.stopSnapping : t.canvas.canvas.grid.snap}
      </ContextAction>
      {!grid.on ? null : (
        <>
          <ContextSub label={t.canvas.canvas.menu.gridSpacing}>
            <ContextChoice
              value={String(grid.step)}
              onChoose={(value) => grid.choose(Number(value) as GridStep)}
              options={GRID_STEPS.map((step) => ({
                value: String(step),
                label: t.canvas.canvas.menu.gridStep(step),
              }))}
            />
          </ContextSub>
          {/* Line the wires up, or line the boxes up. A terminal sits at the
              middle of a node's side and nodes are not all the same height, so
              a grid that holds corners leaves every run with a kink in it. */}
          <ContextSub label={t.canvas.canvas.menu.snapBy}>
            <ContextChoice
              value={grid.anchor}
              onChoose={(value) => grid.chooseAnchor(value as GridAnchor)}
              options={GRID_ANCHORS.map((anchor) => ({
                value: anchor,
                label:
                  anchor === 'terminal'
                    ? t.canvas.canvas.menu.snapTerminals
                    : t.canvas.canvas.menu.snapOuterEdge,
              }))}
            />
          </ContextSub>
        </>
      )}
      {settled === 0 ? null : (
        <ContextAction onSelect={() => setResolvedShown((shown) => !shown)}>
          {resolvedShown
            ? t.canvas.canvas.menu.hideResolved(settled)
            : t.canvas.canvas.menu.showResolved(settled)}
        </ContextAction>
      )}
    </>
  );

  return (
    <PlanStoreProvider store={store}>
    <TitleEditorProvider value={readOnly ? null : draft.editor}>
    <ContextMenu menu={menu}>
    {/* The pointer can leave the canvas without leaving anything on it —
        straight off the edge of the window, or onto a panel — and then no node
        ever hears that it was let go of. */}
    <div
      ref={wrapper}
      className="relative h-full w-full"
      onPointerMove={(event) => {
        const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        hover.current = at;
        connection.publishCursor(at);
      }}
      onPointerLeave={() => {
        hover.current = null;
        highlight(null);
        // Leaving the canvas has to take the pointer off everyone else's screen
        // too, or it is left standing wherever it crossed the edge.
        connection.publishCursor(null);
      }}
      // Held from the moment a Shift+box starts on the canvas until it is let
      // go: React Flow empties the selection as the box begins.
      onPointerDownCapture={(event) => {
        if (
          event.shiftKey &&
          event.button === 0 &&
          event.target instanceof Element &&
          event.target.classList.contains('react-flow__pane')
        ) {
          keptSelection.current = new Set(
            store
              .getState()
              .nodes.filter((node) => node.selected === true)
              .map((node) => node.id),
          );
        }
      }}
      onPointerUp={() => {
        keptSelection.current = null;
      }}
    >
      <EdgeMarkers />
      <ReadingBanner store={store} />
      <ReactFlow
        nodes={rendered}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={readOnly ? undefined : removeNodes}
        onEdgesDelete={readOnly ? undefined : removeEdges}
        /*
         * No `snapToGrid`. React Flow can only snap a node's corner, relative to
         * whatever it sits in, so under the terminal anchor it showed one place
         * and the drop put the node 2px from it. The drag is still quantised —
         * by `handleNodesChange`, with the rule the drop uses, which is what
         * keeps it magnetic and lets it land where it was shown.
         */
        onNodeDrag={readOnly ? undefined : handleDrag}
        onNodeDragStop={readOnly ? undefined : handleDragStop}
        onConnect={readOnly ? undefined : handleConnect}
        onConnectEnd={readOnly ? undefined : handleConnectEnd}
        /*
         * Pointer and wheel, as a drawing tool has them: a plain drag on the
         * canvas draws a selection box that takes whatever it touches, the
         * middle button (or Space) pans, the wheel scrolls the drawing and
         * zooms only with Ctrl or ⌘ held or a pinch. Shift is a modifier for
         * clicking and boxing, not a mode of its own.
         */
        panOnDrag={PAN_BUTTONS}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
        panOnScroll
        zoomOnScroll={false}
        zoomActivationKeyCode={ZOOM_KEYS}
        zoomOnPinch
        zoomOnDoubleClick={false}
        deleteKeyCode={readOnly ? null : DELETE_KEYS}
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
        onNodeDragStart={(event, node) => {
          taken.current = true;
          lead.current = node.id;
          // Alt is read as the drag begins, the way every drawing tool reads it:
          // letting go of it halfway does not turn a copy back into a move.
          copying.current = !readOnly && event.altKey;
          setDragging(true);
        }}
        onSelectionContextMenu={(event) => {
          setUnder(null);
          setPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
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
        <AlignGuides guides={guides} />
        <GapMarkers gaps={gaps} />
        {readOnly || dragging || members.length < 2 ? null : (
          <GapHandles
            members={members}
            onPreview={previewSpacing}
            onCommit={(positions) =>
              commitMoves(carry(new Map(positions), absolute, parentOf))
            }
          />
        )}
        <Controls
          showInteractive={false}
          className="!border !border-rule !bg-surface !shadow-none [&_button]:!border-rule [&_button]:!bg-surface [&_button]:!fill-ink-muted hover:[&_button]:!bg-surface-2"
        >
          {/* The grid is a drafting aid and belongs with the other two, which are
              also about looking rather than about the plan. Which step it uses
              stays in the menu: this is the switch, not the settings. */}
          <ControlButton
            onClick={grid.toggle}
            title={
              grid.on
                ? t.canvas.canvas.grid.snappingTo(grid.step)
                : t.canvas.canvas.grid.notSnapping
            }
            aria-label={grid.on ? t.canvas.canvas.grid.stopSnapping : t.canvas.canvas.grid.snap}
            aria-pressed={grid.on}
          >
            <Grid2x2 className={grid.on ? '!fill-none stroke-accent' : '!fill-none stroke-ink-muted'} />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
    </ContextMenu>
    </TitleEditorProvider>
    </PlanStoreProvider>
  );
}

/** The box around several boxes. */
function union(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function containsOp(from: string, to: string): PlanOp {
  return {
    op: 'upsert_edge',
    edge: normalizeEdge(planEdgeInputSchema.parse({ kind: 'contains', from, to })),
  };
}

/** A field, or anything else text is being typed into, which keeps its own shortcuts. */
function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/*
 * The canvas's own gestures, declared once: React Flow listens for each key
 * list it is handed, and a new array every render is a new listener.
 */
const PAN_BUTTONS = [1];
const MULTI_SELECT_KEYS = ['Shift', 'Control', 'Meta'];
const ZOOM_KEYS = ['Control', 'Meta'];
const DELETE_KEYS = ['Backspace', 'Delete'];

/**
 * Who is walking the plan, while they are.
 *
 * Without it the drawing lights up on its own and reads as a fault. It says
 * what is happening and gets out of the way — no control, nothing to dismiss,
 * gone when the walk is.
 */
function ReadingBanner({ store }: { store: PlanStore['store'] }) {
  const reading = useStore(store, (state) => state.reading);
  const t = useT();
  if (reading === null) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <span className="flex items-center gap-2 rounded-md border border-collab/40 bg-surface-3 px-2.5 py-1 text-xs text-ink elevated">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-collab" />
        {t.canvas.canvas.readingFrom(reading.by, reading.from)}
      </span>
    </div>
  );
}

/** The lines a dragged node has lined up on, drawn across what it lined up with. */
function AlignGuides({ guides }: { guides: readonly Guide[] }) {
  const zoom = useFlowStore((state) => state.transform[2]);
  if (guides.length === 0) return null;
  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        style={{ width: 1, height: 1, zIndex: 1001 }}
        aria-hidden
      >
        {guides.map((guide) => (
          <line
            key={guide.axis}
            x1={guide.axis === 'x' ? guide.at : guide.from}
            x2={guide.axis === 'x' ? guide.at : guide.to}
            y1={guide.axis === 'y' ? guide.at : guide.from}
            y2={guide.axis === 'y' ? guide.at : guide.to}
            stroke="var(--accent)"
            strokeWidth={1 / zoom}
          />
        ))}
      </svg>
    </ViewportPortal>
  );
}
