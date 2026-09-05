export interface MinimalEdit {
  readonly at: number;
  readonly remove: number;
  readonly insert: string;
}

/**
 * The smallest single-span change turning `current` into `next`.
 *
 * Replacing the whole string on every keystroke would make the last writer win
 * and would move every remote cursor in the text. Editing only the span that
 * actually changed lets two people type in the same note and merge.
 */
export function minimalEdit(current: string, next: string): MinimalEdit | null {
  if (current === next) return null;

  const limit = Math.min(current.length, next.length);

  let start = 0;
  while (start < limit && current[start] === next[start]) start += 1;

  let fromEnd = 0;
  while (
    fromEnd < limit - start &&
    current[current.length - 1 - fromEnd] === next[next.length - 1 - fromEnd]
  ) {
    fromEnd += 1;
  }

  return {
    at: start,
    remove: current.length - start - fromEnd,
    insert: next.slice(start, next.length - fromEnd),
  };
}
