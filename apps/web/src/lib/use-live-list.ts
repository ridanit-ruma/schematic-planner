import { useEffect, useRef, type DependencyList } from 'react';

/** Ignore a second wake-up this soon after the last one. */
const QUIET_MS = 1500;

/** Why a list is being read: the first time it is shown, or on coming back to it. */
export type LoadReason = 'first' | 'again';

/**
 * Whether a wake-up is worth a request.
 *
 * Raising a tab fires focus and visibilitychange together, and clicking back
 * into a window fires focus on its own, so the same return arrives two or three
 * times. Separated from the effect because this is the only rule here, and a
 * rule that cannot be run on its own is a rule nobody checks.
 */
export function shouldReread(
  visibility: DocumentVisibilityState,
  since: number,
  now: number,
): boolean {
  if (visibility !== 'visible') return false;
  return now - since >= QUIET_MS;
}

/**
 * Reads a list now, and again when the window comes back to the front.
 *
 * A plan's contents are a shared document and arrive over a socket, but the
 * lists around it — projects, plans, the trash, what you were working on — are
 * plain reads with no such channel. Somebody else adding a plan therefore left
 * the screen quietly out of date until it was opened again.
 *
 * Returning to the window is the moment worth spending a request on: it is when
 * a person looks, and it is the only moment they could have missed something.
 * Polling would answer the same question over and over at the edge of vision,
 * which is movement without information.
 */
export function useLiveList(
  /** May return a teardown, the way an effect does; it runs before each reread. */
  load: (reason: LoadReason) => void | (() => void),
  deps: DependencyList,
): void {
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    let at = Date.now();
    let done = latest.current('first');

    const again = (): void => {
      // Focus and visibility both fire when a tab is raised, and a click back
      // into the window fires focus on its own. One read is enough.
      if (!shouldReread(document.visibilityState, at, Date.now())) return;
      at = Date.now();
      done?.();
      done = latest.current('again');
    };

    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      done?.();
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, deps);
}
