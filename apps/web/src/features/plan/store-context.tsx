import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { PlanState, PlanStore } from './plan-store';

/**
 * The plan's own store, reachable from inside a React Flow node or edge.
 *
 * React Flow gives a custom node its data and nothing else, so anything a node
 * needs to know about the plan as a whole — what has just arrived, what the
 * pointer is over, what an agent is reading — has to come from here. Selectors
 * keep it cheap: a node subscribes to one boolean and re-renders only when that
 * boolean changes.
 */
const StoreContext = createContext<PlanStore['store'] | null>(null);

export function PlanStoreProvider({
  store,
  children,
}: {
  store: PlanStore['store'];
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function usePlanStore<T>(selector: (state: PlanState) => T): T {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('usePlanStore outside a plan');
  return useStore(store, selector);
}
