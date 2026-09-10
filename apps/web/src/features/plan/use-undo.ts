import { EDGES_KEY, META_KEY, NODES_KEY, ORIGIN_LOCAL } from '@schematic/ydoc';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

export interface Undo {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * Taking back your own last edit, and putting it back again.
 *
 * Scoped to this end's own writes. In a document several people and an agent
 * share, an undo that reached across and reverted somebody else's work would
 * not be an undo — it would be an edit nobody asked for, arriving on their
 * screen with no explanation. So only `ORIGIN_LOCAL` is tracked: your drags,
 * your typing, your deletions. What arrives over the socket, what an agent
 * draws and what the server places stay where they are.
 */
export function usePlanUndo(doc: Y.Doc): Undo {
  const [manager, setManager] = useState<Y.UndoManager | null>(null);
  const [state, setState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    const tracked = new Y.UndoManager(
      [doc.getMap(META_KEY), doc.getMap(NODES_KEY), doc.getMap(EDGES_KEY)],
      { trackedOrigins: new Set([ORIGIN_LOCAL]) },
    );
    const report = (): void =>
      setState({
        canUndo: tracked.undoStack.length > 0,
        canRedo: tracked.redoStack.length > 0,
      });

    tracked.on('stack-item-added', report);
    tracked.on('stack-item-popped', report);
    tracked.on('stack-cleared', report);
    setManager(tracked);
    report();

    return () => {
      tracked.destroy();
      setManager(null);
      setState({ canUndo: false, canRedo: false });
    };
  }, [doc]);

  return {
    undo: () => manager?.undo(),
    redo: () => manager?.redo(),
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

/**
 * The keyboard, except where it already means something.
 *
 * A field has its own undo stack and it is the one a person expects while their
 * cursor is in it — taking that over to revert a node they moved five minutes
 * ago would be startling. So the shortcut is left alone wherever text is being
 * edited.
 */
export function useUndoKeys({ undo, redo }: Undo): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (isEditingText(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}
