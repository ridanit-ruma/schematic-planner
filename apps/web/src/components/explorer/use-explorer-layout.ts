import { useCallback, useState } from 'react';

import { EXPLORER_WIDTH, clampWidth, readWidth } from './tree';

const WIDTH_KEY = 'explorer-width';
const COLLAPSED_KEY = 'explorer-collapsed';

/** Below this the explorer floats over the content rather than standing beside it. */
const NARROW = '(max-width: 767px)';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // A remembered preference is a convenience, not a requirement.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A remembered preference is a convenience, not a requirement. */
  }
}

export function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
}

/**
 * How wide the explorer is and whether it is folded away, remembered in this
 * browser.
 *
 * Narrow, it always starts folded — 256px of tree on a phone is most of the
 * screen, and the address was for what is on the right — and opening it there
 * is a glance rather than a preference, so it is not remembered.
 */
export function useExplorerLayout() {
  const [width, setWidthState] = useState(() => readWidth(read(WIDTH_KEY)));
  const [collapsed, setCollapsedState] = useState(() => isNarrow() || read(COLLAPSED_KEY) === '1');

  /** While the grip is held: follows the pointer without writing anything down. */
  const preview = useCallback((next: number) => setWidthState(clampWidth(next)), []);

  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next);
    setWidthState(clamped);
    write(WIDTH_KEY, String(clamped));
  }, []);

  const resetWidth = useCallback(() => setWidth(EXPLORER_WIDTH.initial), [setWidth]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    if (!isNarrow()) write(COLLAPSED_KEY, next ? '1' : '0');
  }, []);

  /** After following a link from the floating explorer, it gets out of the way. */
  const settle = useCallback(() => {
    if (isNarrow()) setCollapsedState(true);
  }, []);

  return { width, preview, setWidth, resetWidth, collapsed, setCollapsed, settle };
}
