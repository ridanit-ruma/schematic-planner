import { nodeBodyFragment } from '@schematic/ydoc';
import type * as Y from 'yjs';

/**
 * The shared fragment a node's body is edited in, now and whenever it is
 * replaced — the node deleted and made again under the same slug, or two
 * people turning an old text body into a fragment at once and one of theirs
 * winning. An editor left on the old fragment would type into nothing.
 *
 * Reading it can write (an old text body is converted on first read), so it
 * is called from an effect, never while rendering.
 */
export function watchNodeBody(
  doc: Y.Doc,
  slug: string,
  onChange: (fragment: Y.XmlFragment | undefined) => void,
): () => void {
  let last: Y.XmlFragment | undefined | null = null;
  const check = (): void => {
    const fragment = nodeBodyFragment(doc, slug);
    if (fragment === last) return;
    last = fragment;
    onChange(fragment);
  };
  check();
  doc.on('afterTransaction', check);
  return () => doc.off('afterTransaction', check);
}
