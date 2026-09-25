import { useRef } from 'react';
import { Outlet } from 'react-router';

import { Explorer } from './explorer/Explorer';
import { ExplorerProvider, type ExplorerHandle } from './explorer/explorer-context';

/**
 * The one screen everything signed in happens on: the explorer on the left,
 * and whatever you opened from it on the right — a plan's canvas, the recent
 * list, a settings screen.
 *
 * There used to be two: a rail of links around every screen but the canvas,
 * and the canvas with a tree of its own. Going from a list to a plan and back
 * changed the whole screen, and the tree was only there when a plan was open.
 */
export function AppShell() {
  const handle = useRef<ExplorerHandle | null>(null);

  return (
    <ExplorerProvider handle={handle}>
      <div className="relative flex h-dvh min-h-0 bg-ground">
        <Explorer handle={handle} />
        {/* A plan fills this exactly, which is the size its canvas is drawn
            at; everything else scrolls inside it. */}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </ExplorerProvider>
  );
}
