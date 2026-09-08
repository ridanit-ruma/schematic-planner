import { READING_STEP_MS } from '@schematic/ydoc';
import { useEffect } from 'react';
import { useStore } from 'zustand';

import type { PlanStore } from './plan-store';

/**
 * Walks the canvas along a trace as it is announced.
 *
 * The lighting is the one the pointer already uses — the thread stays in
 * colour, the rest of the drawing steps back — so following an agent through a
 * plan and following it yourself look the same, which is the point. It grows a
 * hop at a time rather than lighting the whole path at once: the order is what
 * the trace found, and the order is most of the answer.
 *
 * Hover wins while it lasts. Somebody reaching for a node has asked a question
 * of their own and should not have it answered over.
 */
export function useReadingWalk(store: PlanStore['store']): void {
  const reading = useStore(store, (state) => state.reading);

  useEffect(() => {
    if (reading === null || reading.hops.length === 0) return;

    const lit = new Set<string>();
    let hop = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const step = (): void => {
      const next = reading.hops[hop];
      if (next === undefined) {
        // Held for a moment at full length, then handed back.
        timer = setTimeout(() => store.setState({ related: null }), READING_STEP_MS * 3);
        return;
      }
      lit.add(next.node);
      if (next.edge !== null) lit.add(next.edge);
      hop += 1;
      store.setState({ related: new Set(lit) });
      timer = setTimeout(step, READING_STEP_MS);
    };

    step();
    return () => {
      clearTimeout(timer);
      store.setState({ related: null });
    };
  }, [reading, store]);
}
