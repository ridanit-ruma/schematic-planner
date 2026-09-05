import { useCallback, useEffect, useState } from 'react';
import type * as Y from 'yjs';

import { minimalEdit } from './minimal-edit';

/**
 * Binds a textarea to a shared Y.Text.
 *
 * The whole value is not replaced on every keystroke: the changed span is found
 * and only that is deleted and inserted. Two people typing in different
 * paragraphs then merge instead of overwriting each other, and a remote cursor
 * inside the text keeps its place.
 */
export function useYText(text: Y.Text | undefined): [string, (next: string) => void] {
  const [value, setValue] = useState(() => text?.toString() ?? '');

  useEffect(() => {
    if (text === undefined) return;
    setValue(text.toString());
    const observe = (): void => setValue(text.toString());
    text.observe(observe);
    return () => text.unobserve(observe);
  }, [text]);

  const write = useCallback(
    (next: string) => {
      if (text === undefined) return;
      const edit = minimalEdit(text.toString(), next);
      if (edit === null) return;

      text.doc?.transact(() => {
        if (edit.remove > 0) text.delete(edit.at, edit.remove);
        if (edit.insert !== '') text.insert(edit.at, edit.insert);
      });
    },
    [text],
  );

  return [value, write];
}
