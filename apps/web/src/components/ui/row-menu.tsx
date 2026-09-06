import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { DropdownMenu } from './dropdown-menu';

/**
 * A row's own actions, behind one quiet button at its end.
 *
 * A row is for opening the thing it names, so anything else it can do goes in
 * here rather than competing with it — and a destructive action in particular
 * should take two deliberate movements to reach.
 */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-4 hover:text-ink focus:outline-none"
        >
          <MoreHorizontal className="size-4" />
        </button>
      }
    >
      {children}
    </DropdownMenu>
  );
}
