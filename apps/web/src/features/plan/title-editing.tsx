import {
  normalizeEdge,
  planEdgeInputSchema,
  uniqueSlug,
  type PlanOp,
  type Position,
} from '@schematic/schema';
import { nodesMap } from '@schematic/ydoc';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type * as Y from 'yjs';

import { t } from '@/i18n';
import type { Undo } from './use-undo';

/**
 * Naming a node on the card itself.
 *
 * A node is made where it is wanted — dropped off the end of a line, or asked
 * for at a place — and named right there, with the drawing still in view. The
 * card holds an input while it is being named; everything else here is what
 * makes that one gesture and not three.
 */
export interface TitleEditing {
  /** The node whose title is being typed, or null. */
  editing: string | null;
  /** Whether that node was made a moment ago to be named, so giving up takes it away. */
  fresh: boolean;
}

export interface TitleEditor {
  store: StoreApi<TitleEditing>;
  /** Starts typing over an existing node's title. */
  start: (slug: string) => void;
  /** Enter, or leaving the field. An empty title on a fresh node takes it away. */
  commit: (slug: string, title: string) => void;
  /** Escape. A fresh node goes with it. */
  cancel: (slug: string) => void;
}

const idle = createStore<TitleEditing>(() => ({ editing: null, fresh: false }));
const TitleEditorContext = createContext<TitleEditor | null>(null);
export const TitleEditorProvider = TitleEditorContext.Provider;

/**
 * Whether this node is being named, and the editor to name it with. Null on a
 * canvas that cannot be edited.
 */
export function useTitleEditing(slug: string): {
  editing: boolean;
  fresh: boolean;
  editor: TitleEditor | null;
} {
  const editor = useContext(TitleEditorContext);
  const editing = useStore(editor?.store ?? idle, (state) => state.editing === slug);
  const fresh = useStore(editor?.store ?? idle, (state) => state.editing === slug && state.fresh);
  return { editing, fresh, editor };
}

export interface DraftRequest {
  /** The new node's top-left corner, already placed. */
  position: Position;
  /** The node it is connected from, when it was drawn out of that node's terminal. */
  from?: string;
  /** The box it is made inside, if any. */
  holder?: string | null;
  /** Whether it stays where it was put when the plan is arranged. */
  pinned: boolean;
}

/**
 * What a new node is called before anybody names it. It carries this client's
 * id, so two people each adding a node before the other's has arrived do not
 * both write the same key and lose one of the two.
 */
export function draftSlug(clientID: number, taken: Iterable<string>): string {
  return uniqueSlug(`node-${clientID.toString(36)}`, taken);
}

/**
 * Making a node and naming it, as one step.
 *
 * The node is written straight away — it is drawn, and anyone else on the plan
 * sees it appear — with a placeholder title and the card's field open. Naming
 * it joins the same undo step as making it, and gives it an identifier made
 * from the name the way *Add node* always did. Giving up, with Escape or an
 * empty name, takes the whole step back as if it had never been taken.
 */
export function useNodeDraft(options: {
  doc: Y.Doc;
  apply: (ops: PlanOp[]) => void;
  undo: Undo | undefined;
  /** Every slug in the plan right now. */
  slugs: () => Iterable<string>;
}): { editor: TitleEditor; create: (request: DraftRequest) => string } {
  const [store] = useState(() =>
    createStore<TitleEditing>(() => ({ editing: null, fresh: false })),
  );
  // Read when an action happens rather than captured when it was defined, so
  // the editor handed to every card can stay one object.
  const latest = useRef(options);
  latest.current = options;
  /** The undo step that made the node being named, while it is the last one. */
  const made = useRef<{ slug: string; step: unknown } | null>(null);

  const lastStep = (): unknown => latest.current.undo?.manager?.undoStack.at(-1) ?? null;

  /** Takes a fresh node away again, by undoing the step that made it when it can. */
  const discard = useCallback((slug: string): void => {
    const { doc, apply, undo } = latest.current;
    const manager = undo?.manager ?? null;
    const step = made.current?.slug === slug ? made.current.step : null;
    made.current = null;
    if (!nodesMap(doc).has(slug)) return;
    if (manager !== null && step !== null && lastStep() === step) {
      manager.undo();
      // Nothing to put back: redoing it would bring back a node nobody named.
      manager.clear(false, true);
      return;
    }
    apply([{ op: 'delete_node', slug }]);
  }, []);

  const editor = useMemo<TitleEditor>(
    () => ({
      store,
      start: (slug) => store.setState({ editing: slug, fresh: false }),
      cancel: (slug) => {
        const state = store.getState();
        if (state.editing !== slug) return;
        store.setState({ editing: null, fresh: false });
        if (state.fresh) discard(slug);
      },
      commit: (slug, title) => {
        const state = store.getState();
        if (state.editing !== slug) return;
        store.setState({ editing: null, fresh: false });
        const { doc, apply, undo, slugs } = latest.current;
        const trimmed = title.trim().slice(0, 200);

        if (!state.fresh) {
          const current = nodesMap(doc).get(slug)?.get('title');
          if (trimmed === '' || trimmed === current) return;
          apply([{ op: 'upsert_node', node: { slug, title: trimmed } }]);
          return;
        }
        if (trimmed === '') {
          discard(slug);
          return;
        }
        if (!nodesMap(doc).has(slug)) return;

        const manager = undo?.manager ?? null;
        const step = made.current?.slug === slug ? made.current.step : null;
        made.current = null;
        // The name joins the step that made the node, as long as nothing else
        // has been done since.
        if (manager !== null && step !== null && lastStep() === step) {
          manager.lastChange = Date.now();
        }
        const named = uniqueSlug(
          trimmed,
          [...slugs()].filter((candidate) => candidate !== slug),
        );
        apply([
          { op: 'upsert_node', node: { slug, title: trimmed } },
          ...(named === slug ? [] : [{ op: 'rename_node', from: slug, to: named } as PlanOp]),
        ]);
        manager?.stopCapturing();
      },
    }),
    [discard, store],
  );

  const create = useCallback(
    (request: DraftRequest): string => {
      const { apply, undo, slugs } = latest.current;
      // Whatever was being named and has not been let go of is given up on:
      // typing into it and then reaching for something else commits it on the
      // way, so what is left open here was never named.
      const open = store.getState().editing;
      if (open !== null) editor.cancel(open);

      const slug = draftSlug(latest.current.doc.clientID, slugs());
      const ops: PlanOp[] = [
        {
          op: 'upsert_node',
          node: {
            slug,
            title: t().canvas.canvas.card.untitled,
            position: { x: Math.round(request.position.x), y: Math.round(request.position.y) },
            pinned: request.pinned,
          },
        },
      ];
      if (request.holder != null) ops.push(line('contains', request.holder, slug));
      if (request.from !== undefined) ops.push(line('flows_to', request.from, slug));

      const manager = undo?.manager ?? null;
      manager?.stopCapturing();
      const before = lastStep();
      apply(ops);
      const step = lastStep();
      // Refused by the document: there is nothing to name.
      if (!nodesMap(latest.current.doc).has(slug)) return slug;
      made.current = { slug, step: step === before ? null : step };
      store.setState({ editing: slug, fresh: true });
      return slug;
    },
    [editor, store],
  );

  return { editor, create };
}

function line(kind: 'contains' | 'flows_to', from: string, to: string): PlanOp {
  return {
    op: 'upsert_edge',
    edge: normalizeEdge(planEdgeInputSchema.parse({ kind, from, to })),
  };
}
