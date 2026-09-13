import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * One crumb a screen adds to the trail for itself.
 *
 * The shell builds the trail out of the address, which works while every part of
 * an address is also its name. A folder breaks that: its address carries an id,
 * and the shell would have to go and fetch the folder to caption itself. So the
 * screen that already has the name hands it over.
 *
 * Deliberately one label and not a list. Nothing here sits more than one level
 * below a project, and a general breadcrumb API with a single caller would be a
 * guess about a second one.
 */
const Crumb = createContext<{
  label: string | null;
  set: (label: string | null) => void;
}>({ label: null, set: () => undefined });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [label, set] = useState<string | null>(null);
  return createElement(Crumb.Provider, { value: { label, set } }, children);
}

/** Adds a trailing crumb while this screen is on, and takes it away with it. */
export function useCrumb(label: string | null): void {
  const { set } = useContext(Crumb);
  useEffect(() => {
    set(label);
    return () => set(null);
  }, [label, set]);
}

/** What the shell should draw at the end of the trail, if anything. */
export function useTrailingCrumb(): string | null {
  return useContext(Crumb).label;
}
