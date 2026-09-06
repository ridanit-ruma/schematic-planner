import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A dense list, drawn with hairlines rather than rules.
 *
 * Rows are clamped short and separated by the faintest line the palette has:
 * what should catch the eye in a list of thirty is the one row you are pointing
 * at, not the grid it sits in.
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
}: {
  children?: ReactNode;
  className?: string;
  align?: 'right';
}) {
  return (
    <th
      className={cn(
        'rail-heading px-3 py-2 font-medium',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  );
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
}: {
  children?: ReactNode;
  className?: string;
  align?: 'right';
}) {
  return (
    <td className={cn('px-3 py-2', align === 'right' && 'text-right', className)}>{children}</td>
  );
}
