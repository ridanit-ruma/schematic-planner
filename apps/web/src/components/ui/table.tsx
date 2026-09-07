import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A dense list, drawn with hairlines rather than rules.
 *
 * Rows are clamped short and separated by the faintest line the palette has:
 * what should catch the eye in a list of thirty is the one row you are pointing
 * at, not the grid it sits in.
 *
 * The layout is fixed, so a table never scrolls sideways — it divides whatever
 * width it is given. That is also its one trap: fixed widths that add up to
 * more than a phone has leave the flexible first column a single letter and an
 * ellipsis. Columns that are not the subject of the row carry `hide`, and what
 * they held moves under the title on a narrow screen.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-rule bg-surface-2', className)}>
      <table className="w-full table-fixed border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-rule text-left">{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  align,
  hide,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'right';
  /** Drop the column below this width. Pair it with the same `hide` on every cell. */
  hide?: 'sm' | 'md';
}) {
  return (
    <th
      className={cn(
        'rail-heading px-2 py-2 font-medium sm:px-3',
        align === 'right' && 'text-right',
        hidden(hide),
        className,
      )}
    >
      {children}
    </th>
  );
}

function hidden(hide: 'sm' | 'md' | undefined): string | false {
  if (hide === 'sm') return 'hidden sm:table-cell';
  if (hide === 'md') return 'hidden md:table-cell';
  return false;
}

export function TR({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-rule/60 transition-colors last:border-b-0 hover:bg-surface-3">
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  align,
  hide,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'right';
  hide?: 'sm' | 'md';
}) {
  return (
    <td className={cn('px-2 py-2 sm:px-3', align === 'right' && 'text-right', hidden(hide), className)}>
      {children}
    </td>
  );
}
