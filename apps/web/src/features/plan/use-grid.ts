import { useCallback, useState } from 'react';

const KEY = 'plan-grid';

/**
 * Whether the drafting grid is drawn.
 *
 * A preference of the person looking, not a property of the plan: two people
 * with the same plan open can disagree about it and both be right. So it is
 * kept in the browser rather than in the document, and a browser that refuses
 * to store it simply shows the grid.
 */
export function useGrid(): [boolean, () => void] {
  const [on, setOn] = useState(read);

  const toggle = useCallback(() => {
    setOn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* A remembered preference is a convenience, not a requirement. */
      }
      return next;
    });
  }, []);

  return [on, toggle];
}

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}
