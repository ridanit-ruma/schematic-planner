import { useEffect } from 'react';

const SUFFIX = 'Schematic Planner';

/**
 * What the browser tab says.
 *
 * Every address in the application served the same static shell, so every tab
 * read `Schematic Planner` — and somebody with four plans open had four
 * identical tabs. The shell cannot know better: it is one file, and the route
 * is only resolved once the application is running. So it is set here, from
 * whatever the screen already knows it is called.
 *
 * This does not reach a link preview. A crawler is handed the shell and does
 * not run any of this, which is the right outcome as well as the only one: an
 * unfurl is shown to everybody in the channel, and most of these names are
 * somebody's private workspace.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    const trimmed = title?.trim() ?? '';
    document.title = trimmed === '' ? SUFFIX : `${trimmed} — ${SUFFIX}`;
    return () => {
      document.title = SUFFIX;
    };
  }, [title]);
}
